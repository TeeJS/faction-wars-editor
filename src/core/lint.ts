// Editor-only WARNINGS: things the game's loader accepts but the engine needs,
// or that silently misbehave. Each one names where the engine depends on it
// (TeeJS/faction-wars paths) so an author can check the claim.

import type { PackDocument } from './document'
import { ci, hydrate, isDict, type LoadedPack } from './model'
import type { Issue } from './validate'
import {
  ENGINE_LOGISTICS_TABLES,
  ENGINE_MISSION_TABLES,
  FACILITY_STAT_KEYS,
  KNOWN_DIFFICULTIES,
  RATING_KEYS,
  SHIPPED_PACK_IDS,
  UNIT_STAT_KEYS
} from './vocab'

const ID_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/
const PACK_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export function lintPack(doc: PackDocument): Issue[] {
  // Lint needs every file parsed; the validator already reports anything missing.
  for (const f of ['pack.json', 'factions.json', 'map.json', 'setup.json'] as const) if (doc.value(f) === undefined) return []
  const { pack } = hydrate(doc)
  return lintLoaded(pack, doc)
}

export function lintLoaded(pack: LoadedPack, doc?: PackDocument): Issue[] {
  const out: Issue[] = []
  const warn = (message: string, page: string, index?: number, key?: string) =>
    out.push({ severity: 'warning', message, target: { page, index, key } })
  const m = pack.manifest

  // Pack identity vs the importer.
  if (!PACK_ID_RE.test(m.id))
    warn(`pack.json: id '${m.id}' must be 1-64 letters, digits, '-' or '_' - the game's importer refuses anything else.`, 'pack')
  if (SHIPPED_PACK_IDS.includes(m.id))
    out.push({
      severity: 'warning',
      message: `pack.json: this is the built-in '${m.id}' pack. To mod it, make your own copy with a new id - the game always uses its built-in '${m.id}', so an export under the same id would never load.`,
      target: { page: 'pack' },
      fix: { label: 'Make my own copy', action: 'makeCopy' }
    })
  if (m.displayName.trim() === '') warn('pack.json: display_name is empty - the pack picker card will have no title.', 'pack')
  if (m.neutral && m.neutral.displayName.trim() === '') warn('pack.json: neutral.display_name is empty.', 'pack')
  if (m.schemaVersion !== 1) warn(`pack.json: schema_version is ${m.schemaVersion}; write 1 (a missing or 0 version passes today but is not the contract).`, 'pack')

  // Galaxy sizes: Enums.GalaxySize {Standard, Large, Huge} indexes this list by position.
  const sizes = m.setup?.galaxySizes ?? []
  if (m.setup === null) warn("pack.json: no 'setup' - the game needs setup.galaxy_sizes (three sizes, smallest first).", 'pack')
  else if (sizes.length !== 3)
    warn(`pack.json: setup.galaxy_sizes lists ${sizes.length}; the engine indexes it as exactly three sizes (standard, large, huge), smallest first.`, 'pack')

  // Faction count: day zero places only the first two sides (day_zero_generator.gd:172-256).
  if (pack.factions.length > 2)
    warn(`factions.json: ${pack.factions.length} factions - the engine's day zero still places characters only for the first two sides; a third or fourth side passes validation but plays wrong.`, 'factions')

  for (const f of pack.factions) {
    // seed present -> day zero indexes hq_facilities, hq_garrison and fleet unconditionally.
    if (f.seed !== null)
      for (const [k, v] of [['hq_facilities', f.seed.hqFacilities], ['hq_garrison', f.seed.hqGarrison], ['fleet', f.seed.fleet]] as const)
        if (v === '') warn(`factions.json[${f.id}]: seed.${k} is empty - when 'seed' is present, day zero reads hq_facilities, hq_garrison and fleet.`, 'factions', f.index)
    if (f.startingPlanets.length === 0 && f.hq?.kind !== 'fixed')
      warn(`factions.json[${f.id}]: no starting_planets and no fixed hq - characters placed at the "first world" have nowhere to go.`, 'factions', f.index)
    for (const sp of f.startingPlanets)
      if (sp.support < 0 || sp.support > 100) warn(`factions.json[${f.id}]: starting planet '${sp.planet}' support ${sp.support} is outside 0-100.`, 'factions', f.index)
    if (!ID_RE.test(f.id)) warn(`factions.json[${f.id}]: id should be lower_snake_case.`, 'factions', f.index)
  }

  // Logistics tables the engine reads by name.
  for (const t of ENGINE_LOGISTICS_TABLES)
    if (!Object.prototype.hasOwnProperty.call(pack.setup.logistics, t))
      warn(`setup.json: logistics has no '${t}' table - day zero reads it by name to furnish systems.`, 'logistics')
  for (const [tid, table] of Object.entries(pack.setup.logistics)) {
    if (!isDict(table)) continue
    const fr = ci(table, 'fixed_range')
    if (fr !== undefined && fr !== null) {
      const ruleIds = new Set(pack.rules.map((r) => (isDict(r) ? Number(ci(r, 'EntryId')) : NaN)))
      if (!Array.isArray(fr) || fr.length !== 2) warn(`setup.json logistics[${tid}]: fixed_range must be [first rule EntryId, max rule EntryId].`, 'logistics', undefined, tid)
      else for (const id of fr) if (!ruleIds.has(Number(id))) warn(`setup.json logistics[${tid}]: fixed_range names rule ${id}, which rules.json does not have.`, 'logistics', undefined, tid)
    }
    commentKeys(table, `setup.json logistics[${tid}]`, 'logistics', warn, tid)
  }

  // Mission tables the engine reads by name. (A mission with no outcome table of its
  // own id is fine: MissionManager.SuccessPercent falls back to the fitted formula.)
  for (const t of ENGINE_MISSION_TABLES)
    if (!pack.missionTables[t]) warn(`mission_tables.json: no '${t}' table - the engine looks it up by name and gets -1 without it.`, 'missionTables')
  for (const ms of pack.missions) {
    if (ms.availableTo.length === 0)
      warn(`missions.json[${ms.id}]: available_to is empty, which means NOBODY can run it (not everybody).`, 'missions', ms.index)
    for (const uid of ms.specForces) {
      const u = pack.units.find((x) => x.id === uid)
      if (u && u.kind !== 'spec_force') warn(`missions.json[${ms.id}]: spec_forces names '${uid}', a ${u.kind} rather than a spec_force.`, 'missions', ms.index)
    }
  }
  for (const t of Object.values(pack.missionTables)) {
    for (let i = 1; i < t.entries.length; i++)
      if (t.entries[i].threshold < t.entries[i - 1].threshold) {
        warn(`mission_tables.json[${t.id}]: entries must ascend by Threshold (a step function); entry ${i + 1} is lower than entry ${i}.`, 'missionTables', undefined, t.id)
        break
      }
  }

  // Rules and side lottery: every faction and difficulty has a cell.
  const factionIds = pack.factions.map((f) => f.id)
  let missingRuleCells = 0
  let firstRule = ''
  const entryIds = new Set<number>()
  pack.rules.forEach((r) => {
    if (!isDict(r)) return
    const id = Number(ci(r, 'EntryId'))
    if (entryIds.has(id)) warn(`rules.json: EntryId ${id} appears twice - the engine keeps one.`, 'rules')
    entryIds.add(id)
    const bf = ci(r, 'by_faction')
    for (const fid of factionIds)
      for (const d of KNOWN_DIFFICULTIES) {
        const cell = isDict(bf) ? ci(ci(bf, fid), d) : undefined
        if (typeof cell !== 'number') {
          missingRuleCells++
          if (!firstRule) firstRule = `EntryId ${id} ${fid}.${d}`
        }
      }
  })
  if (missingRuleCells > 0)
    warn(`rules.json: ${missingRuleCells} by_faction cells are missing (first: ${firstRule}); a missing cell silently reads as 0.`, 'rules')
  let missingLottery = 0
  for (const row of pack.setup.sideLottery) {
    if (!isDict(row)) continue
    const bf = ci(row, 'by_faction')
    for (const persp of factionIds)
      for (const d of KNOWN_DIFFICULTIES)
        for (const fid of factionIds) if (typeof ci(ci(ci(bf, persp), d), fid) !== 'number') missingLottery++
  }
  if (missingLottery > 0) warn(`setup.json: ${missingLottery} side_lottery cells are missing - every perspective x difficulty x faction needs a number.`, 'sideLottery')

  // Stat and rating keys the engine does not read (a typo silently does nothing).
  for (const u of pack.units) {
    const known = UNIT_STAT_KEYS[u.kind] ?? []
    for (const k of Object.keys(u.stats))
      if (!k.startsWith('_') && known.length && !known.includes(k)) warn(`units.json[${u.id}]: stat '${k}' is not one the engine reads for a ${u.kind}.`, 'units', u.index)
    commentKeys(u.stats, `units.json[${u.id}] stats`, 'units', warn, undefined, u.index)
    if (!ID_RE.test(u.id)) warn(`units.json[${u.id}]: id should be lower_snake_case (no '.' or ':').`, 'units', u.index)
  }
  for (const fd of pack.facilities) {
    for (const k of Object.keys(fd.stats))
      if (!k.startsWith('_') && !FACILITY_STAT_KEYS.includes(k)) warn(`facilities.json[${fd.id}]: stat '${k}' is not one the engine reads.`, 'facilities', fd.index)
    commentKeys(fd.stats, `facilities.json[${fd.id}] stats`, 'facilities', warn, undefined, fd.index)
  }
  for (const ch of pack.characters) {
    for (const k of Object.keys(ch.ratings))
      if (!RATING_KEYS.includes(k)) warn(`characters.json[${ch.id}]: rating '${k}' is not one the engine reads.`, 'characters', ch.index)
    if (!ID_RE.test(ch.id)) warn(`characters.json[${ch.id}]: id should be lower_snake_case (no '.' or ':').`, 'characters', ch.index)
  }
  for (const p of pack.planets) if (!ID_RE.test(p.id)) warn(`map.json planets[${p.id}]: id should be lower_snake_case (no '.' or ':').`, 'planets', p.index)

  // Display names the loader collects but never checks for clashes.
  dupNames(pack.planets, 'map.json planets', 'planets', warn)
  dupNames(pack.characters, 'characters.json', 'characters', warn)

  // GID facility_count must name a real family.
  const families = new Set(pack.facilities.map((f) => f.family))
  for (const cat of pack.display.categories)
    for (const md of cat.modes)
      if (md.kind === 'facility_count') {
        const fam = String(md.args['family'] ?? '')
        if (!families.has(fam)) warn(`display.json modes[${md.id}]: facility_count family '${fam}' is not a facility family.`, 'display', cat.index, 'categories')
      }

  // The leak guard refuses these on export and on import.
  if (doc)
    for (const f of doc.otherFiles())
      if (f.toLowerCase().startsWith('original/'))
        out.push({
          severity: 'warning',
          message: `${f}: not pack content (it belongs to the original game) - the game won't import a pack that carries an original/ folder, so it has to go before you export.`,
          target: { page: 'files' },
          fix: { label: 'Remove it', action: 'removeFile', arg: f }
        })

  // Menu credits live under menu; a top-level 'credits' is never read.
  if (doc) {
    const pv = doc.value('pack.json')
    if (isDict(pv) && ci(pv, 'credits') !== undefined && m.menu === null)
      warn("pack.json: top-level 'credits' is never read - the game reads only menu.credits.", 'pack')
  }

  // Hyperdrive 0 on something that must jump.
  for (const u of pack.units)
    if ((u.kind === 'capital_ship') && typeof u.stats['hyperdrive'] === 'number' && u.stats['hyperdrive'] === 0)
      warn(`units.json[${u.id}]: hyperdrive 0 means the ship can never jump.`, 'units', u.index)

  return out
}

function commentKeys(
  d: unknown,
  ctx: string,
  page: string,
  warn: (m: string, p: string, i?: number, k?: string) => void,
  key?: string,
  index?: number
): void {
  if (!isDict(d)) return
  for (const k of Object.keys(d))
    if (k.startsWith('_')) warn(`${ctx}: '${k}' is read as data here - '_' keys are skipped only in display.json terms and icons.`, page, index, key)
}

function dupNames(list: { displayName: string; id: string; index: number }[], ctx: string, page: string, warn: (m: string, p: string, i?: number) => void): void {
  const seen = new Map<string, string>()
  for (const r of list) {
    if (r.displayName === '') continue
    const prev = seen.get(r.displayName)
    if (prev !== undefined) warn(`${ctx}[${r.id}]: display_name '${r.displayName}' is also '${prev}'s - players cannot tell them apart.`, page, r.index)
    else seen.set(r.displayName, r.id)
  }
}
