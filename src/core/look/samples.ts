// Names from the pack itself, so a mock-up reads like that pack's game: its
// sectors, worlds, characters, units, facilities and missions. Where a file
// is missing or has none, plain placeholders stand in.

import { ci, gdStr } from './godot'

export interface Samples {
  sectors: string[]
  planets: { name: string; sector: string }[]
  characters: { name: string; faction: string }[]
  units: { name: string; kind: string }[]
  facilities: string[]
  missions: string[]
  /** display.json `terms`: the pack's own words for the game's labels. */
  terms: Record<string, string>
}

function parse(text: string | null | undefined): unknown {
  if (!text) return undefined
  try {
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch {
    return undefined
  }
}

function rows(text: string | null | undefined, key: string): unknown[] {
  const list = ci(parse(text), key)
  return Array.isArray(list) ? list : []
}

const name = (r: unknown): string => {
  const v = ci(r, 'display_name') ?? ci(r, 'id')
  return v === undefined || v === null ? '' : gdStr(v)
}
const field = (r: unknown, k: string): string => {
  const v = ci(r, k)
  return v === undefined || v === null ? '' : gdStr(v)
}

const or = <T>(list: T[], fallback: T[]): T[] => (list.length ? list : fallback)

export interface SampleFiles {
  map?: string | null
  characters?: string | null
  units?: string | null
  facilities?: string | null
  missions?: string | null
  display?: string | null
}

function termsOf(text: string | null | undefined): Record<string, string> {
  const t = ci(parse(text), 'terms')
  const out: Record<string, string> = {}
  if (t && typeof t === 'object' && !Array.isArray(t))
    for (const [k, v] of Object.entries(t as Record<string, unknown>)) if (!k.startsWith('_') && typeof v === 'string') out[k] = v
  return out
}

export function readSamples(files: SampleFiles): Samples {
  const sectorRows = rows(files.map, 'sectors')
  const sectorNames = new Map(sectorRows.map((s) => [field(s, 'id'), name(s)]))
  return {
    sectors: or(sectorRows.map(name).filter(Boolean), ['Sector One', 'Sector Two', 'Sector Three', 'Sector Four']),
    planets: or(
      rows(files.map, 'planets')
        .map((p) => ({ name: name(p), sector: sectorNames.get(field(p, 'sector')) ?? field(p, 'sector') }))
        .filter((p) => p.name),
      ['World A', 'World B', 'World C', 'World D', 'World E'].map((n) => ({ name: n, sector: 'Sector One' }))
    ),
    characters: or(
      rows(files.characters, 'characters')
        .map((c) => ({ name: name(c), faction: field(c, 'faction') }))
        .filter((c) => c.name),
      ['Commander A', 'Commander B', 'Agent C'].map((n) => ({ name: n, faction: '' }))
    ),
    units: or(
      rows(files.units, 'units')
        .map((u) => ({ name: name(u), kind: field(u, 'kind') }))
        .filter((u) => u.name),
      ['Capital Ship', 'Fighter Squadron', 'Troop Regiment'].map((n) => ({ name: n, kind: '' }))
    ),
    facilities: or(rows(files.facilities, 'facilities').map(name).filter(Boolean), ['Mine', 'Refinery', 'Shipyard']),
    missions: or(rows(files.missions, 'missions').map(name).filter(Boolean), ['Diplomacy', 'Recruitment', 'Espionage']),
    terms: termsOf(files.display)
  }
}
