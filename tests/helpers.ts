import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { PackDocument } from '../src/core/document'
import { PACK_JSON_FILES } from '../src/core/vocab'

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

/** Puts a "_comment" into every JSON object under `v` (as the game's tests/pack_comments.gd does). */
export function commentEverywhere(v: unknown, note = "a pack author's note"): number {
  let n = 0
  if (Array.isArray(v)) for (const x of v) n += commentEverywhere(x, note)
  else if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of Object.keys(o)) n += commentEverywhere(o[k], note)
    o._comment = note
    n++
  }
  return n
}

/** A copy of `doc` with a "_comment" in every object of its 12 JSON files. */
export function commentedCopy(doc: PackDocument, folder: string): { doc: PackDocument; added: number } {
  const files = new Map(doc.allFiles().map((f) => [f.path, f.bytes]))
  let added = 0
  for (const f of PACK_JSON_FILES) {
    const data = JSON.parse(new TextDecoder().decode(files.get(f)!))
    added += commentEverywhere(data)
    files.set(f, new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n'))
  }
  return { doc: new PackDocument(files, folder), added }
}
