// Where each kind of id is used across the pack, so a rename updates every
// reference and a delete can show what would break. Ids join by equal strings
// (SCHEMA.md Q1), so this is the whole graph.

import type { Editor, PackDocument } from './document'
import type { JSONPath } from './jsontext'
import { ci, isDict } from './model'
import type { PackJsonFile } from './vocab'

export type RefKind =
  | 'faction'
  | 'planet'
  | 'sector'
  | 'character'
  | 'unit'
  | 'weapon'
  | 'facility'
  | 'family'
  | 'mission'
  | 'missionTable'
  | 'logistics'
  | 'gidMode'
  | 'galaxySize'

export interface Usage {
  file: PackJsonFile
  /** For 'value': the path of the string equal to the id. For 'key': the object holding the id as a key. */
  path: JSONPath
  kind: 'value' | 'key'
  where: string
}

type Dict = Record<string, unknown>

/** The actual key in `d` matching `key` case-insensitively (the game's get_ci). */
function key(d: unknown, k: string): string | null {
  if (!isDict(d)) return null
  if (k in d) return k
  const lower = k.toLowerCase()
  return Object.keys(d).find((x) => x.toLowerCase() === lower) ?? null
}

function list(d: unknown, k: string): { arr: unknown[]; k: string } | null {
  const kk = key(d, k)
  if (kk === null) return null
  const v = (d as Dict)[kk]
  return Array.isArray(v) ? { arr: v, k: kk } : null
}

function rows(doc: PackDocument, file: PackJsonFile, listKey: string): { row: Dict; path: JSONPath }[] {
  const root = doc.value(file)
  const l = list(root, listKey)
  if (!l) return []
  return l.arr.map((row, i) => ({ row: row as Dict, path: [l.k, i] as JSONPath })).filter((r) => isDict(r.row))
}

const rowName = (row: Dict) => String(ci(row, 'id') ?? ci(row, 'EntryId') ?? '?')

export function findUsages(doc: PackDocument, kind: RefKind, id: string): Usage[] {
  const out: Usage[] = []
  const valueAt = (file: PackJsonFile, parent: unknown, parentPath: JSONPath, k: string, where: string) => {
    const kk = key(parent, k)
    if (kk !== null && (parent as Dict)[kk] === id) out.push({ file, path: [...parentPath, kk], kind: 'value', where })
  }
  const inList = (file: PackJsonFile, parent: unknown, parentPath: JSONPath, k: string, where: string) => {
    const l = list(parent, k)
    if (!l) return
    l.arr.forEach((v, i) => {
      if (v === id) out.push({ file, path: [...parentPath, l.k, i], kind: 'value', where })
    })
  }
  const keyIn = (file: PackJsonFile, parent: unknown, parentPath: JSONPath, k: string | null, where: string) => {
    const obj = k === null ? parent : isDict(parent) && key(parent, k) !== null ? (parent as Dict)[key(parent, k)!] : undefined
    const objPath = k === null ? parentPath : [...parentPath, key(parent, k)!]
    if (isDict(obj) && Object.prototype.hasOwnProperty.call(obj, id)) out.push({ file, path: objPath, kind: 'key', where })
  }

  switch (kind) {
    case 'faction': {
      for (const { row, path } of rows(doc, 'characters.json', 'characters')) valueAt('characters.json', row, path, 'faction', `character ${rowName(row)}`)
      for (const [file, lk, what] of [
        ['units.json', 'units', 'buildable_by'],
        ['facilities.json', 'facilities', 'buildable_by'],
        ['missions.json', 'missions', 'available_to']
      ] as const)
        for (const { row, path } of rows(doc, file, lk)) inList(file, row, path, what, `${lk.slice(0, -1)} ${rowName(row)} ${what}`)
      inList('display.json', doc.value('display.json'), [], 'loyalty_bar', 'display loyalty_bar')
      menuRegions(doc, 'start', id, out)
      const rules = doc.value('rules.json')
      if (Array.isArray(rules))
        rules.forEach((r, i) => {
          if (isDict(r)) keyIn('rules.json', r, [i], 'by_faction', `rule ${String(ci(r, 'EntryId'))}`)
        })
      for (const { row, path } of rows(doc, 'setup.json', 'side_lottery')) {
        const where = `side lottery ${String(ci(row, 'EntryId'))}`
        const bfK = key(row, 'by_faction')
        if (bfK) {
          const bf = row[bfK]
          keyIn('setup.json', row, path, 'by_faction', where)
          if (isDict(bf))
            for (const persp of Object.keys(bf)) {
              const byDiff = bf[persp]
              if (isDict(byDiff)) for (const d of Object.keys(byDiff)) keyIn('setup.json', byDiff[d], [...path, bfK, persp, d], null, where)
            }
        }
        keyIn('setup.json', row, path, 'dev', where)
        keyIn('setup.json', row, path, 'mp', where)
      }
      break
    }
    case 'planet':
      for (const { row, path } of rows(doc, 'factions.json', 'factions')) {
        const sp = list(row, 'starting_planets')
        sp?.arr.forEach((s, i) => valueAt('factions.json', s, [...path, sp.k, i], 'planet', `faction ${rowName(row)} starting planet`))
        const hqK = key(row, 'hq')
        if (hqK) {
          valueAt('factions.json', row[hqK], [...path, hqK], 'planet', `faction ${rowName(row)} hq`)
          valueAt('factions.json', row[hqK], [...path, hqK], 'placement', `faction ${rowName(row)} hq placement`)
        }
      }
      for (const { row, path } of rows(doc, 'characters.json', 'characters')) valueAt('characters.json', row, path, 'starts_at', `character ${rowName(row)} starts_at`)
      break
    case 'sector':
      for (const { row, path } of rows(doc, 'map.json', 'planets')) valueAt('map.json', row, path, 'sector', `planet ${rowName(row)}`)
      break
    case 'character':
      for (const { row, path } of rows(doc, 'factions.json', 'factions')) {
        const vK = key(row, 'victory')
        if (vK) inList('factions.json', row[vK], [...path, vK], 'capture_characters', `faction ${rowName(row)} victory`)
      }
      break
    case 'unit':
      for (const { row, path } of rows(doc, 'missions.json', 'missions')) inList('missions.json', row, path, 'spec_forces', `mission ${rowName(row)} spec_forces`)
      logisticsAssets(doc, 'unit', id, out)
      break
    case 'facility':
      logisticsAssets(doc, 'facility', id, out)
      break
    case 'weapon':
      for (const { row, path } of rows(doc, 'units.json', 'units')) keyIn('units.json', row, path, 'weapons', `unit ${rowName(row)} weapons`)
      break
    case 'family':
      for (const { row, path } of rows(doc, 'facilities.json', 'facilities')) valueAt('facilities.json', row, path, 'family', `facility ${rowName(row)}`)
      gidModes(doc, (mode, mpath) => {
        const q = key(mode, 'quantity')
        if (q && isDict(mode[q]) && ci(mode[q], 'kind') === 'facility_count') valueAt('display.json', mode[q], [...mpath, q], 'family', `GID mode ${String(ci(mode, 'id'))}`)
      })
      break
    case 'mission':
    case 'missionTable':
      keyIn('mission_tables.json', doc.value('mission_tables.json'), [], 'tables', 'mission outcome table')
      break
    case 'logistics':
      for (const { row, path } of rows(doc, 'factions.json', 'factions')) {
        const sK = key(row, 'seed')
        if (sK)
          for (const k of ['hq_facilities', 'hq_garrison', 'fleet', 'procedural_fleet'])
            valueAt('factions.json', row[sK], [...path, sK], k, `faction ${rowName(row)} seed.${k}`)
        const sp = list(row, 'starting_planets')
        sp?.arr.forEach((s, i) => valueAt('factions.json', s, [...path, sp.k, i], 'garrison', `faction ${rowName(row)} starting planet garrison`))
      }
      break
    case 'gidMode':
      inList('display.json', doc.value('display.json'), [], 'galaxy_display_modes', 'Alt+N display slots')
      break
    case 'galaxySize': {
      for (const { row, path } of rows(doc, 'map.json', 'sectors')) valueAt('map.json', row, path, 'min_size', `sector ${rowName(row)}`)
      const pv = doc.value('pack.json')
      const sK = key(pv, 'setup')
      if (sK) valueAt('pack.json', (pv as Dict)[sK], [sK], 'galaxy_size_default', 'default galaxy size')
      menuRegions(doc, 'galaxy_size', id, out)
      break
    }
  }
  return out
}

function menuRegions(doc: PackDocument, action: string, id: string, out: Usage[]): void {
  const pv = doc.value('pack.json')
  const mK = key(pv, 'menu')
  if (!mK) return
  const menu = (pv as Dict)[mK]
  const rl = list(menu, 'regions')
  rl?.arr.forEach((r, i) => {
    if (!isDict(r) || ci(r, 'action') !== action) return
    const vK = key(r, 'value')
    if (vK && r[vK] === id) out.push({ file: 'pack.json', path: [mK, rl.k, i, vK], kind: 'value', where: `Cockpit menu region ${i}` })
  })
}

function logisticsAssets(doc: PackDocument, which: 'unit' | 'facility', id: string, out: Usage[]): void {
  const sv = doc.value('setup.json')
  const lK = key(sv, 'logistics')
  if (!lK) return
  const logistics = (sv as Dict)[lK]
  if (!isDict(logistics)) return
  for (const tid of Object.keys(logistics)) {
    const table = logistics[tid]
    const el = list(table, 'Entries')
    el?.arr.forEach((e, i) => {
      if (!isDict(e)) return
      const base: JSONPath = [lK, tid, el.k, i]
      const aK = key(e, 'Asset')
      if (aK && isDict(e[aK]) && ci(e[aK], which) === id) out.push({ file: 'setup.json', path: [...base, aK, key(e[aK], which)!], kind: 'value', where: `logistics ${tid} entry ${i + 1}` })
      const al = list(e, 'Assets')
      al?.arr.forEach((a, j) => {
        if (isDict(a) && ci(a, which) === id) out.push({ file: 'setup.json', path: [...base, al.k, j, key(a, which)!], kind: 'value', where: `logistics ${tid} entry ${i + 1}` })
      })
    })
  }
}

function gidModes(doc: PackDocument, fn: (mode: Dict, path: JSONPath) => void): void {
  const dv = doc.value('display.json')
  const cl = list(dv, 'categories')
  cl?.arr.forEach((c, ci_) => {
    const ml = list(c, 'modes')
    ml?.arr.forEach((m, mi) => {
      if (isDict(m)) fn(m, [cl.k, ci_, ml.k, mi])
    })
  })
}

/** Rewrites every usage of `oldId` to `newId`. The record's own id is the caller's job. */
export function renameUsages(doc: PackDocument, e: Editor, kind: RefKind, oldId: string, newId: string): number {
  const usages = findUsages(doc, kind, oldId)
  // Keys first, deepest paths first, so earlier edits never move later paths.
  for (const u of usages.filter((x) => x.kind === 'key').sort((a, b) => b.path.length - a.path.length))
    e.renameKey(u.file, u.path, oldId, newId)
  for (const u of usages.filter((x) => x.kind === 'value')) e.set(u.file, u.path, newId)
  return usages.length
}
