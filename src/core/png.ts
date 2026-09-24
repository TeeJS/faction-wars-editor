// A tiny PNG encoder (RGB, 8-bit), enough to give a new pack its own map picture
// without shipping a binary asset.

import { zlibSync } from 'fflate'

let crcTable: Uint32Array | null = null
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Encodes width x height RGB pixels (`rgb.length === w*h*3`) as a PNG. */
export function encodePng(width: number, height: number, rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0 // filter: none
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1)
  }
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, width)
  dv.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', zlibSync(raw, { level: 9 })), chunk('IEND', new Uint8Array(0))]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** A deterministic starfield: a deep-blue gradient with scattered stars. */
export function starfieldPng(width: number, height: number, seed = 1): Uint8Array {
  const rgb = new Uint8Array(width * height * 3)
  let s = seed >>> 0 || 1
  const rand = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const dx = x / width - 0.5
      const dy = y / height - 0.5
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 1.6)
      rgb[i] = 8 + glow * 18
      rgb[i + 1] = 12 + glow * 22
      rgb[i + 2] = 28 + glow * 40
    }
  const stars = Math.floor((width * height) / 180)
  for (let n = 0; n < stars; n++) {
    const x = Math.floor(rand() * width)
    const y = Math.floor(rand() * height)
    const b = 90 + Math.floor(rand() * 165)
    const i = (y * width + x) * 3
    rgb[i] = b
    rgb[i + 1] = b
    rgb[i + 2] = Math.min(255, b + 20)
  }
  return encodePng(width, height, rgb)
}
