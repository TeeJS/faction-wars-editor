// Parity with the game's validator. The cases are a port of the game's own
// tests/pack_validation.gd: the same minimal pack, bent one field per case, and
// the same expected message fragment.

import { describe, expect, it } from 'vitest'
import { PackDocument } from '../src/core/document'
import { hydrate } from '../src/core/model'
import {
  Collector,
  validateArt,
  validateCharacters,
  validateMenu,
  validateMap,
  validatePack,
  runValidate
} from '../src/core/validate'
import { SHIPPED_PACKS, docFromObjects, haveGameRepo, loadShipped } from './helpers'

const PACK_DIR = 'res://packs/star-wars-rebellion'

const suite = haveGameRepo ? describe : describe.skip
suite('the shipped packs pass', () => {
  for (const id of SHIPPED_PACKS)
    it(id, () => {
      const errors = validatePack(loadShipped(id))
      expect(errors.map((e) => e.message)).toEqual([])
    })
})

type O = Record<string, unknown>

function menu(over: O): O {
  let regions: O[] = [
    { action: 'difficulty', value: 'easy', rect: [0, 0, 10, 10] },
    { action: 'difficulty', value: 'medium', rect: [10, 0, 10, 10] },
    { action: 'difficulty', value: 'hard', rect: [20, 0, 10, 10] },
    { action: 'galaxy_size', value: 'standard', rect: [0, 10, 10, 10] },
    { action: 'galaxy_size', value: 'large', rect: [10, 10, 10, 10] },
    { action: 'galaxy_size', value: 'huge', rect: [20, 10, 10, 10] },
    { action: 'start', value: over.start_value ?? 'test_side', rect: [0, 20, 10, 10] },
    { action: 'load_game', rect: [10, 20, 10, 10] },
    { action: 'credits', rect: [20, 20, 10, 10] },
    { action: 'hq_only_victory', rect: [0, 30, 10, 10] },
    { action: 'multiplayer', rect: [10, 30, 10, 10] },
    { action: 'exit', rect: [20, 30, 10, 10] }
  ]
  if (over.bad_action) regions.push({ action: 'launch', rect: [0, 40, 10, 10] })
  if (over.drop) {
    const [a, v] = String(over.drop).split(':')
    regions = regions.filter((r) => !(r.action === a && (v === undefined || r.value === v)))
  }
  if (over.dup) {
    const [a, v] = String(over.dup).split(':')
    regions.push({ action: a, value: v, rect: [0, 50, 10, 10] })
  }
  if (over.flat_rect) regions[0].rect = [0, 0, 10, 0]
  if (over.bad_color) regions[0].selected_color = 'red'
  if (over.bad_quad)
    regions[0].quad = [
      [0, 0],
      [10, 0],
      [10, 10]
    ]
  if (over.good_quad)
    regions[0].quad = [
      [0, 0],
      [10, 1],
      [10, 9],
      [0, 10]
    ]
  const m: O = {
    image: over.image ?? 'galaxyShaded.bmp',
    selected_color: '#ffd23c',
    readout: { rect: [0, 60, 30, 10], standard: 'Standard Game', hq_only: 'Headquarters Only', color: '#40ff40' },
    regions,
    credits: ['A line.']
  }
  if (over.no_readout) delete m.readout
  return m
}

/** tests/pack_validation.gd _pack(): a minimal two-sector, two-planet pack. */
function pack(sectorOver: O, planetOver: O, other: O): PackDocument {
  const g = (k: string, d: unknown) => (k in other ? other[k] : d)
  const manifest: O = {
    id: 'test',
    display_name: 'Test',
    schema_version: 1,
    faction_count: 1,
    neutral: { id: 'neutral', display_name: 'Neutral', color: '#5499ff' },
    unexplored_color: '#cccccc',
    map_image: g('map_image', 'galaxyShaded.bmp'),
    art_sets: g('art_sets', []),
    setup: { difficulty_default: 'medium', galaxy_sizes: g('sizes', ['standard', 'large', 'huge']), galaxy_size_default: g('size_default', 'standard') }
  }
  if ('menu' in other) manifest.menu = other.menu
  if ('victory_tips' in other) manifest.victory_tips = other.victory_tips
  const s1: O = { id: 'core', display_name: 'Core', ring: 1, starts_neutral: false, map: { x: 1, y: 1 }, min_size: 'standard', intel_tier: 'live', source_id: 1, ...sectorOver }
  const s2: O = { id: 'rim', display_name: 'Rim', ring: 2, starts_neutral: true, map: { x: 2, y: 2 }, min_size: 'large', intel_tier: 'presence', source_id: 2 }
  const p1: O = { id: 'core_world', display_name: 'Core World', sector: 'core', starts_inhabited: true, map: { x: 1, y: 1 }, artwork_id: 1, source_id: 10, ...planetOver }
  const p2: O = { id: 'rim_world', display_name: 'Rim World', sector: 'rim', starts_inhabited: false, map: { x: 2, y: 2 }, artwork_id: 2, source_id: 11 }
  const faction: O = {
    id: 'test_side',
    display_name: 'Test Side',
    color: '#ff0000',
    loyalty_label: 'Loyalty',
    occupation_support_policy: 'garrison_bonus',
    hq: { kind: 'fixed', planet: g('hq', 'core_world') },
    starting_planets: [{ planet: g('starting', 'core_world'), support: 100, explored: true, garrison: '' }],
    victory: { capture_characters: [g('victory', 'second_person')] },
    skin: g('skin', '')
  }
  if ('seed' in other) faction.seed = other.seed
  const c1: O = {
    id: g('char_id', 'first_person'),
    display_name: 'First Person',
    faction: g('char_faction', 'test_side'),
    is_major: true,
    ratings: { diplomacy: { base: 10, var: 0 } },
    can_command: g('char_command', ['general']),
    wont_betray: true,
    roles: g('char_roles', ['pilgrim']),
    starts_at: g('char_starts_at', ''),
    art: g('char_art', ''),
    special_power: { probability: 0, is_known_user: false, level: { base: 0, var: 0 }, can_train: false }
  }
  const c2: O = { id: 'second_person', display_name: 'Second Person', faction: 'test_side', is_major: false, ratings: {}, can_command: [], wont_betray: false, roles: g('char2_roles', []) }
  const facs: O[] = [
    {
      id: 'mine',
      display_name: 'Mine',
      family: 'mine',
      tier: g('fac_tier', 1),
      roles: g('fac_roles', ['extracts_raw']),
      buildable_by: g('fac_build', ['test_side']),
      construction_cost: 20,
      maintenance_cost: 0,
      stats: { processing_rate: 5 },
      source_family_id: 44
    }
  ]
  if (!other.drop_hq)
    facs.push({ id: 'hq', display_name: 'HQ', family: 'headquarters', tier: 1, roles: ['headquarters'], buildable_by: ['test_side'], construction_cost: 0, maintenance_cost: 0, stats: {}, source_family_id: 32 })
  const missions: O[] = [
    {
      id: 'recon',
      display_name: 'Recon',
      behaviour: g('mission_behaviour', 'reconnaissance'),
      available_to: g('mission_to', ['test_side']),
      spec_forces: g('mission_spec', ['scout']),
      length: { base: 7, spread: 3 },
      flags: { can_continue: true },
      targets: { hostile: true },
      source_id: 21
    }
  ]
  if ('mission2_behaviour' in other)
    missions.push({ id: 'second', display_name: 'Second', behaviour: other.mission2_behaviour, available_to: ['test_side'], spec_forces: [], length: { base: 1, spread: 0 }, flags: {}, targets: {}, source_id: 22 })
  const ranks: O = { none: 'None', novice: 'Novice', trainee: 'Trainee', student: 'Adept', knight: 'Warden', master: 'Grandmaster' }
  if ('gid_ranks_drop' in other) delete ranks[String(other.gid_ranks_drop)]
  const unitWeapon = String(g('unit_weapon', 'laser'))
  return docFromObjects(
    {
      'pack.json': manifest,
      'factions.json': { factions: [faction] },
      'map.json': { sectors: [s1, s2], planets: [p1, p2] },
      'characters.json': { characters: [c1, c2] },
      'facilities.json': { facilities: facs },
      'weapons.json': { weapons: [{ id: 'laser', display_name: 'Laser', roles: g('weapon_roles', ['fighter_accuracy_scaled']), arcs: true }] },
      'units.json': {
        units: [
          {
            id: 'scout',
            display_name: 'Scout',
            kind: g('unit_kind', 'fighter'),
            roles: g('unit_roles', []),
            buildable_by: g('unit_build', ['test_side']),
            construction_cost: 5,
            maintenance_cost: 1,
            weapons: { [unitWeapon]: { arcs: { fore: 8 }, range: 17 } },
            stats: { hull: 10 }
          }
        ]
      },
      'missions.json': { missions },
      'mission_tables.json': { tables: {} },
      'rules.json': [{ EntryId: 1 }],
      'setup.json': {
        side_lottery: [{ EntryId: 1 }],
        logistics: g('logistics', {
          garrison: {
            Type: 'CMUN/FACL (Hierarchical)',
            Entries: [{ ParentId: 1, ProbabilityThreshold: 1, Multiplier: 1, Assets: [g('setup_asset', { unit: 'scout' })] }]
          }
        })
      },
      'display.json': {
        categories: [
          {
            id: 'loyalty',
            display_name: 'Loyalty',
            modes: [
              {
                id: 'popular_support',
                label: 'Popular Support',
                title_from: 'loyalty_label',
                quantity: { kind: g('gid_kind', 'support') },
                tiers: g('gid_tiers', [
                  { min: 50, label: 'Loyal', flare: 'big' },
                  { min: 0, label: 'Hostile', flare: 'none' }
                ])
              }
            ]
          }
        ],
        galaxy_display_modes: g('gid_alt', ['popular_support']),
        special_power_ranks: ranks,
        terms: g('terms', { hyperdrive: 'Transit' }),
        loyalty_bar: g('loyalty_bar', []),
        icons: g('icons', {})
      }
    },
    'test'
  )
}

// The galaxy picture the test pack names exists; nothing else does (as in PACK_DIR).
const hasFile = (p: string) => p === 'galaxyShaded.bmp'

function errorsOf(doc: PackDocument): string[] {
  const { pack: p } = hydrate(doc)
  return runValidate(p, 'test', PACK_DIR, hasFile).map((i) => i.message)
}

function expectCase(doc: PackDocument, expect_: string): void {
  const errors = errorsOf(doc)
  expect(errors.some((e) => e.includes(expect_)), `expected an error containing: ${expect_}\n got: ${errors.join('\n')}`).toBe(true)
}

const FULL_SEED = { hq_facilities: 'garrison', hq_garrison: 'garrison', fleet: 'garrison' }

const cases: [string, PackDocument, string][] = [
  // Rule 10
  ['sector min_size not offered by pack.json', pack({ min_size: 'enormous' }, {}, {}), "min_size 'enormous' is not one of"],
  ['no sector in the smallest offered size', pack({ min_size: 'huge' }, {}, {}), 'that menu option would start an empty galaxy'],
  ['sector missing min_size', pack({ min_size: '' }, {}, {}), 'missing min_size'],
  // What day zero reads without asking (rules 19-22)
  ['a seeded side with a headquarters and no hq_garrison', pack({}, {}, { seed: { ...FULL_SEED, hq_garrison: '' } }), 'seed.hq_garrison is empty'],
  ['a seeded side with a headquarters and no fleet', pack({}, {}, { seed: { ...FULL_SEED, fleet: '' } }), 'seed.fleet is empty'],
  ['no core_system_facilities table for a Core sector', pack({}, {}, {}), "logistics has no 'core_system_facilities'"],
  ['no rim_system_facilities table for a Rim sector', pack({}, {}, {}), "logistics has no 'rim_system_facilities'"],
  [
    'a logistics table that is not an object',
    pack({}, {}, { logistics: { core_system_facilities: 'see the notes' } }),
    "logistics['core_system_facilities'] is not an object"
  ],
  ['two galaxy sizes where the game offers three', pack({ min_size: 'standard' }, {}, { sizes: ['standard', 'large'] }), 'setup.galaxy_sizes has 2'],
  // Rule 11
  ['menu region with an unknown action', pack({}, {}, { menu: menu({ bad_action: true }) }), "action 'launch' is not one of"],
  ['menu start region for a faction the pack does not have', pack({}, {}, { menu: menu({ start_value: 'nobody' }) }), "start value 'nobody' is not a faction id"],
  ['menu with no exit region', pack({}, {}, { menu: menu({ drop: 'exit' }) }), "no region for 'exit'"],
  ['menu with no region for an offered galaxy size', pack({}, {}, { menu: menu({ drop: 'galaxy_size:huge' }) }), "no region for 'galaxy_size:huge'"],
  ['menu with two regions for one difficulty', pack({}, {}, { menu: menu({ dup: 'difficulty:easy' }) }), "'difficulty:easy' has 2 regions"],
  ['menu image the pack does not ship', pack({}, {}, { menu: menu({ image: 'no-such-cockpit.png' }) }), 'is not in res://packs'],
  ['menu region rect with no height', pack({}, {}, { menu: menu({ flat_rect: true }) }), 'rect must be [x, y, w, h]'],
  ['menu region with a quad of three corners', pack({}, {}, { menu: menu({ bad_quad: true }) }), 'quad must be four [x, y] corners'],
  ['menu region with a bad selected_color', pack({}, {}, { menu: menu({ bad_color: true }) }), "selected_color: 'red' is not a #rrggbb color"],
  ['victory_tips missing a text', pack({}, {}, { victory_tips: { standard: 'Win.', hq_only: '' } }), "victory_tips: 'standard' and 'hq_only' texts are both required"],
  ['menu with no readout', pack({}, {}, { menu: menu({ no_readout: true }) }), "'readout' is required"],
  ['galaxy_size_default not offered', pack({}, {}, { size_default: 'enormous' }), "galaxy_size_default 'enormous' is not one of"],
  // Rule 12
  ['character with an unknown role', pack({}, {}, { char_roles: ['chosen_one'] }), "unknown role 'chosen_one'"],
  ['two characters cast as the pilgrim', pack({}, {}, { char_roles: ['pilgrim'], char2_roles: ['pilgrim'] }), "2 characters carry the story role 'pilgrim'"],
  ['unit with an unknown role', pack({}, {}, { unit_roles: ['planet_killer'] }), "unknown role 'planet_killer'"],
  ['mission with an unknown behaviour', pack({}, {}, { mission_behaviour: 'heist' }), "unknown behaviour 'heist'"],
  ['two missions for one behaviour', pack({}, {}, { mission2_behaviour: 'reconnaissance' }), "behaviour 'reconnaissance' is already 'recon'"],
  // Rule 3
  ['planet points at an undeclared sector', pack({}, { sector: 'nowhere' }, {}), "sector 'nowhere' is not declared"],
  ['duplicate planet id', pack({}, { id: 'rim_world' }, {}), 'duplicate id'],
  ['sector missing display_name', pack({ display_name: '' }, {}, {}), 'missing display_name'],
  // Rule 7
  ['starting planet absent from the map', pack({}, {}, { starting: 'dantooine' }), "starting planet 'dantooine' is not a planet id"],
  ['fixed HQ on a planet absent from the map', pack({}, {}, { hq: 'byss' }), "hq.planet 'byss' is not a planet id"],
  ['a display name used where a planet id belongs', pack({}, {}, { starting: 'Core World' }), "starting planet 'Core World' is not a planet id"],
  // Rule 5 / 3
  ['character on an undeclared faction', pack({}, {}, { char_faction: 'hutts' }), "faction 'hutts' is not declared"],
  ['duplicate character id', pack({}, {}, { char_id: 'second_person' }), 'duplicate id'],
  ['unknown can_command rank', pack({}, {}, { char_command: ['warlord'] }), "unknown can_command entry 'warlord'"],
  // Rule 15
  ['starts_at names a planet not on the map', pack({}, {}, { char_starts_at: 'nowhere' }), "starts_at 'nowhere' is not a planet id"],
  ['starts_at names a world the side does not hold at day zero', pack({}, {}, { char_starts_at: 'rim_world' }), 'is not a world test_side holds at day zero'],
  ['victory target who is not a character', pack({}, {}, { victory: 'nobody_at_all' }), "victory target 'nobody_at_all' is not a character id"],
  ['a display name used where a character id belongs', pack({}, {}, { victory: 'Second Person' }), "victory target 'Second Person' is not a character id"],
  // Facilities
  ['unknown facility role', pack({}, {}, { fac_roles: ['teleporter'] }), "unknown role 'teleporter'"],
  ['facility with no roles at all', pack({}, {}, { fac_roles: [] }), 'declares no roles'],
  ['facility buildable by an undeclared faction', pack({}, {}, { fac_build: ['hutts'] }), "buildable_by 'hutts' is not a declared faction"],
  ['a family whose only tier is 2', pack({}, {}, { fac_tier: 2 }), 'has no tier 1'],
  ['no headquarters role anywhere', pack({}, {}, { fac_roles: ['extracts_raw'], drop_hq: true }), "no facility has the 'headquarters' role"],
  // Units and weapons
  ['unit on an unknown kind', pack({}, {}, { unit_kind: 'spaceship' }), "unknown kind 'spaceship'"],
  ['unit buildable by an undeclared faction', pack({}, {}, { unit_build: ['hutts'] }), "buildable_by 'hutts' is not a declared faction"],
  ['unit carries a weapon weapons.json never declares', pack({}, {}, { unit_weapon: 'disruptor' }), 'weapons.json does not declare'],
  ['weapon with no roles', pack({}, {}, { weapon_roles: [] }), 'declares no roles'],
  ['unknown weapon role', pack({}, {}, { weapon_roles: ['vaporises'] }), "unknown role 'vaporises'"],
  // Missions
  ['mission available to an undeclared faction', pack({}, {}, { mission_to: ['hutts'] }), "available_to 'hutts' is not a declared faction"],
  ['mission needs a SpecForce no unit provides', pack({}, {}, { mission_spec: ['ghosts'] }), 'units.json does not declare'],
  // Display
  ['GID mode with a quantity kind the engine cannot compute', pack({}, {}, { gid_kind: 'vibes' }), "unknown quantity.kind 'vibes'"],
  [
    'GID tiers that do not end at the min-0 bare dot',
    pack({}, {}, { gid_tiers: [{ min: 3, label: 'Some', flare: 'big' }, { min: 1, label: 'One', flare: 'low' }] }),
    'the last tier must have min 0'
  ],
  [
    'GID tiers out of descending order',
    pack({}, {}, { gid_tiers: [{ min: 1, label: 'One', flare: 'low' }, { min: 3, label: 'Some', flare: 'big' }, { min: 0, label: 'None', flare: 'none' }] }),
    'must be ordered descending'
  ],
  ['GID tier with an unknown flare', pack({}, {}, { gid_tiers: [{ min: 1, label: 'One', flare: 'huge' }, { min: 0, label: 'None', flare: 'none' }] }), "unknown flare 'huge'"],
  ['Alt+N slot names a mode no category declares', pack({}, {}, { gid_alt: ['no_such_mode'] }), "galaxy_display_modes names 'no_such_mode'"],
  ['a special-power band with no label', pack({}, {}, { gid_ranks_drop: 'master' }), "no label for 'master'"],
  // Rule 17
  ['icons names a glyph the sector window has no corner for', pack({}, {}, { icons: { weather: 'x.png' } }), "icons names 'weather', which is not a corner glyph"],
  ['icons names a file the pack does not ship', pack({}, {}, { icons: { fleet: 'no-such-file.png' } }), "icons['fleet'] = 'no-such-file.png' is not in"],
  // Rule 16
  ['loyalty_bar names a side that is not a faction', pack({}, {}, { loyalty_bar: ['test_side', 'nobody'] }), "loyalty_bar names 'nobody', which is not a faction id"],
  ['loyalty_bar leaves a faction out', pack({}, {}, { loyalty_bar: ['nobody'] }), "loyalty_bar leaves out 'test_side'"],
  // Rule 14
  ['terms with a key the engine has no concept for', pack({}, {}, { terms: { warp: 'Warp Factor' } }), "terms names 'warp', which the engine has no concept for"],
  ['terms with an empty label', pack({}, {}, { terms: { hyperdrive: '' } }), "terms['hyperdrive'] is empty"],
  // Rule 13
  ['seeding row names a unit units.json never declares', pack({}, {}, { setup_asset: { unit: 'ghost_ship' } }), "unit 'ghost_ship' is not declared in units.json"],
  ['seeding row names a facility facilities.json never declares', pack({}, {}, { setup_asset: { facility: 'moisture_farm' } }), "facility 'moisture_farm' is not declared in facilities.json"],
  ['seeding row still uses the original FamilyId/AssetId numbers', pack({}, {}, { setup_asset: { FamilyId: 20, AssetId: 69 } }), 'names its asset by FamilyId/AssetId'],
  ['seeding row names nothing', pack({}, {}, { setup_asset: {} }), "names neither a 'unit' nor a 'facility'"],
  // Rule 9
  ['map_image not declared', pack({}, {}, { map_image: '' }), "'map_image' is required"],
  ['map_image names a file the pack does not ship', pack({}, {}, { map_image: 'no-such-file.bmp' }), 'is not in res://packs'],
  // Rule 18
  ['an art set the engine does not know', pack({}, {}, { art_sets: ['lotr-original'] }), "'lotr-original' is not an art set the engine knows"],
  ['art sets declared, a faction with no skin', pack({}, {}, { art_sets: ['swr-original'] }), "'skin' is required when the pack declares art_sets"],
  ['a skin the art set does not have', pack({}, {}, { art_sets: ['swr-original'], skin: 'republic' }), "skin 'republic' is not a side look of swr-original"],
  ['a skin with no art set', pack({}, {}, { skin: 'empire' }), "skin 'empire' needs pack.json art_sets"],
  ['an art reference that is not <kind>/<id>', pack({}, {}, { art_sets: ['swr-original'], skin: 'empire', char_art: 'luke_skywalker' }), 'must be [<art set>:]<kind>/<id>'],
  ['an art reference to an art set the pack does not declare', pack({}, { art: 'other-set:planets/coruscant' }, { art_sets: ['swr-original'], skin: 'empire' }), 'must be [<art set>:]<kind>/<id>'],
  ['an art reference with no art set declared', pack({}, {}, { char_art: 'characters/luke_skywalker' }), "'characters/luke_skywalker' needs pack.json art_sets"],
  ['a map_image in an art set the pack does not declare', pack({}, {}, { map_image: 'swr-original:screens/galaxy.png' }), "names art set 'swr-original', which art_sets does not declare"]
]

describe('the game validator cases (tests/pack_validation.gd)', () => {
  for (const [what, doc, expected] of cases) it(what, () => expectCase(doc, expected))

  it('an art-set pack: a skin, art references, art-set pictures is clean', () => {
    const doc = pack(
      {},
      { art: 'swr-original:planets/coruscant' },
      { art_sets: ['swr-original'], skin: 'empire', char_art: 'characters/luke_skywalker', map_image: 'swr-original:screens/galaxy.png' }
    )
    const { pack: p } = hydrate(doc)
    const c = new Collector()
    validateMap(p, PACK_DIR, hasFile, c)
    validateCharacters(p, c)
    validateMenu(p, PACK_DIR, hasFile, c)
    validateArt(p, c)
    expect(c.issues.map((i) => i.message)).toEqual([])
  })
})

describe('load-stage errors', () => {
  it('a missing file stops validation, as in PackLoader.Load', () => {
    const doc = docFromObjects({ 'pack.json': { id: 'x' } }, 'x')
    const errors = validatePack(doc).map((e) => e.message)
    expect(errors).toContain('factions.json: missing or empty.')
    expect(errors.some((e) => e.startsWith('pack.json:'))).toBe(false)
  })
  it('rule 1: the folder name must equal pack.json id', () => {
    const doc = pack({}, {}, {})
    doc.folderName = 'elsewhere'
    const errors = validatePack(doc).map((e) => e.message)
    expect(errors).toContain("pack.json: id 'test' does not match folder name 'elsewhere'.")
  })
})

// The game's rules 19-22, the quad check and the reworded hq message, word for word
// (pack_loader.gd at game main d4c01e2).
describe('new rules, word for word', () => {
  const ok = { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} }
  // The game's minimal test pack has one faction, which is itself an error; leave it out.
  const baseline = new Set(errorsOf(pack({}, {}, { logistics: ok })))
  const errorsOfNew = (doc: PackDocument) => errorsOf(doc).filter((e) => !baseline.has(e))
  it('rule 19: a seeded side with a headquarters', () => {
    expect(errorsOfNew(pack({}, {}, { logistics: ok, seed: { ...FULL_SEED, hq_garrison: '' } }))).toEqual([
      'factions.json[test_side]: seed.hq_garrison is empty; day zero seeds the headquarters from it.'
    ])
  })
  it('rule 19: a seeded side with no headquarters and a garrisoned starting world', () => {
    const doc = pack({}, {}, { logistics: ok, seed: { hq_facilities: '', hq_garrison: '', fleet: '' } })
    doc.edit('no hq, a garrison', (e) => {
      e.remove('factions.json', ['factions', 0, 'hq'])
      e.set('factions.json', ['factions', 0, 'starting_planets', 0, 'garrison'], 'garrison')
    })
    expect(errorsOfNew(doc)).toContain('factions.json[test_side]: seed.fleet is empty; day zero seeds each garrisoned starting world from it.')
    expect(errorsOfNew(doc).filter((e) => e.includes('seed.'))).toHaveLength(1)
  })
  it('rule 19: no seed, nothing to report', () => {
    expect(errorsOfNew(pack({}, {}, { logistics: ok }))).toEqual([])
  })
  it('rule 20: a table per ring the map uses', () => {
    expect(errorsOfNew(pack({}, {}, { logistics: { garrison: {} } }))).toEqual([
      "setup.json: logistics has no 'core_system_facilities'; day zero seeds every Core world from it.",
      "setup.json: logistics has no 'rim_system_facilities'; day zero seeds every Rim world from it."
    ])
  })
  it('rule 21: a logistics table that is not an object', () => {
    expect(errorsOfNew(pack({}, {}, { logistics: { ...ok, rim_system_facilities: 5 } }))).toEqual([
      "setup.json: logistics['rim_system_facilities'] is not an object."
    ])
  })
  it('rule 22: fewer than three galaxy sizes; more are allowed', () => {
    expect(errorsOfNew(pack({ min_size: 'standard' }, {}, { logistics: ok, sizes: ['standard', 'large'] }))).toEqual([
      'pack.json: setup.galaxy_sizes has 2; the game offers three sizes, so it needs at least 3.'
    ])
    expect(errorsOfNew(pack({}, {}, { logistics: ok, sizes: ['standard', 'large', 'huge', 'vast'] }))).toEqual([])
  })
  it('quad: four corners pass, three do not', () => {
    expect(errorsOfNew(pack({}, {}, { logistics: ok, menu: menu({ good_quad: true }) }))).toEqual([])
    expect(errorsOfNew(pack({}, {}, { logistics: ok, menu: menu({ bad_quad: true }) }))).toEqual([
      'pack.json menu.regions[0] (difficulty): quad must be four [x, y] corners - top-left, top-right, bottom-right, bottom-left.'
    ])
  })
  it("hq.kind 'hidden' with no placement", () => {
    const doc = pack({}, {}, { logistics: ok })
    doc.edit('hidden hq', (e) => e.set('factions.json', ['factions', 0, 'hq'], { kind: 'hidden' }))
    expect(errorsOfNew(doc)).toContain("factions.json[test_side]: hq.kind 'hidden' requires hq.placement (a planet id or 'random_rim').")
  })
})
