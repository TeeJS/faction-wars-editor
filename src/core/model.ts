// A read-only, typed view of a pack, hydrated exactly the way the game's
// PackDefs.from_dict does it (TeeJS/faction-wars src/data/dto/pack_defs.gd):
// keys case-insensitive, a missing key takes the default, ints truncated.
// The validator runs on this; the forms read and write the JSON directly.

import type { PackDocument } from './document'
import type { PackJsonFile } from './vocab'

type Dict = Record<string, unknown>

export function isDict(v: unknown): v is Dict {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** JsonUtil.get_ci: exact key first, then a case-folded scan. */
export function ci(d: unknown, key: string): unknown {
  if (!isDict(d)) return undefined
  if (Object.prototype.hasOwnProperty.call(d, key)) return d[key]
  const lower = key.toLowerCase()
  for (const k of Object.keys(d)) if (k.toLowerCase() === lower) return d[k]
  return undefined
}

/** Godot's str() of a JSON value. */
export function gdStr(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/** Godot's int() of a JSON value (truncates toward zero). */
export function gdInt(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : 0
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

export function gdFloat(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

export function gdBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v.length > 0
  return v !== null && v !== undefined
}

const strOr = (d: unknown, k: string, def = ''): string => {
  const v = ci(d, k)
  return v === null || v === undefined ? def : gdStr(v)
}
const intOr = (d: unknown, k: string, def = 0): number => {
  const v = ci(d, k)
  return v === null || v === undefined ? def : gdInt(v)
}
const floatOr = (d: unknown, k: string, def = 0): number => {
  const v = ci(d, k)
  return v === null || v === undefined ? def : gdFloat(v)
}
const boolOr = (d: unknown, k: string, def = false): boolean => {
  const v = ci(d, k)
  return v === null || v === undefined ? def : gdBool(v)
}

/** A structural fault the game would crash or misread on (not a validation rule). */
export interface ShapeProblem {
  file: PackJsonFile
  message: string
}

class Reader {
  problems: ShapeProblem[] = []
  constructor(public file: PackJsonFile) {}

  strList(d: unknown, k: string, where: string): string[] {
    const v = ci(d, k)
    if (v === null || v === undefined) return []
    if (!Array.isArray(v)) {
      this.problems.push({ file: this.file, message: `${this.file}${where}: '${k}' must be a list.` })
      return []
    }
    return v.map(gdStr)
  }

  /** A list of objects; anything else is reported and skipped. */
  dicts(v: unknown, what: string): { d: Dict; i: number }[] {
    if (v === null || v === undefined) return []
    if (!Array.isArray(v)) {
      this.problems.push({ file: this.file, message: `${this.file}: '${what}' must be a list.` })
      return []
    }
    const out: { d: Dict; i: number }[] = []
    v.forEach((e, i) => {
      if (isDict(e)) out.push({ d: e, i })
      else this.problems.push({ file: this.file, message: `${this.file}: ${what}[${i}] is not an object.` })
    })
    return out
  }
}

// ---- pack.json ----

export interface NeutralDef { id: string; displayName: string; color: string }
export interface PackSetupDef { difficultyDefault: string; galaxySizes: string[]; galaxySizeDefault: string }
export interface MenuRegionDef { action: string; value: string; rect: number[]; tooltip: string; selectedColor: string; index: number }
export interface MenuReadoutDef { rect: number[]; standard: string; hqOnly: string; color: string }
export interface MenuDef { image: string; selectedColor: string; regions: MenuRegionDef[]; readout: MenuReadoutDef | null; credits: string[] }
export interface VictoryTipsDef { standard: string; hqOnly: string }
export interface PackManifest {
  id: string
  displayName: string
  schemaVersion: number
  factionCount: number
  neutral: NeutralDef | null
  unexploredColor: string
  mapImage: string
  /** [x, y, w, h], or null when absent (the picture's own pixels). */
  mapImageRect: number[] | null
  summary: string
  setup: PackSetupDef | null
  menu: MenuDef | null
  victoryTips: VictoryTipsDef | null
  artSets: string[]
}

// ---- factions.json ----

export interface HqDef { kind: string; planet: string; placement: string; movable: boolean }
export interface StartingPlanetDef { planet: string; support: number; explored: boolean; garrison: string }
export interface FactionSeedDef { hqFacilities: string; hqGarrison: string; fleet: string; proceduralFleet: string }
export interface FactionDef {
  index: number
  id: string
  displayName: string
  color: string
  loyaltyLabel: string
  hq: HqDef | null
  occupationSupportPolicy: string
  startingPlanets: StartingPlanetDef[]
  seed: FactionSeedDef | null
  victory: { captureCharacters: string[] } | null
  agentName: string
  skin: string
}

// ---- map.json ----

export interface SectorDef {
  index: number; id: string; displayName: string; ring: number; startsNeutral: boolean
  mapX: number; mapY: number; minSize: string; intelTier: string; sourceId: number
}
export interface PlanetDef {
  index: number; art: string; id: string; displayName: string; sector: string; startsInhabited: boolean
  mapX: number; mapY: number; artworkId: number; sourceId: number
}

// ---- rows ----

export interface RatingDef { base: number; var: number }
export interface CharacterDef {
  index: number; art: string; id: string; displayName: string; faction: string; isMajor: boolean
  startsAt: string; ratings: Record<string, RatingDef>; canCommand: string[]; wontBetray: boolean
  specialPower: { probability: number; isKnownUser: boolean; levelBase: number; levelVar: number; canTrain: boolean }
  roles: string[]; sourceId: number; stringId: number
}
export interface FacilityDef {
  index: number; art: string; id: string; displayName: string; family: string; tier: number
  roles: string[]; buildableBy: string[]; constructionCost: number; maintenanceCost: number
  researchOrder: number; researchCost: number; stats: Record<string, unknown>; sourceFamilyId: number
}
export interface WeaponDef { index: number; id: string; displayName: string; roles: string[]; arcs: boolean }
export interface UnitWeaponDef { arcs: number[]; amount: number; reach: number }
export interface UnitDef {
  index: number; art: string; id: string; displayName: string; kind: string; roles: string[]; buildableBy: string[]
  constructionCost: number; maintenanceCost: number; researchOrder: number; researchCost: number
  weapons: Record<string, UnitWeaponDef>; stats: Record<string, unknown>
  sourceFamilyId: number; sourceId: number; stringId: number
}
export interface MissionDef {
  index: number; art: string; id: string; displayName: string; availableTo: string[]; behaviour: string
  specForces: string[]; lengthBase: number; lengthSpread: number
  flags: Record<string, boolean>; targets: Record<string, boolean>; sourceId: number
}
export interface MissionTableDef { id: string; sourceFile: string; description: string; entries: { threshold: number; value: number }[] }

// ---- display.json ----

export interface GidTierDef { min: number; label: string; flare: string }
export interface GidModeDef {
  id: string; label: string; title: string; titleFrom: string; kind: string; args: Record<string, unknown>
  tiers: GidTierDef[]; categoryIndex: number; index: number
}
export interface GidCategoryDef { index: number; id: string; displayName: string; modes: GidModeDef[] }
export interface DisplayDef {
  categories: GidCategoryDef[]
  galaxyDisplayModes: string[]
  specialPowerRanks: Record<string, string>
  terms: Record<string, string>
  loyaltyBar: string[]
  icons: Record<string, string>
}

export interface SetupFile { sideLottery: unknown[]; logistics: Record<string, unknown> }

export interface LoadedPack {
  manifest: PackManifest
  factions: FactionDef[]
  sectors: SectorDef[]
  planets: PlanetDef[]
  characters: CharacterDef[]
  facilities: FacilityDef[]
  units: UnitDef[]
  weapons: WeaponDef[]
  missions: MissionDef[]
  missionTables: Record<string, MissionTableDef>
  rules: unknown[]
  setup: SetupFile
  display: DisplayDef
}

function rect(v: unknown, asInt: boolean): number[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (asInt ? gdInt(x) : gdFloat(x)))
}

export function readManifest(d: unknown): PackManifest {
  const neutralD = ci(d, 'neutral')
  const setupD = ci(d, 'setup')
  const menuD = ci(d, 'menu')
  const tipsD = ci(d, 'victory_tips')
  const r = ci(d, 'map_image_rect')
  const readoutD = ci(menuD, 'readout')
  const regions = ci(menuD, 'regions')
  return {
    id: strOr(d, 'id'),
    displayName: strOr(d, 'display_name'),
    schemaVersion: intOr(d, 'schema_version'),
    factionCount: intOr(d, 'faction_count'),
    neutral: neutralD == null ? null : { id: strOr(neutralD, 'id'), displayName: strOr(neutralD, 'display_name'), color: strOr(neutralD, 'color') },
    unexploredColor: strOr(d, 'unexplored_color'),
    mapImage: strOr(d, 'map_image'),
    mapImageRect: Array.isArray(r) && r.length === 4 ? r.map(gdFloat) : null,
    summary: strOr(d, 'summary'),
    setup:
      setupD == null
        ? null
        : {
            difficultyDefault: strOr(setupD, 'difficulty_default'),
            galaxySizes: Array.isArray(ci(setupD, 'galaxy_sizes')) ? (ci(setupD, 'galaxy_sizes') as unknown[]).map(gdStr) : [],
            galaxySizeDefault: strOr(setupD, 'galaxy_size_default')
          },
    menu:
      menuD == null
        ? null
        : {
            image: strOr(menuD, 'image'),
            selectedColor: strOr(menuD, 'selected_color', '#ffd23c'),
            regions: Array.isArray(regions)
              ? regions.map((e, index) => ({
                  action: strOr(e, 'action'),
                  value: strOr(e, 'value'),
                  rect: rect(ci(e, 'rect'), true),
                  tooltip: strOr(e, 'tooltip'),
                  selectedColor: strOr(e, 'selected_color'),
                  index
                }))
              : [],
            readout:
              readoutD == null
                ? null
                : {
                    rect: rect(ci(readoutD, 'rect'), true),
                    standard: strOr(readoutD, 'standard'),
                    hqOnly: strOr(readoutD, 'hq_only'),
                    color: strOr(readoutD, 'color', '#40ff40')
                  },
            credits: Array.isArray(ci(menuD, 'credits')) ? (ci(menuD, 'credits') as unknown[]).map(gdStr) : []
          },
    victoryTips: tipsD == null ? null : { standard: strOr(tipsD, 'standard'), hqOnly: strOr(tipsD, 'hq_only') },
    artSets: Array.isArray(ci(d, 'art_sets')) ? (ci(d, 'art_sets') as unknown[]).map(gdStr) : []
  }
}

/** Hydrates every file the way the game does. `problems` lists shape faults (a list that
 * is not a list, a row that is not an object) that would crash or confuse the game. */
export function hydrate(doc: PackDocument): { pack: LoadedPack; problems: ShapeProblem[] } {
  const problems: ShapeProblem[] = []

  const manifest = readManifest(doc.value('pack.json'))

  const fr = new Reader('factions.json')
  const factions: FactionDef[] = fr.dicts(ci(doc.value('factions.json'), 'factions'), 'factions').map(({ d, i }) => {
    const hq = ci(d, 'hq')
    const seed = ci(d, 'seed')
    const victory = ci(d, 'victory')
    const sp = fr.dicts(ci(d, 'starting_planets'), `factions[${i}].starting_planets`)
    return {
      index: i,
      id: strOr(d, 'id'),
      displayName: strOr(d, 'display_name'),
      color: strOr(d, 'color'),
      loyaltyLabel: strOr(d, 'loyalty_label'),
      hq: hq == null ? null : { kind: strOr(hq, 'kind'), planet: strOr(hq, 'planet'), placement: strOr(hq, 'placement'), movable: boolOr(hq, 'movable') },
      occupationSupportPolicy: strOr(d, 'occupation_support_policy'),
      startingPlanets: sp.map(({ d: s }) => ({
        planet: strOr(s, 'planet'),
        support: intOr(s, 'support'),
        explored: boolOr(s, 'explored'),
        garrison: strOr(s, 'garrison')
      })),
      seed:
        seed == null
          ? null
          : {
              hqFacilities: strOr(seed, 'hq_facilities'),
              hqGarrison: strOr(seed, 'hq_garrison'),
              fleet: strOr(seed, 'fleet'),
              proceduralFleet: strOr(seed, 'procedural_fleet')
            },
      victory: victory == null ? null : { captureCharacters: fr.strList(victory, 'capture_characters', `[${i}].victory`) },
      agentName: strOr(d, 'agent_name'),
      skin: strOr(d, 'skin')
    }
  })
  problems.push(...fr.problems)

  const mr = new Reader('map.json')
  const mapV = doc.value('map.json')
  const sectors: SectorDef[] = mr.dicts(ci(mapV, 'sectors'), 'sectors').map(({ d, i }) => {
    const m = ci(d, 'map')
    return {
      index: i,
      id: strOr(d, 'id'),
      displayName: strOr(d, 'display_name'),
      ring: intOr(d, 'ring'),
      startsNeutral: boolOr(d, 'starts_neutral'),
      mapX: isDict(m) ? intOr(m, 'x') : 0,
      mapY: isDict(m) ? intOr(m, 'y') : 0,
      minSize: strOr(d, 'min_size'),
      intelTier: strOr(d, 'intel_tier'),
      sourceId: intOr(d, 'source_id')
    }
  })
  const planets: PlanetDef[] = mr.dicts(ci(mapV, 'planets'), 'planets').map(({ d, i }) => {
    const m = ci(d, 'map')
    return {
      index: i,
      art: strOr(d, 'art'),
      id: strOr(d, 'id'),
      displayName: strOr(d, 'display_name'),
      sector: strOr(d, 'sector'),
      startsInhabited: boolOr(d, 'starts_inhabited'),
      mapX: isDict(m) ? intOr(m, 'x') : 0,
      mapY: isDict(m) ? intOr(m, 'y') : 0,
      artworkId: intOr(d, 'artwork_id'),
      sourceId: intOr(d, 'source_id')
    }
  })
  problems.push(...mr.problems)

  const cr = new Reader('characters.json')
  const characters: CharacterDef[] = cr.dicts(ci(doc.value('characters.json'), 'characters'), 'characters').map(({ d, i }) => {
    const ratingsD = ci(d, 'ratings')
    const ratings: Record<string, RatingDef> = {}
    if (isDict(ratingsD))
      for (const k of Object.keys(ratingsD)) {
        const r = ratingsD[k]
        ratings[k] = isDict(r) ? { base: intOr(r, 'base'), var: intOr(r, 'var') } : { base: 0, var: 0 }
      }
    const spD = ci(d, 'special_power')
    const lvl = ci(spD, 'level')
    return {
      index: i,
      art: strOr(d, 'art'),
      id: strOr(d, 'id'),
      displayName: strOr(d, 'display_name'),
      faction: strOr(d, 'faction'),
      isMajor: boolOr(d, 'is_major'),
      startsAt: strOr(d, 'starts_at'),
      ratings,
      canCommand: cr.strList(d, 'can_command', `[${i}]`),
      wontBetray: boolOr(d, 'wont_betray'),
      specialPower: {
        probability: isDict(spD) ? intOr(spD, 'probability') : 0,
        isKnownUser: isDict(spD) ? boolOr(spD, 'is_known_user') : false,
        levelBase: isDict(lvl) ? intOr(lvl, 'base') : 0,
        levelVar: isDict(lvl) ? intOr(lvl, 'var') : 0,
        canTrain: isDict(spD) ? boolOr(spD, 'can_train') : false
      },
      roles: cr.strList(d, 'roles', `[${i}]`),
      sourceId: intOr(d, 'source_id'),
      stringId: intOr(d, 'string_id')
    }
  })
  problems.push(...cr.problems)

  const far = new Reader('facilities.json')
  const facilities: FacilityDef[] = far.dicts(ci(doc.value('facilities.json'), 'facilities'), 'facilities').map(({ d, i }) => {
    const st = ci(d, 'stats')
    return {
      index: i,
      art: strOr(d, 'art'),
      id: strOr(d, 'id'),
      displayName: strOr(d, 'display_name'),
      family: strOr(d, 'family'),
      tier: intOr(d, 'tier', 1),
      roles: far.strList(d, 'roles', `[${i}]`),
      buildableBy: far.strList(d, 'buildable_by', `[${i}]`),
      constructionCost: intOr(d, 'construction_cost'),
      maintenanceCost: intOr(d, 'maintenance_cost'),
      researchOrder: intOr(d, 'research_order'),
      researchCost: intOr(d, 'research_cost'),
      stats: isDict(st) ? { ...st } : {},
      sourceFamilyId: intOr(d, 'source_family_id')
    }
  })
  problems.push(...far.problems)

  const wr = new Reader('weapons.json')
  const weapons: WeaponDef[] = wr.dicts(ci(doc.value('weapons.json'), 'weapons'), 'weapons').map(({ d, i }) => ({
    index: i,
    id: strOr(d, 'id'),
    displayName: strOr(d, 'display_name'),
    roles: wr.strList(d, 'roles', `[${i}]`),
    arcs: boolOr(d, 'arcs')
  }))
  problems.push(...wr.problems)

  const ur = new Reader('units.json')
  const units: UnitDef[] = ur.dicts(ci(doc.value('units.json'), 'units'), 'units').map(({ d, i }) => {
    const w = ci(d, 'weapons')
    const weaponsOut: Record<string, UnitWeaponDef> = {}
    if (isDict(w))
      for (const k of Object.keys(w)) {
        const wd = w[k]
        const a = ci(wd, 'arcs')
        weaponsOut[k] = {
          arcs: isDict(a) ? [intOr(a, 'fore'), intOr(a, 'aft'), intOr(a, 'starboard'), intOr(a, 'port')] : [],
          amount: isDict(wd) ? intOr(wd, 'amount') : 0,
          reach: isDict(wd) ? intOr(wd, 'range') : 0
        }
      }
    const st = ci(d, 'stats')
    return {
      index: i,
      art: strOr(d, 'art'),
      id: strOr(d, 'id'),
      displayName: strOr(d, 'display_name'),
      kind: strOr(d, 'kind'),
      roles: ur.strList(d, 'roles', `[${i}]`),
      buildableBy: ur.strList(d, 'buildable_by', `[${i}]`),
      constructionCost: intOr(d, 'construction_cost'),
      maintenanceCost: intOr(d, 'maintenance_cost'),
      researchOrder: intOr(d, 'research_order'),
      researchCost: intOr(d, 'research_cost'),
      weapons: weaponsOut,
      stats: isDict(st) ? { ...st } : {},
      sourceFamilyId: intOr(d, 'source_family_id'),
      sourceId: intOr(d, 'source_id'),
      stringId: intOr(d, 'string_id')
    }
  })
  problems.push(...ur.problems)

  const msr = new Reader('missions.json')
  const missions: MissionDef[] = msr.dicts(ci(doc.value('missions.json'), 'missions'), 'missions').map(({ d, i }) => {
    const l = ci(d, 'length')
    const fl = ci(d, 'flags')
    const tg = ci(d, 'targets')
    const flags: Record<string, boolean> = {}
    if (isDict(fl)) for (const k of Object.keys(fl)) flags[k] = gdBool(fl[k])
    const targets: Record<string, boolean> = {}
    if (isDict(tg)) for (const k of Object.keys(tg)) targets[k] = gdBool(tg[k])
    return {
      index: i,
      art: strOr(d, 'art'),
      id: strOr(d, 'id'),
      displayName: strOr(d, 'display_name'),
      availableTo: msr.strList(d, 'available_to', `[${i}]`),
      behaviour: strOr(d, 'behaviour'),
      specForces: msr.strList(d, 'spec_forces', `[${i}]`),
      lengthBase: isDict(l) ? intOr(l, 'base') : 0,
      lengthSpread: isDict(l) ? intOr(l, 'spread') : 0,
      flags,
      targets,
      sourceId: intOr(d, 'source_id')
    }
  })
  problems.push(...msr.problems)

  const tr = new Reader('mission_tables.json')
  const missionTables: Record<string, MissionTableDef> = {}
  const tablesV = ci(doc.value('mission_tables.json'), 'tables')
  if (isDict(tablesV)) {
    for (const k of Object.keys(tablesV)) {
      const t = tablesV[k]
      if (!isDict(t)) {
        tr.problems.push({ file: 'mission_tables.json', message: `mission_tables.json: table '${k}' is not an object.` })
        continue
      }
      missionTables[k] = {
        id: k,
        sourceFile: strOr(t, 'source_file'),
        description: strOr(t, 'description'),
        entries: tr.dicts(ci(t, 'entries'), `tables['${k}'].entries`).map(({ d }) => ({ threshold: intOr(d, 'Threshold'), value: intOr(d, 'Value') }))
      }
    }
  } else if (tablesV !== undefined && tablesV !== null) {
    tr.problems.push({ file: 'mission_tables.json', message: "mission_tables.json: 'tables' must be an object keyed by table id." })
  }
  problems.push(...tr.problems)

  const rulesV = doc.value('rules.json')
  if (rulesV !== undefined && !Array.isArray(rulesV))
    problems.push({ file: 'rules.json', message: 'rules.json: the file must be a list of rule rows.' })

  const setupV = doc.value('setup.json')
  const sl = ci(setupV, 'side_lottery')
  const lg = ci(setupV, 'logistics')
  const setup: SetupFile = { sideLottery: Array.isArray(sl) ? sl : [], logistics: isDict(lg) ? { ...lg } : {} }

  const dv = doc.value('display.json')
  const dr = new Reader('display.json')
  const icons: Record<string, string> = {}
  const ic = ci(dv, 'icons')
  if (isDict(ic)) for (const k of Object.keys(ic)) if (!k.startsWith('_')) icons[k] = gdStr(ic[k])
  const terms: Record<string, string> = {}
  const tm = ci(dv, 'terms')
  if (isDict(tm)) for (const k of Object.keys(tm)) if (!k.startsWith('_')) terms[k] = gdStr(tm[k])
  const ranks: Record<string, string> = {}
  const rk = ci(dv, 'special_power_ranks')
  if (isDict(rk)) for (const k of Object.keys(rk)) ranks[k] = gdStr(rk[k])
  const categories: GidCategoryDef[] = dr.dicts(ci(dv, 'categories'), 'categories').map(({ d, i }) => ({
    index: i,
    id: strOr(d, 'id'),
    displayName: strOr(d, 'display_name'),
    modes: dr.dicts(ci(d, 'modes'), `categories[${i}].modes`).map(({ d: m, i: mi }) => {
      const q = ci(m, 'quantity')
      const args: Record<string, unknown> = {}
      if (isDict(q)) for (const k of Object.keys(q)) if (k !== 'kind') args[k] = q[k]
      return {
        id: strOr(m, 'id'),
        label: strOr(m, 'label'),
        title: strOr(m, 'title'),
        titleFrom: strOr(m, 'title_from'),
        kind: isDict(q) ? strOr(q, 'kind') : '',
        args,
        tiers: dr.dicts(ci(m, 'tiers'), `categories[${i}].modes[${mi}].tiers`).map(({ d: t }) => ({
          min: floatOr(t, 'min'),
          label: strOr(t, 'label'),
          flare: strOr(t, 'flare', 'none')
        })),
        categoryIndex: i,
        index: mi
      }
    })
  }))
  const display: DisplayDef = {
    categories,
    galaxyDisplayModes: dr.strList(dv, 'galaxy_display_modes', ''),
    specialPowerRanks: ranks,
    terms,
    loyaltyBar: dr.strList(dv, 'loyalty_bar', ''),
    icons
  }
  problems.push(...dr.problems)

  return {
    pack: {
      manifest,
      factions,
      sectors,
      planets,
      characters,
      facilities,
      units,
      weapons,
      missions,
      missionTables,
      rules: Array.isArray(rulesV) ? rulesV : [],
      setup,
      display
    },
    problems
  }
}
