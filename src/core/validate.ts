// A line-for-line port of the game's validator (TeeJS/faction-wars
// src/data/pack_loader.gd, PackLoader.Load/_validate). Same checks, same order,
// same message text, so an error here is exactly what the game's pack picker
// would show. Editor-only warnings (engine requirements the loader does not
// check) live in lint.ts.

import type { PackDocument } from './document'
import { hydrate, isDict, ci, gdStr, type LoadedPack } from './model'
import { normalizePath } from './document'
import {
  ART_KINDS,
  KNOWN_ART_SETS,
  KNOWN_BEHAVIOURS,
  KNOWN_CHARACTER_ROLES,
  KNOWN_COMMAND_RANKS,
  KNOWN_CORNER_ICONS,
  KNOWN_DIFFICULTIES,
  KNOWN_FACILITY_ROLES,
  KNOWN_GID_FLARES,
  KNOWN_GID_KINDS,
  KNOWN_HQ_KINDS,
  KNOWN_MENU_ACTIONS,
  KNOWN_OCCUPATION_POLICIES,
  KNOWN_TERMS,
  KNOWN_UNIT_KINDS,
  KNOWN_UNIT_ROLES,
  KNOWN_WEAPON_ROLES,
  PACK_JSON_FILES,
  SINGLETON_CHARACTER_ROLES,
  SPECIAL_POWER_RANK_KEYS,
  SUPPORTED_SCHEMA_VERSION
} from './vocab'

export type Severity = 'error' | 'warning'

/** Where an issue points, so the UI can jump to it. */
export interface IssueTarget {
  page: string
  index?: number
  key?: string
}

export interface Issue {
  severity: Severity
  message: string
  target?: IssueTarget
}

export interface ValidateOptions {
  /** How the pack folder is named in messages (the game prints its path). */
  packDirLabel?: string
}

const join = (a: readonly string[]) => a.join(', ')
const blank = (s: string) => s.trim().length === 0

/** Mirrors PackLoader.SplitArtRef: "<set>:<path>" -> [set, path]; a plain name -> ["", name]. */
export function splitArtRef(ref: string): [string, string] {
  const colon = ref.indexOf(':')
  if (colon <= 0 || ref.includes('://') || ref.slice(0, colon).includes('/')) return ['', ref]
  return [ref.slice(0, colon), ref.slice(colon + 1)]
}

/** Mirrors PackLoader.ParseArtRef: [set, kind, id], or null when malformed. */
export function parseArtRef(ref: string, sets: string[]): [string, string, string] | null {
  const [set, path] = splitArtRef(ref)
  if (set && !sets.includes(set)) return null
  const parts = path.split('/')
  if (parts.length !== 2 || !ART_KINDS.includes(parts[0]) || blank(parts[1])) return null
  return [set, parts[0], parts[1]]
}

function isHex(ch: string): boolean {
  return /^[0-9a-fA-F]$/.test(ch)
}

class Collector {
  issues: Issue[] = []
  constructor(private target?: IssueTarget) {}
  err(message: string, target?: IssueTarget): void {
    this.issues.push({ severity: 'error', message, target: target ?? this.target })
  }
}

function requireColor(value: string, ctx: string, c: Collector, target?: IssueTarget): void {
  if (blank(value)) {
    c.err(`${ctx}: missing.`, target)
    return
  }
  let ok = value.length === 7 && value[0] === '#'
  if (ok) for (let i = 1; i < 7; i++) if (!isHex(value[i])) ok = false
  if (!ok) c.err(`${ctx}: '${value}' is not a #rrggbb color.`, target)
}

/**
 * The game's full load-and-validate pass. Returns the issues the game would report
 * (all severity 'error'), plus shape faults that would crash the game's hydrator.
 */
export function validatePack(doc: PackDocument, opts: ValidateOptions = {}): Issue[] {
  const c = new Collector()
  const packDir = opts.packDirLabel ?? 'the pack folder'

  // PackLoader.Load: every file must be present and parse; any failure stops there.
  let missing = false
  for (const f of PACK_JSON_FILES) {
    const t = doc.text(f)
    if (!t) {
      c.err(`${f}: missing or empty.`, { page: pageForFile(f) })
      missing = true
    } else if (t.problem) {
      c.err(`${f}: ${t.problem.message}`, { page: pageForFile(f) })
      missing = true
    } else if (f !== 'rules.json' && !isDict(t.value)) {
      // Godot's from_dict(d: Dictionary) would fail on a top-level list or value.
      c.err(`${f}: the file must be a JSON object.`, { page: pageForFile(f) })
      missing = true
    }
  }
  if (missing) return c.issues

  const { pack, problems } = hydrate(doc)
  for (const p of problems) c.err(p.message, { page: pageForFile(p.file) })
  runValidate(pack, doc.folderName ?? pack.manifest.id, packDir, (p) => doc.hasFile(normalizePath(p)), c)
  return c.issues
}

/** PackLoader._validate, on an already-hydrated pack. `hasFile` answers for pack-relative paths. */
export function runValidate(
  pack: LoadedPack,
  folder: string,
  packDir: string,
  hasFile: (rel: string) => boolean,
  c: Collector = new Collector()
): Issue[] {
  const m = pack.manifest
  const P = { page: 'pack' }

  // 1. Manifest identity and version.
  if (m.id !== folder) c.err(`pack.json: id '${m.id}' does not match folder name '${folder}'.`, P)
  if (m.schemaVersion > SUPPORTED_SCHEMA_VERSION)
    c.err(`pack.json: schema_version ${m.schemaVersion} is newer than this engine supports (${SUPPORTED_SCHEMA_VERSION}).`, P)

  // 2. Faction count, 2-4, and matching the declared count.
  const count = pack.factions.length
  if (count < 2 || count > 4) c.err(`factions.json: ${count} factions declared; must be 2-4.`, { page: 'factions' })
  if (m.factionCount !== count) c.err(`pack.json: faction_count is ${m.factionCount} but factions.json declares ${count}.`, P)

  if (m.neutral === null || blank(m.neutral.id)) c.err("pack.json: 'neutral' must declare an id, display_name and color.", P)
  else requireColor(m.neutral.color, 'pack.json: neutral.color', c, P)
  requireColor(m.unexploredColor, 'pack.json: unexplored_color', c, P)

  const seen = new Set<string>()
  for (const f of pack.factions) {
    const ctx = `factions.json[${f.id !== '' ? f.id : '?'}]`
    const T = { page: 'factions', index: f.index }
    if (blank(f.id)) c.err(`${ctx}: missing id.`, T)
    else if (seen.has(f.id)) c.err(`${ctx}: duplicate id.`, T)
    else seen.add(f.id)
    if (m.neutral !== null && f.id === m.neutral.id)
      c.err(`${ctx}: id collides with the neutral id; neutral is not a playable faction.`, T)

    if (blank(f.displayName)) c.err(`${ctx}: missing display_name.`, T)
    if (blank(f.loyaltyLabel)) c.err(`${ctx}: missing loyalty_label.`, T)
    requireColor(f.color, `${ctx}: color`, c, T)

    if (f.occupationSupportPolicy !== '' && !KNOWN_OCCUPATION_POLICIES.includes(f.occupationSupportPolicy))
      c.err(`${ctx}: unknown occupation_support_policy '${f.occupationSupportPolicy}'. Known: ${join(KNOWN_OCCUPATION_POLICIES)}.`, T)

    // 6. HQ internal consistency.
    if (f.hq === null) c.err(`${ctx}: missing hq.`, T)
    else if (!KNOWN_HQ_KINDS.includes(f.hq.kind)) c.err(`${ctx}: unknown hq.kind '${f.hq.kind}'. Known: ${join(KNOWN_HQ_KINDS)}.`, T)
    else if (f.hq.kind === 'fixed' && blank(f.hq.planet)) c.err(`${ctx}: hq.kind 'fixed' requires hq.planet.`, T)
    else if (f.hq.kind === 'hidden' && blank(f.hq.placement))
      c.err(`${ctx}: hq.kind 'hidden' requires hq.placement (a planet name or 'random_rim').`, T)
  }

  validateMap(pack, packDir, hasFile, c)
  validateCharacters(pack, c)
  validateFacilities(pack, c)
  validateUnits(pack, c)
  validateMissions(pack, c)
  validateSetup(pack, c)
  validateDisplay(pack, c)
  validateMenu(pack, packDir, hasFile, c)
  validateIcons(pack, packDir, hasFile, c)
  validateRoles(pack, c)
  validateArt(pack, c)
  return c.issues
}

// Rule 12.
export function validateRoles(pack: LoadedPack, c: Collector): void {
  const storyCount = new Map<string, number>()
  for (const ch of pack.characters) {
    const ctx = `characters.json[${ch.id !== '' ? ch.id : '?'}]`
    for (const r of ch.roles) {
      if (!KNOWN_CHARACTER_ROLES.includes(r))
        c.err(`${ctx}: unknown role '${r}'. Known: ${join(KNOWN_CHARACTER_ROLES)}.`, { page: 'characters', index: ch.index })
      else if (SINGLETON_CHARACTER_ROLES.includes(r)) storyCount.set(r, (storyCount.get(r) ?? 0) + 1)
    }
  }
  for (const [r, n] of storyCount)
    if (n > 1) c.err(`characters.json: ${n} characters carry the story role '${r}'; the set-pieces are written for one.`, { page: 'characters' })
  for (const u of pack.units) {
    const ctx = `units.json[${u.id !== '' ? u.id : '?'}]`
    for (const r of u.roles)
      if (!KNOWN_UNIT_ROLES.includes(r)) c.err(`${ctx}: unknown role '${r}'. Known: ${join(KNOWN_UNIT_ROLES)}.`, { page: 'units', index: u.index })
  }
  const seenB = new Map<string, string>()
  for (const ms of pack.missions) {
    if (ms.behaviour === '') continue
    const ctx = `missions.json[${ms.id !== '' ? ms.id : '?'}]`
    const T = { page: 'missions', index: ms.index }
    if (!KNOWN_BEHAVIOURS.includes(ms.behaviour)) c.err(`${ctx}: unknown behaviour '${ms.behaviour}'. Known: ${join(KNOWN_BEHAVIOURS)}.`, T)
    else if (seenB.has(ms.behaviour))
      c.err(`${ctx}: behaviour '${ms.behaviour}' is already '${seenB.get(ms.behaviour)}' - one mission per engine behaviour.`, T)
    else seenB.set(ms.behaviour, ms.id)
  }
}

// Rule 17.
export function validateIcons(pack: LoadedPack, packDir: string, hasFile: (p: string) => boolean, c: Collector): void {
  for (const key of Object.keys(pack.display.icons)) {
    const T = { page: 'display', key: 'icons' }
    if (!KNOWN_CORNER_ICONS.includes(key)) {
      c.err(`display.json: icons names '${key}', which is not a corner glyph. Known: ${join(KNOWN_CORNER_ICONS)}.`, T)
      continue
    }
    const file = pack.display.icons[key].trim()
    if (file === '' || !hasFile(file)) c.err(`display.json: icons['${key}'] = '${file}' is not in ${packDir}.`, T)
  }
}

// Rule 11 and the setup defaults.
export function validateMenu(pack: LoadedPack, packDir: string, hasFile: (p: string) => boolean, c: Collector): void {
  const setup = pack.manifest.setup
  const sizes = setup !== null ? setup.galaxySizes : []
  const P = { page: 'pack' }
  const M = { page: 'menu' }
  if (setup !== null && setup.galaxySizeDefault !== '' && !sizes.includes(setup.galaxySizeDefault))
    c.err(`pack.json: setup.galaxy_size_default '${setup.galaxySizeDefault}' is not one of setup.galaxy_sizes (${join(sizes)}).`, P)
  if (setup !== null && setup.difficultyDefault !== '' && !KNOWN_DIFFICULTIES.includes(setup.difficultyDefault))
    c.err(`pack.json: setup.difficulty_default '${setup.difficultyDefault}' is not one of ${join(KNOWN_DIFFICULTIES)}.`, P)
  const tips = pack.manifest.victoryTips
  if (tips !== null && (blank(tips.standard) || blank(tips.hqOnly)))
    c.err("pack.json victory_tips: 'standard' and 'hq_only' texts are both required (manual p162).", P)
  const menu = pack.manifest.menu
  if (menu === null) return
  if (blank(menu.image)) c.err("pack.json menu: 'image' is required - name the Cockpit picture shipped with the pack.", M)
  else if (splitArtRef(menu.image)[0] === '' && !hasFile(menu.image))
    c.err(`pack.json menu: image '${menu.image}' is not in ${packDir}.`, M)
  requireColor(menu.selectedColor, 'pack.json menu.selected_color', c, M)
  if (menu.readout === null) c.err("pack.json menu: 'readout' is required - the panel that shows Standard Game / Headquarters Only Victory.", M)
  else {
    const r = menu.readout.rect
    if (r.length !== 4 || r[2] <= 0 || r[3] <= 0) c.err('pack.json menu.readout: rect must be [x, y, w, h] with w and h > 0.', M)
    if (blank(menu.readout.standard) || blank(menu.readout.hqOnly))
      c.err("pack.json menu.readout: 'standard' and 'hq_only' texts are required.", M)
    requireColor(menu.readout.color, 'pack.json menu.readout.color', c, M)
  }

  const factionIds = pack.factions.map((f) => f.id)
  const seen = new Map<string, number>()
  for (const r of menu.regions) {
    const i = r.index
    const ctx = `pack.json menu.regions[${i}]`
    const T = { page: 'menu', index: i }
    if (!KNOWN_MENU_ACTIONS.includes(r.action)) {
      c.err(`${ctx}: action '${r.action}' is not one of ${join(KNOWN_MENU_ACTIONS)}.`, T)
      continue
    }
    if (r.rect.length !== 4 || r.rect[2] <= 0 || r.rect[3] <= 0) c.err(`${ctx} (${r.action}): rect must be [x, y, w, h] with w and h > 0.`, T)
    if (r.selectedColor !== '') requireColor(r.selectedColor, `${ctx} (${r.action}) selected_color`, c, T)
    let key = r.action
    if (r.action === 'difficulty') {
      if (!KNOWN_DIFFICULTIES.includes(r.value)) c.err(`${ctx}: difficulty value '${r.value}' is not one of ${join(KNOWN_DIFFICULTIES)}.`, T)
      key = `difficulty:${r.value}`
    } else if (r.action === 'galaxy_size') {
      if (!sizes.includes(r.value)) c.err(`${ctx}: galaxy_size value '${r.value}' is not one of pack.json setup.galaxy_sizes (${join(sizes)}).`, T)
      key = `galaxy_size:${r.value}`
    } else if (r.action === 'start') {
      if (!factionIds.includes(r.value)) c.err(`${ctx}: start value '${r.value}' is not a faction id in factions.json.`, T)
      key = `start:${r.value}`
    }
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }

  const required = ['load_game', 'credits', 'hq_only_victory', 'multiplayer', 'exit']
  for (const d of KNOWN_DIFFICULTIES) required.push(`difficulty:${d}`)
  for (const sz of sizes) required.push(`galaxy_size:${sz}`)
  for (const fid of factionIds) required.push(`start:${fid}`)
  for (const key of required) {
    const n = seen.get(key) ?? 0
    if (n === 0) c.err(`pack.json menu: no region for '${key}' - every Cockpit function needs one (manual p021, Fig. 2.2).`, M)
    else if (n > 1) c.err(`pack.json menu: '${key}' has ${n} regions; one each.`, M)
  }
}

// Rules 4, 8, 14, 16.
export function validateDisplay(pack: LoadedPack, c: Collector): void {
  const d = pack.display
  const modeIds = new Set<string>()
  for (const cat of d.categories) {
    const cctx = `display.json categories[${cat.id !== '' ? cat.id : '?'}]`
    const CT = { page: 'display', key: 'categories', index: cat.index }
    if (blank(cat.id)) c.err(`${cctx}: missing id.`, CT)
    if (cat.modes.length === 0) c.err(`${cctx}: declares no modes.`, CT)
    for (const md of cat.modes) {
      const ctx = `display.json modes[${md.id !== '' ? md.id : '?'}]`
      if (blank(md.id)) c.err(`${ctx}: missing id.`, CT)
      else if (modeIds.has(md.id)) c.err(`${ctx}: duplicate id.`, CT)
      else modeIds.add(md.id)
      if (blank(md.label)) c.err(`${ctx}: missing label.`, CT)
      if (!KNOWN_GID_KINDS.includes(md.kind)) c.err(`${ctx}: unknown quantity.kind '${md.kind}'. Known: ${join(KNOWN_GID_KINDS)}.`, CT)
      if (md.tiers.length === 0) c.err(`${ctx}: declares no tiers.`, CT)
      else {
        let prev = Infinity
        for (const t of md.tiers) {
          if (t.min > prev) c.err(`${ctx}: tiers must be ordered descending by min (${gdNum(t.min)} after ${gdNum(prev)}).`, CT)
          prev = t.min
          if (!KNOWN_GID_FLARES.includes(t.flare)) c.err(`${ctx}: unknown flare '${t.flare}'. Known: ${join(KNOWN_GID_FLARES)}.`, CT)
        }
        if (md.tiers[md.tiers.length - 1].min !== 0)
          c.err(`${ctx}: the last tier must have min 0 - it is the bare dot every world falls into.`, CT)
      }
    }
  }
  const D = { page: 'display' }
  for (const id of d.galaxyDisplayModes)
    if (!modeIds.has(id)) c.err(`display.json: galaxy_display_modes names '${id}', which no category declares.`, D)
  for (const key of SPECIAL_POWER_RANK_KEYS)
    if (!Object.prototype.hasOwnProperty.call(d.specialPowerRanks, key)) c.err(`display.json: special_power_ranks has no label for '${key}'.`, D)
  if (d.loyaltyBar.length > 0) {
    const factionIds = pack.factions.map((f) => f.id)
    for (const id of d.loyaltyBar) {
      if (!factionIds.includes(id)) c.err(`display.json: loyalty_bar names '${id}', which is not a faction id.`, D)
      else if (d.loyaltyBar.filter((x) => x === id).length > 1) c.err(`display.json: loyalty_bar names '${id}' more than once.`, D)
    }
    for (const id of factionIds)
      if (!d.loyaltyBar.includes(id))
        c.err(`display.json: loyalty_bar leaves out '${id}' - name every faction, or leave the key out for faction order.`, D)
  }
  for (const key of Object.keys(d.terms)) {
    if (!KNOWN_TERMS.includes(key)) c.err(`display.json: terms names '${key}', which the engine has no concept for. Known: ${join(KNOWN_TERMS)}.`, D)
    else if (blank(d.terms[key])) c.err(`display.json: terms['${key}'] is empty - leave the key out to take the engine's default.`, D)
  }
}

/** Godot's str() of a float. */
function gdNum(n: number): string {
  if (n === Infinity) return 'inf'
  return Number.isInteger(n) ? `${n}.0` : String(n)
}

// Rules 3 and 13 for setup.
export function validateSetup(pack: LoadedPack, c: Collector): void {
  if (pack.rules.length === 0) c.err('rules.json: no rule entries.', { page: 'rules' })
  if (pack.setup.sideLottery.length === 0) c.err("setup.json: 'side_lottery' is empty.", { page: 'sideLottery' })
  for (const f of pack.factions) {
    const named: string[] = []
    if (f.seed !== null)
      for (const v of [f.seed.hqFacilities, f.seed.hqGarrison, f.seed.fleet, f.seed.proceduralFleet]) if (v !== '') named.push(v)
    for (const sp of f.startingPlanets) if (sp.garrison !== '') named.push(sp.garrison)
    for (const id of named)
      if (!Object.prototype.hasOwnProperty.call(pack.setup.logistics, id))
        c.err(`factions.json[${f.id}]: names logistics table '${id}', which setup.json does not declare.`, { page: 'factions', index: f.index })
  }

  const unitIds = new Set(pack.units.map((u) => u.id))
  const facilityIds = new Set(pack.facilities.map((f) => f.id))
  for (const tableId of Object.keys(pack.setup.logistics)) {
    const table = pack.setup.logistics[tableId]
    if (!isDict(table)) continue
    const entries = ci(table, 'Entries')
    if (!Array.isArray(entries)) continue
    entries.forEach((e, i) => {
      if (!isDict(e)) return
      const assets: unknown[] = []
      const one = ci(e, 'Asset')
      if (one !== null && one !== undefined) assets.push(one)
      const many = ci(e, 'Assets')
      if (Array.isArray(many)) assets.push(...many)
      for (const a of assets) {
        const ctx = `setup.json logistics[${tableId}] entry ${i + 1}`
        const T = { page: 'logistics', key: tableId, index: i }
        if (a === null) continue
        if (!isDict(a)) {
          c.err(`${ctx}: asset is not an object.`, T)
          continue
        }
        if ('FamilyId' in a || 'AssetId' in a) {
          c.err(`${ctx}: names its asset by FamilyId/AssetId; seeding rows name a 'unit' or 'facility' id (SCHEMA.md section 12 Q1).`, T)
          continue
        }
        const uidV = ci(a, 'unit')
        const fidV = ci(a, 'facility')
        const uid = uidV === null || uidV === undefined ? '' : gdStr(uidV)
        const fid = fidV === null || fidV === undefined ? '' : gdStr(fidV)
        if (uid === '' && fid === '') c.err(`${ctx}: asset names neither a 'unit' nor a 'facility'.`, T)
        else if (uid !== '' && fid !== '') c.err(`${ctx}: asset names both a unit and a facility; one per row.`, T)
        else if (uid !== '' && !unitIds.has(uid)) c.err(`${ctx}: unit '${uid}' is not declared in units.json.`, T)
        else if (fid !== '' && !facilityIds.has(fid)) c.err(`${ctx}: facility '${fid}' is not declared in facilities.json.`, T)
      }
    })
  }
}

// Rules 3 and 5 for missions.
export function validateMissions(pack: LoadedPack, c: Collector): void {
  const factionIds = new Set(pack.factions.map((f) => f.id))
  const unitIds = new Set(pack.units.map((u) => u.id))
  const ids = new Set<string>()
  for (const ms of pack.missions) {
    const ctx = `missions.json[${ms.id !== '' ? ms.id : '?'}]`
    const T = { page: 'missions', index: ms.index }
    if (blank(ms.id)) c.err(`${ctx}: missing id.`, T)
    else if (ids.has(ms.id)) c.err(`${ctx}: duplicate id.`, T)
    else ids.add(ms.id)
    if (blank(ms.displayName)) c.err(`${ctx}: missing display_name.`, T)
    for (const who of ms.availableTo) if (!factionIds.has(who)) c.err(`${ctx}: available_to '${who}' is not a declared faction.`, T)
    for (const uid of ms.specForces) if (!unitIds.has(uid)) c.err(`${ctx}: spec_forces names '${uid}', which units.json does not declare.`, T)
  }
}

// Rules 3, 4 and 5 for units and weapons.
export function validateUnits(pack: LoadedPack, c: Collector): void {
  const factionIds = new Set(pack.factions.map((f) => f.id))
  const weaponIds = new Set<string>()
  for (const w of pack.weapons) {
    const wctx = `weapons.json[${w.id !== '' ? w.id : '?'}]`
    const T = { page: 'weapons', index: w.index }
    if (blank(w.id)) c.err(`${wctx}: missing id.`, T)
    else if (weaponIds.has(w.id)) c.err(`${wctx}: duplicate id.`, T)
    else weaponIds.add(w.id)
    if (w.roles.length === 0) c.err(`${wctx}: declares no roles; the tactical engine would treat it as an ordinary gun.`, T)
    for (const role of w.roles) if (!KNOWN_WEAPON_ROLES.includes(role)) c.err(`${wctx}: unknown role '${role}'. Known: ${join(KNOWN_WEAPON_ROLES)}.`, T)
  }
  const ids = new Set<string>()
  for (const u of pack.units) {
    const ctx = `units.json[${u.id !== '' ? u.id : '?'}]`
    const T = { page: 'units', index: u.index }
    if (blank(u.id)) c.err(`${ctx}: missing id.`, T)
    else if (ids.has(u.id)) c.err(`${ctx}: duplicate id.`, T)
    else ids.add(u.id)
    if (blank(u.displayName)) c.err(`${ctx}: missing display_name.`, T)
    if (!KNOWN_UNIT_KINDS.includes(u.kind)) c.err(`${ctx}: unknown kind '${u.kind}'. Known: ${join(KNOWN_UNIT_KINDS)}.`, T)
    for (const who of u.buildableBy) if (!factionIds.has(who)) c.err(`${ctx}: buildable_by '${who}' is not a declared faction.`, T)
    for (const wid of Object.keys(u.weapons))
      if (!weaponIds.has(wid)) c.err(`${ctx}: carries weapon '${wid}', which weapons.json does not declare.`, T)
  }
}

// Rules 3, 4 and 5 for facilities.
export function validateFacilities(pack: LoadedPack, c: Collector): void {
  const factionIds = new Set(pack.factions.map((f) => f.id))
  const ids = new Set<string>()
  const tiersByFamily = new Map<string, Set<number>>()
  for (const fd of pack.facilities) {
    const ctx = `facilities.json[${fd.id !== '' ? fd.id : '?'}]`
    const T = { page: 'facilities', index: fd.index }
    if (blank(fd.id)) c.err(`${ctx}: missing id.`, T)
    else if (ids.has(fd.id)) c.err(`${ctx}: duplicate id.`, T)
    else ids.add(fd.id)
    if (blank(fd.displayName)) c.err(`${ctx}: missing display_name.`, T)
    if (blank(fd.family)) c.err(`${ctx}: missing family.`, T)
    else {
      if (!tiersByFamily.has(fd.family)) tiersByFamily.set(fd.family, new Set())
      const tiers = tiersByFamily.get(fd.family)!
      if (tiers.has(fd.tier)) c.err(`${ctx}: family '${fd.family}' already declares tier ${fd.tier}.`, T)
      tiers.add(fd.tier)
    }
    if (fd.roles.length === 0) c.err(`${ctx}: declares no roles; nothing would ever select it.`, T)
    for (const role of fd.roles) if (!KNOWN_FACILITY_ROLES.includes(role)) c.err(`${ctx}: unknown role '${role}'. Known: ${join(KNOWN_FACILITY_ROLES)}.`, T)
    for (const who of fd.buildableBy) if (!factionIds.has(who)) c.err(`${ctx}: buildable_by '${who}' is not a declared faction.`, T)
  }
  for (const [fam, tiers] of tiersByFamily)
    if (!tiers.has(1)) c.err(`facilities.json: family '${fam}' has no tier 1; it could never be built.`, { page: 'facilities' })
  if (!pack.facilities.some((fd) => fd.roles.includes('headquarters')))
    c.err("facilities.json: no facility has the 'headquarters' role; day zero has nothing to place.", { page: 'facilities' })
}

// Rules 3, 5 and 15 for the roster.
export function validateCharacters(pack: LoadedPack, c: Collector): void {
  const factionIds = new Set(pack.factions.map((f) => f.id))
  const ids = new Set<string>()
  for (const ch of pack.characters) {
    const ctx = `characters.json[${ch.id !== '' ? ch.id : '?'}]`
    const T = { page: 'characters', index: ch.index }
    if (blank(ch.id)) c.err(`${ctx}: missing id.`, T)
    else if (ids.has(ch.id)) c.err(`${ctx}: duplicate id.`, T)
    else ids.add(ch.id)
    if (blank(ch.displayName)) c.err(`${ctx}: missing display_name.`, T)
    if (!factionIds.has(ch.faction)) c.err(`${ctx}: faction '${ch.faction}' is not declared in factions.json.`, T)
    for (const rank of ch.canCommand)
      if (!KNOWN_COMMAND_RANKS.includes(rank)) c.err(`${ctx}: unknown can_command entry '${rank}'. Known: ${join(KNOWN_COMMAND_RANKS)}.`, T)
    if (ch.startsAt !== '') {
      let side = null
      for (const f of pack.factions) if (f.id === ch.faction) side = f
      const held: string[] = []
      if (side !== null) {
        for (const sp of side.startingPlanets) held.push(sp.planet)
        if (side.hq !== null && side.hq.kind === 'fixed' && side.hq.planet !== '') held.push(side.hq.planet)
      }
      const onMap = pack.planets.some((p) => p.id === ch.startsAt)
      if (!onMap) c.err(`${ctx}: starts_at '${ch.startsAt}' is not a planet id in map.json.`, T)
      else if (!held.includes(ch.startsAt))
        c.err(`${ctx}: starts_at '${ch.startsAt}' is not a world ${ch.faction} holds at day zero (its starting_planets or fixed hq).`, T)
    }
  }
  for (const f of pack.factions) {
    if (f.victory === null) continue
    for (const n of f.victory.captureCharacters)
      if (!ids.has(n)) c.err(`factions.json[${f.id}]: victory target '${n}' is not a character id in characters.json.`, { page: 'factions', index: f.index })
  }
}

// Rules 3, 7, 9 and 10.
export function validateMap(pack: LoadedPack, packDir: string, hasFile: (p: string) => boolean, c: Collector): void {
  const sizes = pack.manifest.setup !== null ? pack.manifest.setup.galaxySizes : []
  const sectorIds = new Set<string>()
  const sizesUsed = new Set<string>()
  for (const s of pack.sectors) {
    const ctx = `map.json sectors[${s.id !== '' ? s.id : '?'}]`
    const T = { page: 'sectors', index: s.index }
    if (blank(s.id)) c.err(`${ctx}: missing id.`, T)
    else if (sectorIds.has(s.id)) c.err(`${ctx}: duplicate id.`, T)
    else sectorIds.add(s.id)
    if (blank(s.displayName)) c.err(`${ctx}: missing display_name.`, T)
    if (s.minSize === '') c.err(`${ctx}: missing min_size.`, T)
    else if (sizes.length > 0 && !sizes.includes(s.minSize))
      c.err(`${ctx}: min_size '${s.minSize}' is not one of pack.json setup.galaxy_sizes (${join(sizes)}).`, T)
    else sizesUsed.add(s.minSize)
  }
  if (sizes.length > 0 && !sizesUsed.has(sizes[0]))
    c.err(
      `map.json: no sector declares min_size '${sizes[0]}', the smallest size pack.json offers - that menu option would start an empty galaxy.`,
      { page: 'sectors' }
    )

  const planetIds = new Set<string>()
  for (const p of pack.planets) {
    const ctx = `map.json planets[${p.id !== '' ? p.id : '?'}]`
    const T = { page: 'planets', index: p.index }
    if (blank(p.id)) c.err(`${ctx}: missing id.`, T)
    else if (planetIds.has(p.id)) c.err(`${ctx}: duplicate id.`, T)
    else planetIds.add(p.id)
    if (blank(p.displayName)) c.err(`${ctx}: missing display_name.`, T)
    if (!sectorIds.has(p.sector)) c.err(`${ctx}: sector '${p.sector}' is not declared in map.json.`, T)
  }

  for (const f of pack.factions) {
    const T = { page: 'factions', index: f.index }
    for (const sp of f.startingPlanets)
      if (sp.planet !== '' && !planetIds.has(sp.planet)) c.err(`factions.json[${f.id}]: starting planet '${sp.planet}' is not a planet id in map.json.`, T)
    if (f.hq !== null && f.hq.kind === 'fixed' && f.hq.planet !== '' && !planetIds.has(f.hq.planet))
      c.err(`factions.json[${f.id}]: hq.planet '${f.hq.planet}' is not a planet id in map.json.`, T)
    if (f.hq !== null && f.hq.kind === 'hidden' && f.hq.placement !== 'random_rim' && !planetIds.has(f.hq.placement))
      c.err(`factions.json[${f.id}]: hq.placement '${f.hq.placement}' is neither 'random_rim' nor a planet id in map.json.`, T)
  }

  const P = { page: 'pack' }
  if (blank(pack.manifest.mapImage)) c.err("pack.json: 'map_image' is required - name the galaxy backdrop shipped with the pack.", P)
  const r = pack.manifest.mapImageRect
  const isZeroRect = r === null || r.every((v) => v === 0)
  if (!isZeroRect && (r![2] <= 0 || r![3] <= 0)) c.err('pack.json: map_image_rect must be [x, y, w, h] with w and h > 0.', P)
  else if (splitArtRef(pack.manifest.mapImage)[0] === '' && !hasFile(pack.manifest.mapImage))
    c.err(`pack.json: map_image '${pack.manifest.mapImage}' is not in ${packDir}.`, P)
}

// Rule 18.
export function validateArt(pack: LoadedPack, c: Collector): void {
  const sets = pack.manifest.artSets
  const skins: string[] = []
  const P = { page: 'pack' }
  for (const s of sets) {
    if (!Object.prototype.hasOwnProperty.call(KNOWN_ART_SETS, s))
      c.err(`pack.json art_sets: '${s}' is not an art set the engine knows (${join(Object.keys(KNOWN_ART_SETS))}).`, P)
    else skins.push(...KNOWN_ART_SETS[s])
  }
  for (const f of pack.factions) {
    const ctx = `factions.json[${f.id}]`
    const T = { page: 'factions', index: f.index }
    if (sets.length === 0) {
      if (f.skin !== '') c.err(`${ctx}: skin '${f.skin}' needs pack.json art_sets - a skin is one of an art set's side looks.`, T)
    } else if (f.skin === '') c.err(`${ctx}: 'skin' is required when the pack declares art_sets - which side look does it wear (${join(skins)})?`, T)
    else if (skins.length > 0 && !skins.includes(f.skin)) c.err(`${ctx}: skin '${f.skin}' is not a side look of ${join(sets)} (${join(skins)}).`, T)
  }
  const rows: [string, string, { art: string; id: string; index: number }[]][] = [
    ['characters.json', 'characters', pack.characters],
    ['units.json', 'units', pack.units],
    ['facilities.json', 'facilities', pack.facilities],
    ['missions.json', 'missions', pack.missions],
    ['map.json', 'planets', pack.planets]
  ]
  for (const [file, page, list] of rows) {
    for (const row of list) {
      if (row.art === '') continue
      const ctx = `${file}[${row.id}] art`
      const T = { page, index: row.index }
      if (sets.length === 0) c.err(`${ctx}: '${row.art}' needs pack.json art_sets.`, T)
      else if (parseArtRef(row.art, sets) === null)
        c.err(`${ctx}: '${row.art}' must be [<art set>:]<kind>/<id>, the art set one of ${join(sets)} and the kind one of ${join(ART_KINDS)}.`, T)
    }
  }
  const pairs: [string, string][] = [
    ['map_image', pack.manifest.mapImage],
    ['menu.image', pack.manifest.menu !== null ? pack.manifest.menu.image : '']
  ]
  for (const [name, value] of pairs) {
    const [set] = splitArtRef(value)
    if (set !== '' && !sets.includes(set)) c.err(`pack.json ${name}: '${value}' names art set '${set}', which art_sets does not declare.`, P)
  }
}

/** Which editor page shows a file. */
export function pageForFile(f: string): string {
  switch (f) {
    case 'pack.json':
      return 'pack'
    case 'factions.json':
      return 'factions'
    case 'map.json':
      return 'planets'
    case 'characters.json':
      return 'characters'
    case 'facilities.json':
      return 'facilities'
    case 'units.json':
      return 'units'
    case 'weapons.json':
      return 'weapons'
    case 'missions.json':
      return 'missions'
    case 'mission_tables.json':
      return 'missionTables'
    case 'rules.json':
      return 'rules'
    case 'setup.json':
      return 'logistics'
    case 'display.json':
      return 'display'
    default:
      return 'files'
  }
}

export { Collector }
