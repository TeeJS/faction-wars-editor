// Draws build/icon.png (1024x1024 RGBA): a star chart - three worlds on an
// orbit, joined by travel lanes - in the editor's amber on deep navy.
//   node scripts/make-icon.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const N = 1024
const SS = 3 // supersamples per axis
const here = fileURLToPath(new URL('.', import.meta.url))

const clamp = (v) => Math.max(0, Math.min(1, v))
const mix = (a, b, t) => a + (b - a) * t

function roundedBox(x, y, half, r) {
  const qx = Math.abs(x) - half + r
  const qy = Math.abs(y) - half + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

const worlds = [
  [-0.36, 0.18, 0.085],
  [0.3, -0.3, 0.11],
  [0.22, 0.34, 0.065]
]
const lanes = [
  [0, 1],
  [1, 2],
  [2, 0]
]
const amber = [233, 176, 72]
const bgTop = [22, 30, 52]
const bgBottom = [10, 13, 24]

function shade(u, v) {
  // u, v in [-1, 1]
  const box = roundedBox(u, v, 0.92, 0.22)
  if (box > 0) return [0, 0, 0, 0]
  let r = mix(bgTop[0], bgBottom[0], (v + 1) / 2)
  let g = mix(bgTop[1], bgBottom[1], (v + 1) / 2)
  let b = mix(bgTop[2], bgBottom[2], (v + 1) / 2)
  const glow = clamp(1 - Math.hypot(u + 0.05, v + 0.02) / 0.95) ** 2 * 0.35
  r += 60 * glow
  g += 70 * glow
  b += 110 * glow
  let a = 0
  // Orbit ring.
  const ring = Math.abs(Math.hypot(u, v) - 0.58)
  a = Math.max(a, clamp((0.012 - ring) / 0.004) * 0.55)
  // Lanes.
  for (const [i, j] of lanes) {
    const d = segDist(u, v, worlds[i][0], worlds[i][1], worlds[j][0], worlds[j][1])
    a = Math.max(a, clamp((0.014 - d) / 0.004) * 0.85)
  }
  // Worlds (solid, with a dark rim so they read over the lanes).
  let rim = 0
  for (const [x, y, rad] of worlds) {
    const d = Math.hypot(u - x, v - y)
    if (d < rad + 0.03) rim = Math.max(rim, clamp((rad + 0.03 - d) / 0.004))
    a = Math.max(a * (1 - clamp((rad + 0.03 - d) / 0.004)), clamp((rad - d) / 0.004))
  }
  r = mix(r, amber[0], a)
  g = mix(g, amber[1], a)
  b = mix(b, amber[2], a)
  void rim
  // Edge anti-aliasing of the rounded square.
  const edge = clamp(-box / 0.004)
  return [r, g, b, 255 * edge]
}

const rgba = new Uint8Array(N * N * 4)
for (let y = 0; y < N; y++)
  for (let x = 0; x < N; x++) {
    const acc = [0, 0, 0, 0]
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) {
        const u = ((x + (sx + 0.5) / SS) / N) * 2 - 1
        const v = ((y + (sy + 0.5) / SS) / N) * 2 - 1
        const c = shade(u, v)
        acc[0] += c[0] * c[3]
        acc[1] += c[1] * c[3]
        acc[2] += c[2] * c[3]
        acc[3] += c[3]
      }
    const i = (y * N + x) * 4
    const alpha = acc[3] / (SS * SS)
    rgba[i] = alpha > 0 ? acc[0] / acc[3] : 0
    rgba[i + 1] = alpha > 0 ? acc[1] / acc[3] : 0
    rgba[i + 2] = alpha > 0 ? acc[2] / acc[3] : 0
    rgba[i + 3] = alpha
  }

// PNG encode (RGBA 8-bit).
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
const raw = Buffer.alloc((N * 4 + 1) * N)
for (let y = 0; y < N; y++) Buffer.from(rgba.buffer, y * N * 4, N * 4).copy(raw, y * (N * 4 + 1) + 1)
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(N, 0)
ihdr.writeUInt32BE(N, 4)
ihdr[8] = 8
ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
mkdirSync(join(here, '..', 'build'), { recursive: true })
writeFileSync(join(here, '..', 'build', 'icon.png'), png)
console.log(`build/icon.png written (${png.length} bytes)`)
