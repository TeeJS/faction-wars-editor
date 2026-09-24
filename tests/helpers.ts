import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { PackDocument } from '../src/core/document'

/** A read-only checkout of TeeJS/faction-wars (CI clones it; locally it sits beside this repo). */
export const FACTION_WARS_DIR = resolve(process.env.FACTION_WARS_DIR ?? join(__dirname, '..', '..', 'faction-wars'))
export const SHIPPED_PACKS = ['star-wars-rebellion', 'ww2']
export const haveGameRepo = existsSync(join(FACTION_WARS_DIR, 'packs', 'ww2', 'pack.json'))

export function packDir(id: string): string {
  return join(FACTION_WARS_DIR, 'packs', id)
}

export function readTree(dir: string): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>()
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      if (statSync(full).isDirectory()) walk(full)
      else out.set(relative(dir, full).replace(/\\/g, '/'), new Uint8Array(readFileSync(full)))
    }
  }
  walk(dir)
  return out
}

export function loadShipped(id: string): PackDocument {
  return new PackDocument(readTree(packDir(id)), id)
}

export function docFromObjects(files: Record<string, unknown>, folder: string, extra: Record<string, Uint8Array> = {}): PackDocument {
  const map = new Map<string, Uint8Array>()
  for (const [k, v] of Object.entries(files)) map.set(k, new TextEncoder().encode(JSON.stringify(v, null, 2) + '\n'))
  for (const [k, v] of Object.entries(extra)) map.set(k, v)
  return new PackDocument(map, folder)
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
