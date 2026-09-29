// A small PNG reader for the tests: 8-bit RGB or RGBA, not interlaced -
// what Godot's Image.save_png writes. Enough to count a colour's pixels.

import { unzlibSync } from 'fflate'

export interface Pixels {
  width: number
  height: number
  channels: number
  data: Uint8Array
}

export function readPng(bytes: Uint8Array): Pixels {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 8
  let width = 0
  let height = 0
  let channels = 0
  const idat: Uint8Array[] = []
  while (at < bytes.length) {
    const len = view.getUint32(at)
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8))
    const body = bytes.subarray(at + 8, at + 8 + len)
    if (type === 'IHDR') {
      width = view.getUint32(at + 8)
      height = view.getUint32(at + 12)
      const depth = body[8]
      const color = body[9]
      if (depth !== 8 || body[12] !== 0) throw new Error('only 8-bit, non-interlaced PNGs')
      channels = color === 6 ? 4 : color === 2 ? 3 : 0
      if (!channels) throw new Error(`colour type ${color} not supported`)
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') break
    at += 12 + len
  }
  const raw = unzlibSync(concat(idat))
  const stride = width * channels
  const data = new Uint8Array(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[y * stride + x - channels] : 0
      const b = y > 0 ? data[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? data[(y - 1) * stride + x - channels] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      data[y * stride + x] = v & 255
    }
  }
  return { width, height, channels, data }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** How many pixels are exactly this #rrggbb. */
export function countColor(px: Pixels, hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  let n = 0
  for (let i = 0; i < px.data.length; i += px.channels) if (px.data[i] === r && px.data[i + 1] === g && px.data[i + 2] === b) n++
  return n
}
