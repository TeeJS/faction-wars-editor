// Generates the New Pack starter (src/core/starter/*.json) from the WW2 pack in a
// read-only checkout of TeeJS/faction-wars. The WW2 pack's numbers are the
// original game's tables re-skinned and measured to play; the starter keeps
// those numbers, drops the setting (every name is generic), and trims the
// roster to a small, valid, playable two-side pack an author grows from.
//
//   node scripts/make-starter.mjs [path-to-faction-wars]
//
// Re-run when the game's schema changes, then run the tests.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const fw = resolve(process.argv[2] ?? process.env.FACTION_WARS_DIR ?? join(here, '..', '..', 'faction-wars'))
const src = join(fw, 'packs', 'ww2')
const out = join(here, '..', 'src', 'core', 'starter')
const read = (f) => JSON.parse(readFileSync(join(src, f), 'utf8'))
const write = (f, v) => writeFileSync(join(out, f), JSON.stringify(v, null, 2) + '\n')
mkdirSync(out, { recursive: true })

// WW2 side -> starter side
const SIDE = { allies: 'faction_a', axis: 'faction_b' }
const sideOf = (id) => SIDE[id] ?? id
const renameKeys = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [fn(k), v]))

// ---- units: per side, a battleship, a carrier, a transport, a fighter, a troop, a spec force ----
const wwUnits = read('units.json').units
const weapons = read('weapons.json')
const pick = (side, kind, score) =>
  wwUnits
    .filter((u) => u.kind === kind && (u.buildable_by ?? []).includes(side) && !(u.roles ?? []).length)
    .sort((a, b) => score(b) - score(a))[0]
const st = (u, k) => Number(u.stats?.[k] ?? 0)
const roster = {}
const unitMap = new Map() // ww2 id -> starter id
const units = []
for (const [ww, side] of Object.entries(SIDE)) {
  const letter = side.slice(-1)
  const chosen = [
    ['battleship', 'Battleship', pick(ww, 'capital_ship', (u) => st(u, 'hull') - 1000 * (st(u, 'fighter_capacity') + st(u, 'troop_capacity')))],
    ['carrier', 'Carrier', pick(ww, 'capital_ship', (u) => st(u, 'fighter_capacity'))],
    ['transport', 'Transport', pick(ww, 'capital_ship', (u) => st(u, 'troop_capacity'))],
    ['fighter', 'Fighter Squadron', pick(ww, 'fighter', (u) => st(u, 'shield') + st(u, 'maneuverability'))],
    ['infantry', 'Infantry Regiment', pick(ww, 'troop', (u) => st(u, 'attack') + st(u, 'defense'))],
    ['agents', 'Special Agents', pick(ww, 'spec_force', (u) => st(u, 'espionage_rating') + st(u, 'combat_rating'))]
  ]
  roster[side] = {}
  for (const [role, name, u] of chosen) {
    const id = `${letter}_${role}`
    roster[side][role] = id
    unitMap.set(u.id, id)
    const copy = { ...u, id, display_name: `${name} ${letter.toUpperCase()}`, buildable_by: [side] }
    delete copy.template
    delete copy.art
    delete copy.source_id
    delete copy.string_id
    delete copy.source_family_id
    units.push(copy)
  }
}
// Every other WW2 unit maps to the starter unit with the same job.
for (const u of wwUnits) {
  if (unitMap.has(u.id)) continue
  const side = sideOf((u.buildable_by ?? ['allies'])[0])
  const r = roster[side]
  const job =
    u.kind === 'fighter' ? 'fighter' : u.kind === 'troop' ? 'infantry' : u.kind === 'spec_force' ? 'agents'
      : st(u, 'fighter_capacity') > 0 ? 'carrier' : st(u, 'troop_capacity') > 0 ? 'transport' : 'battleship'
  unitMap.set(u.id, r[job])
}

// ---- facilities: every family, generic names ----
const FAC_NAMES = {
  headquarters: 'Headquarters', shipyard: 'Shipyard', training_facility: 'Training Facility',
  construction_yard: 'Construction Yard', advanced_shipyard: 'Advanced Shipyard',
  advanced_training_facility: 'Advanced Training Facility', advanced_construction_yard: 'Advanced Construction Yard',
  mine: 'Mine', refinery: 'Refinery', minefield: 'Minefield', coastal_battery: 'Defense Battery',
  fortifications: 'Shield Fortifications', hardened_airbase: 'Hardened Bunker',
  heavy_coastal_battery: 'Heavy Defense Battery', fortress_line: 'Fortress Line'
}
const facilities = read('facilities.json').facilities.map((f) => {
  // buildable_by keeps WW2's asymmetry (only side A has a headquarters building,
  // as only the Alliance did in the original); an author changes it on the form.
  const c = { ...f, display_name: FAC_NAMES[f.id] ?? f.display_name, buildable_by: (f.buildable_by ?? []).map(sideOf) }
  delete c.template
  delete c.art
  delete c.source_id
  delete c.string_id
  delete c.source_family_id
  return c
})

// ---- characters: a leader, a commander and six officers per side ----
const wwChars = read('characters.json').characters
const LEADER = { faction_a: 'churchill', faction_b: 'hitler' }
const COMMANDER = { faction_a: 'de_gaulle', faction_b: 'mussolini' }
const characters = []
for (const [ww, side] of Object.entries(SIDE)) {
  const L = side.slice(-1).toUpperCase()
  const l = side.slice(-1)
  const mk = (from, id, name, extra) => {
    const c = { ...from, id, display_name: name, faction: side, ...extra }
    delete c.art
    delete c.source_id
    delete c.string_id
    delete c.starts_at
    return c
  }
  const leader = wwChars.find((c) => c.id === LEADER[side])
  const commander = wwChars.find((c) => c.id === COMMANDER[side])
  // Six officers: day zero places 1-4 extras by galaxy size, the rest stay recruitable.
  const minors = wwChars
    .filter((c) => c.faction === ww && !c.is_major)
    .sort((a, b) => (b.can_command ?? []).length - (a.can_command ?? []).length)
    .slice(0, 6)
  characters.push(mk(leader, `${l}_leader`, `Leader ${L}`, { is_major: true, roles: ['starts_at_hq'] }))
  characters.push(mk(commander, `${l}_commander`, `Commander ${L}`, { is_major: true, roles: ['starts_at_first_world'] }))
  minors.forEach((m, i) => characters.push(mk(m, `${l}_officer_${i + 1}`, `Officer ${L}${i + 1}`, { roles: [] })))
}

// ---- missions: every behaviour but superweapon sabotage (the starter has no superweapon) ----
const MISSION_NAMES = {
  diplomacy: 'Diplomacy', rescue: 'Rescue', sabotage: 'Sabotage', espionage: 'Espionage', reconnaissance: 'Reconnaissance',
  recruitment: 'Recruitment', abduction: 'Abduction', ship_design_research: 'Ship Design Research',
  facility_design_research: 'Facility Design Research', troop_training_research: 'Troop Training Research',
  incite_uprising: 'Incite Uprising', subdue_uprising: 'Subdue Uprising', assassination: 'Assassination'
}
const missions = read('missions.json').missions
  .filter((m) => m.behaviour !== 'superweapon_sabotage')
  .map((m) => {
    const c = {
      ...m,
      display_name: MISSION_NAMES[m.id] ?? m.display_name,
      available_to: ['faction_a', 'faction_b'],
      spec_forces: (m.spec_forces ?? []).length ? ['a_agents', 'b_agents'] : []
    }
    delete c.template
    delete c.art
    return c
  })
const tables = read('mission_tables.json')
delete tables.tables['sabotage_atomic_program']

// ---- rules and side lottery: the WW2 numbers, faction keys renamed ----
const rules = read('rules.json').map((r) => ({ ...r, by_faction: renameKeys(r.by_faction, sideOf) }))
const setup = read('setup.json')
setup.side_lottery = setup.side_lottery.map((r) => ({
  ...r,
  by_faction: renameKeys(r.by_faction, sideOf),
  ...(r.by_faction
    ? {
        by_faction: Object.fromEntries(
          Object.entries(r.by_faction).map(([p, byD]) => [sideOf(p), Object.fromEntries(Object.entries(byD).map(([d, cells]) => [d, renameKeys(cells, sideOf)]))])
        )
      }
    : {}),
  dev: r.dev ? renameKeys(r.dev, sideOf) : r.dev,
  mp: r.mp ? renameKeys(r.mp, sideOf) : r.mp
}))
const remapAsset = (a) => (a && a.unit ? { unit: unitMap.get(a.unit) ?? a.unit } : a)
const logistics = {}
const TABLE_RENAME = {
  allies_fleet: 'faction_a_fleet', axis_fleet: 'faction_b_fleet',
  allies_procedural_fleet: 'faction_a_procedural_fleet', axis_procedural_fleet: 'faction_b_procedural_fleet',
  allies_hq_garrison: 'faction_a_hq_garrison', axis_hq_garrison: 'faction_b_hq_garrison',
  allies_hq_facilities: 'faction_a_hq_facilities', axis_hq_facilities: 'faction_b_hq_facilities',
  britain_start_garrison: 'faction_a_start_garrison', germany_start_garrison: 'faction_b_start_garrison',
  core_system_facilities: 'core_system_facilities', rim_system_facilities: 'rim_system_facilities'
}
for (const [id, t] of Object.entries(setup.logistics)) {
  const nid = TABLE_RENAME[id]
  if (!nid) continue
  logistics[nid] = {
    ...t,
    Entries: t.Entries.map((e) => ({
      ...e,
      ...('Asset' in e ? { Asset: remapAsset(e.Asset) } : {}),
      ...('Assets' in e ? { Assets: e.Assets.map(remapAsset) } : {})
    }))
  }
}
setup.logistics = logistics

// ---- display: the WW2 catalog with generic labels; engine default terms ----
const display = read('display.json')
const LABELS = {
  uprisings: 'Uprisings', fleets_enroute: 'Fleets En Route', available_energy: 'Available Energy',
  shipyards: 'Shipyards', idle_shipyards: 'Idle Shipyards', training_facilities: 'Training Facilities',
  idle_training_facilities: 'Idle Training Facilities', construction_yards: 'Construction Yards',
  idle_construction_yards: 'Idle Construction Yards', defense_batteries: 'Defense Batteries',
  shield_generators: 'Shields', fighter_squadrons: 'Fighter Squadrons', trooper_regiments: 'Regiments',
  hardened_airbases: 'Hardened Bunkers'
}
for (const c of display.categories)
  for (const m of c.modes) {
    if (LABELS[m.id]) {
      m.label = LABELS[m.id]
      if (m.title) m.title = LABELS[m.id]
    }
    for (const t of m.tiers ?? []) delete t._comment
  }
delete display.terms
display.special_power_ranks = { none: 'None', novice: 'Novice', trainee: 'Trainee', student: 'Adept', knight: 'Expert', master: 'Master' }
delete display.loyalty_bar

// ---- the map: five sectors covering the three sizes, fifteen worlds on 700x420 ----
const sectors = [
  { id: 'western_core', display_name: 'Western Core', ring: 1, starts_neutral: false, map: { x: 190, y: 190 }, min_size: 'standard' },
  { id: 'eastern_core', display_name: 'Eastern Core', ring: 1, starts_neutral: false, map: { x: 510, y: 190 }, min_size: 'standard' },
  { id: 'northern_rim', display_name: 'Northern Rim', ring: 2, starts_neutral: true, map: { x: 350, y: 70 }, min_size: 'standard' },
  { id: 'southern_rim', display_name: 'Southern Rim', ring: 2, starts_neutral: true, map: { x: 350, y: 340 }, min_size: 'large' },
  { id: 'far_rim', display_name: 'Far Rim', ring: 3, starts_neutral: true, map: { x: 640, y: 360 }, min_size: 'huge' }
]
const P = (id, name, sector, x, y, inhabited = true) => ({ id, display_name: name, sector, starts_inhabited: inhabited, map: { x, y } })
// Worlds sit ~25-40 apart inside a sector (4-8 days at the WW2 divisor of 5), sectors
// far apart - the Star Wars pack's proportions (median neighbour 22, capitals 445).
const planets = [
  P('alpha_prime', 'Alpha Prime', 'western_core', 170, 185),
  P('alpha_minor', 'Alpha Minor', 'western_core', 200, 160),
  P('alpha_reach', 'Alpha Reach', 'western_core', 205, 212),
  P('beta_prime', 'Beta Prime', 'eastern_core', 530, 185),
  P('beta_minor', 'Beta Minor', 'eastern_core', 500, 160),
  P('beta_reach', 'Beta Reach', 'eastern_core', 495, 212),
  P('north_gate', 'North Gate', 'northern_rim', 322, 66),
  P('north_haven', 'North Haven', 'northern_rim', 372, 56, false),
  P('north_watch', 'North Watch', 'northern_rim', 350, 94),
  P('south_gate', 'South Gate', 'southern_rim', 322, 336),
  P('south_haven', 'South Haven', 'southern_rim', 376, 346, false),
  P('south_watch', 'South Watch', 'southern_rim', 350, 312),
  P('far_outpost', 'Far Outpost', 'far_rim', 620, 348, false),
  P('far_colony', 'Far Colony', 'far_rim', 660, 366),
  P('far_wastes', 'Far Wastes', 'far_rim', 634, 388, false)
]

const factions = {
  factions: [
    {
      id: 'faction_a', display_name: 'Faction A', color: '#3d7be0', loyalty_label: 'Support for Faction A', agent_name: 'Agent',
      hq: { kind: 'fixed', planet: 'alpha_prime' }, occupation_support_policy: 'garrison_bonus',
      starting_planets: [
        { planet: 'alpha_prime', support: 100, explored: true, garrison: 'faction_a_start_garrison' },
        { planet: 'alpha_minor', support: 80, explored: true }
      ],
      seed: { hq_facilities: 'faction_a_hq_facilities', hq_garrison: 'faction_a_hq_garrison', fleet: 'faction_a_fleet', procedural_fleet: 'faction_a_procedural_fleet' },
      victory: { capture_characters: ['b_leader', 'b_commander'] }
    },
    {
      id: 'faction_b', display_name: 'Faction B', color: '#d23a3a', loyalty_label: 'Support for Faction B', agent_name: 'Agent',
      hq: { kind: 'fixed', planet: 'beta_prime' }, occupation_support_policy: 'garrison_bonus',
      starting_planets: [
        { planet: 'beta_prime', support: 100, explored: true, garrison: 'faction_b_start_garrison' },
        { planet: 'beta_minor', support: 80, explored: true }
      ],
      seed: { hq_facilities: 'faction_b_hq_facilities', hq_garrison: 'faction_b_hq_garrison', fleet: 'faction_b_fleet', procedural_fleet: 'faction_b_procedural_fleet' },
      victory: { capture_characters: ['a_leader', 'a_commander'] }
    }
  ]
}

write('factions.json', factions)
write('map.json', { sectors, planets })
write('characters.json', { characters })
write('facilities.json', { facilities })
write('units.json', { units })
write('weapons.json', weapons)
write('missions.json', { missions })
write('mission_tables.json', tables)
write('rules.json', rules)
write('setup.json', setup)
write('display.json', display)
console.log(`starter written to ${out}: ${units.length} units, ${facilities.length} facilities, ${characters.length} characters, ${missions.length} missions, ${Object.keys(logistics).length} logistics tables`)
