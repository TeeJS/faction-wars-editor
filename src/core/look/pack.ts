// The open pack as far as its look needs it: the id and name, the factions
// (their ids name the look's `sides`), the files it ships (faces and textures
// must be among them), a few names for the mock-ups, and look.json itself.
// Read from the PackDocument, unsaved edits included; keys case-insensitive
// as the game hydrates them (JsonUtil.get_ci).

import type { PackDocument } from '../document'
import { ci, gdStr } from './godot'
import { LookFile } from './lookfile'
import { readSamples, type Samples } from './samples'
import { readSector, type SectorData } from './sector'
import { readLook, validateLook, type LookContext } from './validate'

export const LOOK_FILE = 'look.json'

export interface Faction {
  id: string
  name: string
  /** factions.json short_name (the finders' tabs), else the display name. */
  shortName: string
  color: string
}

export interface AssetCredit {
  title: string
  what: string
  author: string
  licence: string
  source: string
  changes: string
}

export interface LookPack {
  id: string
  name: string
  /** pack.json: the picker card's summary, the map picture (a file in the
   * pack, or "" when it is none or lives in an art set), the credit lines. */
  summary: string
  mapImage: string
  credits: string[]
  assetCredits: AssetCredit[]
  samples: Samples
  factions: Faction[]
  /** Every file the pack carries besides its 12 JSON files, sorted. */
  files: string[]
  /** The pack's look.json as it stands, or null when it has none. */
  look: LookFile | null
  ctx: LookContext
  /** A file the pack carries now (a face, a texture, the map picture). */
  file: (rel: string) => Uint8Array | undefined
  /** What the Sector window's theatre plate needs: the theatres, their holders, the map's place. */
  sector: SectorData
}

const strOf = (v: unknown): string => (v === null || v === undefined ? '' : gdStr(v))

/** The look.json the pack carries now, measured against the one last saved. */
export function lookFileOf(doc: PackDocument): LookFile | null {
  const now = doc.fileBytes(LOOK_FILE)
  return now ? LookFile.open(now, doc.savedBytes(LOOK_FILE)) : null
}

export function lookPack(doc: PackDocument, packDir = 'the pack folder'): LookPack {
  const pack = doc.value('pack.json')
  const id = strOf(ci(pack, 'id')) || doc.folderName || ''
  const list = ci(doc.value('factions.json'), 'factions')
  const factions: Faction[] = Array.isArray(list)
    ? list.map((f) => ({
        id: strOf(ci(f, 'id')),
        name: strOf(ci(f, 'display_name')),
        shortName: strOf(ci(f, 'short_name')) || strOf(ci(f, 'display_name')),
        color: strOf(ci(f, 'color'))
      }))
    : []
  const mapImage = strOf(ci(pack, 'map_image'))
  const creditsList = ci(pack, 'credits')
  const text = (rel: string): string | null => {
    const b = doc.fileBytes(rel)
    return b ? new TextDecoder().decode(b) : null
  }
  const assets = ci(parseJson(text('credits.json')), 'assets')
  return {
    id,
    name: strOf(ci(pack, 'display_name')) || id,
    summary: strOf(ci(pack, 'summary')),
    // "<art set>:<path>" names a picture in an art set, which the mock-ups do not read.
    mapImage: mapImage.includes(':') ? '' : mapImage,
    credits: Array.isArray(creditsList) ? creditsList.map(strOf) : [],
    assetCredits: Array.isArray(assets)
      ? assets.map((a) => ({
          title: strOf(ci(a, 'title')),
          what: strOf(ci(a, 'what')),
          author: strOf(ci(a, 'author')),
          licence: strOf(ci(a, 'licence')),
          source: strOf(ci(a, 'source')),
          changes: strOf(ci(a, 'changes'))
        }))
      : [],
    samples: readSamples({
      map: text('map.json'),
      characters: text('characters.json'),
      units: text('units.json'),
      facilities: text('facilities.json'),
      missions: text('missions.json'),
      display: text('display.json')
    }),
    factions,
    files: doc.otherFiles(),
    look: lookFileOf(doc),
    ctx: { packDir, factionIds: factions.map((f) => f.id), hasFile: (rel) => doc.hasFile(rel) },
    file: (rel) => doc.fileBytes(rel),
    sector: readSector({ pack, map: doc.value('map.json'), factions: doc.value('factions.json'), display: doc.value('display.json') })
  }
}

function parseJson(text: string | null): unknown {
  if (text === null) return undefined
  try {
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return undefined
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/**
 * One undoable change to the pack's look, with any files it brings (a face
 * chosen from disk). False when nothing changed. Changing a value back to what
 * the saved file has gives back the saved bytes, so the pack is clean again.
 * Changes with the same label in quick succession (a colour dragged, a size
 * typed) are one step for Undo.
 */
export function editLook(doc: PackDocument, label: string, fn: (l: LookFile) => void, files: [string, Uint8Array][] = []): boolean {
  const look = lookFileOf(doc)
  const before = doc.fileBytes(LOOK_FILE)
  if (!look || !before) return false
  fn(look)
  let after = look.toBytes()
  const saved = doc.savedBytes(LOOK_FILE)
  if (saved && sameBytes(saved, after)) after = saved
  const changed = after !== before && !sameBytes(before, after)
  if (!changed && files.length === 0) return false
  return doc.edit(
    label,
    (e) => {
      for (const [rel, bytes] of files) e.setFile(rel, bytes)
      if (changed) e.setFile(LOOK_FILE, after)
    },
    { merge: true }
  )
}

/** A look for a pack that has none: a new look.json, as one undoable change. */
export function createLook(doc: PackDocument, label: string, value: Record<string, unknown>): boolean {
  return doc.edit(label, (e) => e.setFile(LOOK_FILE, LookFile.fromValue(value).toBytes()))
}

/** Rule 31 on the pack's look.json as it stands: what the game would say, split
 * the way PackLoader.Load says it (reading first, then the checks). */
export function lookProblems(doc: PackDocument, ctx: LookContext): { read: string[]; checks: string[] } {
  const bytes = doc.fileBytes(LOOK_FILE)
  if (!bytes) return { read: [], checks: [] }
  const r = readLook(new TextDecoder().decode(bytes), ctx)
  if (r.errors.length || !r.look) return { read: r.errors, checks: [] }
  return { read: [], checks: validateLook(r.look, ctx) }
}
