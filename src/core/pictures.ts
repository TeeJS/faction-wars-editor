// Where the game looks for a record's pictures (TeeJS/faction-wars
// src/ui/artwork.gd): the pack's own art/ first, by the row's own kind and id;
// then each declared art set, by the row the `art` reference names (the row
// itself when it names none, and only that set when it names one).
// Side pictures are keyed by the faction's skin, or its id when it has none
// (faction.gd:40).

import type { PackDocument, Editor } from './document'
import { JsonText } from './jsontext'
import type { LoadedPack } from './model'
import { parseArtRef } from './validate'

export type PictureKind = 'characters' | 'units' | 'facilities' | 'missions' | 'planets'

export interface PictureSlot {
  key: string
  label: string
  /** The path inside the pack where an author's own picture goes. */
  own: string
  /** Where the art set has it, as "<set>:<path>" candidates in lookup order. */
  set: string[]
  /** The original's size, when it has one (a hint, not a rule). */
  size?: [number, number]
  note?: string
}

/** The row's art-set identity: [set ('' = any declared), kind, id]. */
export function alias(pack: LoadedPack, kind: PictureKind, id: string, artRef: string): [string, string, string] {
  if (artRef) {
    const parsed = parseArtRef(artRef, pack.manifest.artSets)
    if (parsed) return parsed
  }
  return ['', kind, id]
}

function setCandidates(pack: LoadedPack, set: string, rel: string): string[] {
  const sets = set ? [set] : pack.manifest.artSets
  return sets.map((s) => `${s}:${rel}`)
}

/** The side keys pictures use: each faction's skin, or its id. */
export function sideKeys(pack: LoadedPack): string[] {
  return [...new Set(pack.factions.map((f) => f.skin || f.id))]
}

export function pictureSlots(pack: LoadedPack, kind: PictureKind, id: string, artRef = '', artworkId = 0): PictureSlot[] {
  const [set, aKind, aId] = alias(pack, kind, id, artRef)
  const slot = (key: string, label: string, fmt: string, size?: [number, number], note?: string): PictureSlot => ({
    key,
    label,
    own: 'art/' + fmt.replace('{k}', kind).replace('{i}', id),
    set: setCandidates(pack, set, fmt.replace('{k}', aKind).replace('{i}', aId)),
    size,
    note
  })
  const out: PictureSlot[] = []
  if (kind === 'missions') {
    for (const side of sideKeys(pack)) {
      out.push(slot(`big-${side}`, `Mission picture (${side})`, `{k}/{i}.${side}.png`))
      out.push(slot(`card-${side}`, `Create Mission card (${side})`, `{k}/{i}.${side}.small.png`, [130, 65]))
    }
    out.push(slot('big', 'Mission picture (any side)', '{k}/{i}.png', undefined, 'Used for a side that has no picture of its own.'))
    return out
  }
  out.push(slot('encyclopedia', 'Encyclopedia picture', '{k}/{i}.png'))
  if (kind === 'planets') {
    if (artworkId > 0)
      out.push({
        key: 'sprite',
        label: `Planet sprite #${artworkId}`,
        own: `art/planet_sprites/${artworkId}.png`,
        set: pack.manifest.artSets.map((s) => `${s}:planet_sprites/${artworkId}.png`),
        note: `Shared by every planet whose sprite number is ${artworkId}.`
      })
    return out
  }
  out.push(slot('portrait', 'Portrait', 'portraits/{k}/{i}.png', [80, 80]))
  out.push(slot('miniature', 'List miniature', 'miniatures/{k}/{i}.png', [61, 25]))
  return out
}

// ---- Encyclopedia text: art/descriptions.json, { kind: { id: text } } ----

export const DESCRIPTIONS = 'art/descriptions.json'

export function readDescription(doc: PackDocument, kind: PictureKind, id: string): string {
  const bytes = doc.fileBytes(DESCRIPTIONS)
  if (!bytes) return ''
  const v = JsonText.fromBytes(bytes).get([kind, id])
  return typeof v === 'string' ? v : ''
}

/** Writes (or, for empty text, removes) a row's description with a minimal edit. */
export function writeDescription(doc: PackDocument, e: Editor, kind: PictureKind, id: string, text: string): void {
  const bytes = doc.fileBytes(DESCRIPTIONS)
  const t = bytes ? JsonText.fromBytes(bytes) : JsonText.fromValue({})
  if (text === '') t.remove([kind, id])
  else t.set([kind, id], text)
  e.setFile(DESCRIPTIONS, t.toBytes())
}

/** Reads a PNG's size from its header, or null when it is not a PNG. */
export function pngSize(bytes: Uint8Array): [number, number] | null {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  if (bytes.length < 24 || !sig.every((b, i) => bytes[i] === b)) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return [dv.getUint32(16), dv.getUint32(20)]
}
