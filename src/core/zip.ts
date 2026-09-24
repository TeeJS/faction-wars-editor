// Reading and writing pack zips. The export is a port of the game's own builder
// (TeeJS/faction-wars tools/FactionWarsExporter/PackBuilder.cs + ArtSink.cs);
// checkImportable() is a port of the game's importer checks (src/ui/pack_import.gd)
// so every export can be proven importable before it is written.

import { Zip, ZipDeflate, ZipPassThrough, unzipSync, strFromU8, strToU8 } from 'fflate'
import { normalizePath } from './document'
import { SHIPPED_PACK_IDS } from './vocab'

export const MANIFEST = 'manifest.json'
export const MANIFEST_FORMAT = 1
export const KIND_FACTION_PACK = 'faction_pack'
export const KIND_ART_SET = 'art_set'

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface Manifest {
  format: number
  kind: string
  id: string
  title: string
  exporter: string
  created_utc: string
  files: Record<string, string>
}

/** PackBuilder's file filter: Godot sidecars and an old manifest never ship. */
export function isExportable(rel: string): boolean {
  const lower = rel.toLowerCase()
  return !lower.endsWith('.import') && !lower.endsWith('.uid') && rel !== MANIFEST
}

/** The leak guard: the original's art never rides in a faction pack. */
export async function findLeaks(files: { path: string; bytes: Uint8Array }[], artSetHashes: Set<string> | null): Promise<string[]> {
  const leaked: string[] = []
  for (const f of files) {
    if (f.path.toLowerCase().startsWith('original/')) leaked.push(`${f.path}  (the original's art lives in the art set, not in a pack)`)
    else if (artSetHashes && artSetHashes.has(await sha256Hex(f.bytes))) leaked.push(`${f.path}  (the same picture as one in your art set)`)
  }
  return leaked
}

/** "yyyy-MM-ddTHH:mm:ssZ", as the Exporter writes it. */
export function utcStamp(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export interface BuildResult {
  ok: boolean
  message: string
  bytes?: Uint8Array
  manifest?: Manifest
  files: number
}

/**
 * Builds a faction-pack zip: the pack's files at the root (sorted, '/'-separated),
 * PNGs stored, everything else deflated, and manifest.json written last listing
 * every file's SHA-256.
 */
export async function buildPackZip(
  input: { path: string; bytes: Uint8Array }[],
  opts: { id: string; title: string; exporter: string; artSetHashes: Set<string> | null; now?: Date }
): Promise<BuildResult> {
  if (!opts.id) return { ok: false, message: 'pack.json has no "id".', files: 0 }
  const files = input
    .map((f) => ({ path: normalizePath(f.path), bytes: f.bytes }))
    .filter((f) => isExportable(f.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

  const leaked = await findLeaks(files, opts.artSetHashes)
  if (leaked.length > 0)
    return {
      ok: false,
      message:
        'Not built: a faction pack is shared, so it must not carry the original\'s art. Refer to the art set instead ("art": "swr-original:..."). These files are the original\'s:\n  ' +
        leaked.join('\n  '),
      files: 0
    }

  const now = opts.now ?? new Date()
  const hashes: Record<string, string> = {}
  for (const f of files) hashes[f.path] = await sha256Hex(f.bytes)
  const manifest: Manifest = {
    format: MANIFEST_FORMAT,
    kind: KIND_FACTION_PACK,
    id: opts.id,
    title: opts.title || opts.id,
    exporter: opts.exporter,
    created_utc: utcStamp(now),
    files: hashes
  }

  const chunks: Uint8Array[] = []
  let failure: Error | null = null
  const zip = new Zip((err, chunk) => {
    if (err) failure = err
    else chunks.push(chunk)
  })
  const add = (name: string, data: Uint8Array) => {
    const entry = name.toLowerCase().endsWith('.png') ? new ZipPassThrough(name) : new ZipDeflate(name, { level: 9 })
    entry.mtime = now
    zip.add(entry)
    entry.push(data, true)
  }
  for (const f of files) add(f.path, f.bytes)
  add(MANIFEST, strToU8(manifestText(manifest)))
  zip.end()
  if (failure) return { ok: false, message: `Could not build the zip: ${(failure as Error).message}`, files: 0 }

  const total = chunks.reduce((n, c) => n + c.length, 0)
  const bytes = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    bytes.set(c, at)
    at += c.length
  }
  return { ok: true, message: `Built ${files.length} files.`, bytes, manifest, files: files.length }
}

/** The manifest's text: 2-space indent, trailing newline, files sorted - as the Exporter writes it. */
export function manifestText(m: Manifest): string {
  const sorted: Record<string, string> = {}
  for (const k of Object.keys(m.files).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) sorted[k] = m.files[k]
  // Build by hand so paths that look like integers keep their sorted order.
  const lines = [
    '{',
    `  "format": ${m.format},`,
    `  "kind": ${JSON.stringify(m.kind)},`,
    `  "id": ${JSON.stringify(m.id)},`,
    `  "title": ${JSON.stringify(m.title)},`,
    `  "exporter": ${JSON.stringify(m.exporter)},`,
    `  "created_utc": ${JSON.stringify(m.created_utc)},`,
    '  "files": {'
  ]
  const keys = Object.keys(sorted)
  keys.forEach((k, i) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(sorted[k])}${i < keys.length - 1 ? ',' : ''}`))
  lines.push('  }', '}')
  return lines.join('\n') + '\n'
}

// ---- reading ----

export interface OpenedZip {
  files: Map<string, Uint8Array>
  /** The folder name to treat the pack as living in (the manifest or pack.json id). */
  folderName: string | null
  warnings: string[]
}

/**
 * Opens a pack zip for editing. A game-format zip (manifest at the root) is
 * checked like the importer does; a plain zip of a pack folder (with or without a
 * single wrapping folder) is accepted too, so any pack can be opened.
 */
export async function openPackZip(bytes: Uint8Array): Promise<OpenedZip> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch (e) {
    throw new Error(`That is not a zip file (${(e as Error).message}).`)
  }
  const warnings: string[] = []
  const names = Object.keys(entries).filter((n) => !n.endsWith('/'))
  let prefix = ''
  if (!names.includes('pack.json') && !names.includes(MANIFEST)) {
    const withPack = names.filter((n) => /^[^/]+\/pack\.json$/.test(n))
    if (withPack.length === 1) {
      prefix = withPack[0].slice(0, withPack[0].length - 'pack.json'.length)
      warnings.push(`The zip wraps the pack in a folder '${prefix.slice(0, -1)}'; the game wants the files at the zip's root, and an export will put them there.`)
    } else throw new Error('No pack.json at the root of the zip (or inside one top-level folder).')
  }

  const files = new Map<string, Uint8Array>()
  let folderName: string | null = null
  const manifestBytes = entries[prefix + MANIFEST]
  if (manifestBytes) {
    let manifest: unknown
    try {
      manifest = JSON.parse(strFromU8(manifestBytes))
    } catch {
      throw new Error('Its manifest.json is not valid JSON.')
    }
    const mf = manifest as Partial<Manifest>
    if (mf.kind === KIND_ART_SET) throw new Error('That is an art set, not a faction pack - import art sets in the game.')
    const listed = mf.files && typeof mf.files === 'object' ? mf.files : {}
    for (const [rel, hash] of Object.entries(listed)) {
      const data = entries[prefix + rel]
      if (!data) {
        warnings.push(`manifest.json lists ${rel}, which the zip does not contain.`)
        continue
      }
      if ((await sha256Hex(data)) !== String(hash).toLowerCase()) warnings.push(`${rel} does not match its checksum in manifest.json (it was changed after export).`)
    }
    for (const n of names) {
      const rel = n.slice(prefix.length)
      if (!n.startsWith(prefix) || rel === MANIFEST) continue
      if (!(rel in listed)) warnings.push(`${rel} is in the zip but not in manifest.json - the game's importer would ignore it.`)
    }
    if (typeof mf.id === 'string' && mf.id) folderName = mf.id
  }
  for (const n of names) {
    if (!n.startsWith(prefix)) continue
    const rel = n.slice(prefix.length)
    if (rel === MANIFEST || rel === '') continue
    files.set(rel, entries[n])
  }
  if (!folderName) {
    try {
      const pj = JSON.parse(strFromU8(files.get('pack.json')!)) as { id?: unknown }
      if (typeof pj.id === 'string' && pj.id) folderName = pj.id
    } catch {
      /* the validator reports a bad pack.json */
    }
  }
  return { files, folderName, warnings }
}

// ---- the game's importer, as checks ----

function safeId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && /^[A-Za-z0-9_-]+$/.test(id)
}

/** pack_import.gd _safe_path. */
export function safePath(p: string): boolean {
  if (p === '' || p.startsWith('/') || p.startsWith('\\') || p.includes(':') || p.includes('\\')) return false
  return p.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
}

/**
 * Runs pack_import.gd's checks on a built zip. Returns '' when the game would
 * import it, or the reason it would refuse. `artSetHashes`: the player's installed
 * art set, for the leak check.
 */
export async function checkImportable(bytes: Uint8Array, artSetHashes: Set<string> | null = null): Promise<string> {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    return 'That is not a Faction Wars file (it could not be opened as a .zip).'
  }
  if (!entries[MANIFEST]) return 'That file has no manifest.json.'
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(strFromU8(entries[MANIFEST]))
  } catch {
    return 'Its manifest.json is not valid JSON.'
  }
  const kind = String(manifest.kind ?? '')
  const id = String(manifest.id ?? '')
  if (Number(manifest.format ?? 0) !== MANIFEST_FORMAT) return `It is format ${String(manifest.format ?? '?')}; the game reads format ${MANIFEST_FORMAT}.`
  if (kind !== KIND_ART_SET && kind !== KIND_FACTION_PACK) return `It is a '${kind}', which is neither an art set nor a faction pack.`
  if (!safeId(id)) return `Its id '${id}' is not a plain name (letters, digits, - and _).`
  const files = manifest.files
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0) return 'Its manifest lists no files.'
  const contents = new Map<string, Uint8Array>()
  for (const [rel, hash] of Object.entries(files as Record<string, unknown>)) {
    if (!safePath(rel)) return `It lists an unsafe path: ${rel}`
    const data = entries[rel]
    if (!data) return `It is incomplete: ${rel} is listed but missing.`
    if ((await sha256Hex(data)) !== String(hash).toLowerCase()) return `It is damaged: ${rel} does not match its checksum.`
    contents.set(rel, data)
  }
  if (kind === KIND_FACTION_PACK) {
    const leaked = await findLeaks([...contents].map(([path, b]) => ({ path, bytes: b })), artSetHashes)
    // The importer's own prefix check is case-sensitive; findLeaks is stricter, like the builder.
    if (leaked.length) return 'Not imported: a faction pack must not carry the original\'s art. These files are the original\'s:\n  ' + leaked.join('\n  ')
    if (!contents.has('pack.json')) return 'It is a faction pack with no pack.json.'
    if (SHIPPED_PACK_IDS.includes(id)) return `'${id}' is a pack that comes with the game; an imported copy would never be used.`
    // Beyond the importer: it installs to user://packs/<manifest id>, and the loader then
    // requires pack.json's id to equal that folder name.
    try {
      const pj = JSON.parse(strFromU8(contents.get('pack.json')!)) as { id?: unknown }
      if (pj.id !== id) return `manifest id '${id}' differs from pack.json id '${String(pj.id)}'; the game would install it and then refuse to load it.`
    } catch {
      return 'Its pack.json is not valid JSON.'
    }
  }
  return ''
}

/** The hashes an art set's manifest lists (Manifest.ArtSetHashes), or null when it is not one. */
export function artSetHashesFromManifest(text: string): Set<string> | null {
  try {
    const m = JSON.parse(text) as { kind?: unknown; files?: unknown }
    if (m.kind !== KIND_ART_SET || !m.files || typeof m.files !== 'object') return null
    return new Set(Object.values(m.files as Record<string, unknown>).map((h) => String(h).toLowerCase()))
  } catch {
    return null
  }
}

/** Reads only manifest.json out of an art-set zip. */
export function artSetHashesFromZip(bytes: Uint8Array): Set<string> | null {
  try {
    const entries = unzipSync(bytes, { filter: (f) => f.name === MANIFEST })
    const m = entries[MANIFEST]
    return m ? artSetHashesFromManifest(strFromU8(m)) : null
  } catch {
    return null
  }
}
