// The player's art sets, known by their pictures' SHA-256: the game refuses a
// faction pack carrying any file identical to one of them (pack_import.gd _leaks),
// so the editor checks each picture as it is added, and every file in the pack.

import { sha256Hex } from './zip'

/** One art set found on this computer: its id, where, and path -> sha256 from its manifest. */
export interface ArtSetSource {
  id: string
  path: string
  files: Record<string, string>
}

export interface ArtSets {
  /** Where each set was found (a chosen one first). */
  sources: { id: string; path: string }[]
  /** sha256 -> "<set>:<path>", over every source. */
  byHash: Map<string, string>
}

export function indexArtSets(sources: ArtSetSource[]): ArtSets {
  const byHash = new Map<string, string>()
  for (const s of sources)
    for (const [path, hash] of Object.entries(s.files)) {
      const h = String(hash).toLowerCase()
      if (!byHash.has(h)) byHash.set(h, `${s.id}:${path}`)
    }
  return { sources: sources.map((s) => ({ id: s.id, path: s.path })), byHash }
}

// A file's bytes are immutable once read or written, so its hash is kept per buffer.
const hashes = new WeakMap<Uint8Array, Promise<string>>()

function hashOf(bytes: Uint8Array): Promise<string> {
  let h = hashes.get(bytes)
  if (!h) {
    h = sha256Hex(bytes)
    hashes.set(bytes, h)
  }
  return h
}

/** The art set's name for these bytes ("<set>:<path>"), or null when they are not the original's. */
export async function originalOf(bytes: Uint8Array, art: ArtSets | null): Promise<string | null> {
  if (!art || art.byHash.size === 0) return null
  return art.byHash.get(await hashOf(bytes)) ?? null
}

/** Every pack file that is identical to one in the art sets. */
export async function findOriginals(files: { path: string; bytes: Uint8Array }[], art: ArtSets | null): Promise<{ path: string; original: string }[]> {
  if (!art || art.byHash.size === 0) return []
  const out: { path: string; original: string }[] = []
  for (const f of files) {
    const original = await originalOf(f.bytes, art)
    if (original) out.push({ path: f.path, original })
  }
  return out
}
