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
import { KNOWN_ADVISOR_EVENTS, KNOWN_VOICE_LINES } from '../src/core/vocab'
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
  if (over.monitor) m.monitors = [over.monitor]
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
  if ('card_image' in other) manifest.card_image = other.card_image
  if ('movies' in other) manifest.movies = other.movies
  if ('music' in other) manifest.music = other.music
  for (const k of ['advisor', 'voices', 'sounds', 'briefing', 'advice', 'report_backdrop']) if (k in other) manifest[k] = other[k]
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
  [
    'menu monitor for a region the menu does not have',
    pack({}, {}, { menu: menu({ monitor: { image: 'galaxyShaded.bmp', at: [0, 0], frames: 1, region: 'nowhere' } }) }),
    "region 'nowhere' is not a region of the menu"
  ],
  ['menu monitor with no frames', pack({}, {}, { menu: menu({ monitor: { image: 'galaxyShaded.bmp', at: [0, 0], frames: 0 } }) }), "'frames' must be 1 or more"],
  [
    'menu monitor with a selected_image and no region',
    pack({}, {}, { menu: menu({ monitor: { image: 'galaxyShaded.bmp', at: [0, 0], frames: 1, selected_image: 'galaxyShaded.bmp' } }) }),
    "'selected_image' needs the 'region' it shows for"
  ],
  [
    'menu monitor from an art set the pack does not declare',
    pack({}, {}, { menu: menu({ monitor: { image: 'swr-original:menu/empire.png', at: [0, 0], frames: 15 } }) }),
    "menu.monitors image: 'swr-original:menu/empire.png' names art set 'swr-original', which art_sets does not declare"
  ],
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

describe('Cockpit monitors, word for word', () => {
  const ok = { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} }
  const baseline = new Set(errorsOf(pack({}, {}, { logistics: ok, menu: menu({}) })))
  const monitorErrors = (monitor: O, extra: O = {}) => {
    const m = menu({ monitor })
    Object.assign(m, extra)
    return errorsOf(pack({}, {}, { logistics: ok, menu: m })).filter((e) => !baseline.has(e))
  }
  it('a good monitor passes', () => {
    expect(monitorErrors({ image: 'galaxyShaded.bmp', at: [0, 0], frames: 3, still: 2, region: 'difficulty:easy', selected_image: 'galaxyShaded.bmp' })).toEqual([])
  })
  it('every check, in the game order', () => {
    expect(monitorErrors({ at: [1], frames: 2, still: 2, selected_image: 'no-such.png' }, { monitor_fps: 0 })).toEqual([
      'pack.json menu.monitor_fps: must be above 0.',
      "pack.json menu.monitors[0]: 'image' is required.",
      "pack.json menu.monitors[0]: selected_image 'no-such.png' is not in res://packs/star-wars-rebellion.",
      "pack.json menu.monitors[0]: 'at' must be [x, y].",
      "pack.json menu.monitors[0]: 'still' must be a frame of the strip (0 to 1).",
      "pack.json menu.monitors[0]: 'selected_image' needs the 'region' it shows for."
    ])
  })
})

// Rule 23, the game's tests/movies.gd cases word for word (pack_loader.gd
// _validate_movies; the test pack's one side is test_side).
describe('movies (rule 23), as the game checks it', () => {
  const ok = { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} }
  const base = { logistics: ok, art_sets: ['swr-original'], skin: 'empire' }
  const baseline = new Set(errorsOf(pack({}, {}, base)))
  const movieErrors = (movies: unknown) => errorsOf(pack({}, {}, { ...base, movies })).filter((e) => !baseline.has(e))
  const cases: [unknown, string][] = [
    [{ launch: 'swr-original:movies/000.ogv' }, ''],
    [{ 'victory.test_side': ['swr-original:movies/108.ogv'] }, ''],
    [{ 'headquarters_lost.test_side': 'swr-original:movies/102.ogv', _comment: 'a note' }, ''],
    ['not an object', 'pack.json movies: must be an object of event -> movie.'],
    [
      { intro: 'swr-original:movies/000.ogv' },
      "pack.json movies: 'intro' is not an event. Known: launch, credits, system_destroyed, superweapon_sabotaged, and start./victory./defeat./headquarters_lost.<faction id>."
    ],
    [{ 'victory.rebels': 'swr-original:movies/105.ogv' }, "pack.json movies: 'victory.rebels' names no faction in factions.json."],
    [
      { launch: 'other-set:movies/000.ogv' },
      "pack.json movies['launch']: 'other-set:movies/000.ogv' is from art set 'other-set', which art_sets does not declare."
    ],
    [
      { launch: 'swr-original:movies/000.smk' },
      "pack.json movies['launch']: 'swr-original:movies/000.smk' is not an .ogv movie (Ogg Theora, the only kind the engine plays)."
    ],
    [{ launch: 'no-such-file.ogv' }, "pack.json movies['launch']: 'no-such-file.ogv' is not in res://packs/star-wars-rebellion."],
    [{ launch: [] }, "pack.json movies['launch']: names no movie."]
  ]
  for (const [movies, want] of cases)
    it(`${JSON.stringify(movies)} -> ${want === '' ? 'accepted' : 'refused'}`, () => {
      expect(movieErrors(movies)).toEqual(want === '' ? [] : [want])
    })
  it('reads the map as the game does: one or a list per event, comments skipped', () => {
    const { pack: p } = hydrate(pack({}, {}, { ...base, movies: { launch: [' swr-original:movies/000.ogv ', 'swr-original:movies/001.ogv'], credits: 'swr-original:movies/005.ogv', _comment: 'x' } }))
    expect(p.manifest.movies).toEqual({
      launch: ['swr-original:movies/000.ogv', 'swr-original:movies/001.ogv'],
      credits: ['swr-original:movies/005.ogv']
    })
    expect(p.manifest.moviesGiven).toBe(true)
  })
})

// Rule 24, the game's tests/music.gd cases word for word (pack_loader.gd
// _validate_music; the test pack's one side is test_side).
describe('music (rule 24), as the game checks it', () => {
  const ok = { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} }
  const base = { logistics: ok, art_sets: ['swr-original'], skin: 'empire' }
  const baseline = new Set(errorsOf(pack({}, {}, base)))
  const musicErrors = (music: unknown) => errorsOf(pack({}, {}, { ...base, music })).filter((e) => !baseline.has(e))
  const cases: [unknown, string][] = [
    [{ menu: 'swr-original:music/300.ogg' }, ''],
    [{ _comment: "an author's note", menu: 'swr-original:music/301.ogg' }, ''],
    [{ play: ['swr-original:music/301.ogg', 'swr-original:music/302.ogg'], battle_alert: 'swr-original:music/307.ogg' }, ''],
    [{ 'strong_advantage.test_side': 'swr-original:music/311.ogg', 'battle_draw.test_side': ['swr-original:music/315.ogg'] }, ''],
    ['not an object', 'pack.json music: must be an object of moment -> track.'],
    [
      { intro: 'swr-original:music/300.ogg' },
      "pack.json music: 'intro' is not a moment. Known: menu, play, battle_alert, and strong_advantage./advantage./disadvantage./battle_victory./battle_defeat./battle_draw.<faction id>."
    ],
    [{ 'advantage.rebels': 'swr-original:music/306.ogg' }, "pack.json music: 'advantage.rebels' names no faction in factions.json."],
    [{ menu: [] }, "pack.json music['menu']: names no track."],
    [{ menu: 5 }, "pack.json music['menu']: each track is a text reference."],
    [{ play: ['swr-original:music/301.ogg', ''] }, "pack.json music['play']: each track is a text reference."],
    [
      { menu: 'other-set:music/300.ogg' },
      "pack.json music['menu']: 'other-set:music/300.ogg' is from art set 'other-set', which art_sets does not declare."
    ],
    [{ menu: 'swr-original:music/300.wav' }, "pack.json music['menu']: 'swr-original:music/300.wav' is not an .ogg track (Ogg Vorbis)."],
    [{ menu: 'no-such-file.ogg' }, "pack.json music['menu']: 'no-such-file.ogg' is not in res://packs/star-wars-rebellion."]
  ]
  for (const [music, want] of cases)
    it(`${JSON.stringify(music)} -> ${want === '' ? 'accepted' : 'refused'}`, () => {
      expect(musicErrors(music)).toEqual(want === '' ? [] : [want])
    })
  it('reads the map as the game does: one or a list per moment, trimmed, comments skipped', () => {
    const { pack: p } = hydrate(
      pack({}, {}, { ...base, music: { menu: ' swr-original:music/300.ogg ', play: ['swr-original:music/301.ogg', 5], _comment: 'x' } })
    )
    expect(p.manifest.music).toEqual({ menu: ['swr-original:music/300.ogg'], play: ['swr-original:music/301.ogg'] })
    expect(p.manifest.musicGiven).toBe(true)
  })
})

// Rules 25-28, the game's tests/advisor.gd and tests/briefing.gd cases (pack_loader.gd
// _validate_advisor / _voices / _sounds / _briefing; the test pack's one side is
// test_side, its major character first_person).
describe('advisor, voices, sounds, briefing (rules 25-28), as the game checks them', () => {
  const ok = { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} }
  const base = { logistics: ok, art_sets: ['swr-original'], skin: 'empire' }
  const baseline = new Set(errorsOf(pack({}, {}, base)))
  const errs = (field: string, v: unknown) => errorsOf(pack({}, {}, { ...base, [field]: v })).filter((e) => !baseline.has(e))
  const events = KNOWN_ADVISOR_EVENTS.join(', ')
  const lines = KNOWN_VOICE_LINES.join(', ')
  const line = { anim: 'swr-original:anim/albrief/2101.fwa', sound: 'swr-original:sound/albrief/1155.ogg' }
  const cases: [string, unknown, string][] = [
    ['advisor', { repeat_days: 60, test_side: { research: { days: 10, messenger: { anim: 'swr-original:anim/alsprite/3331.fwa', sound: 'swr-original:sound/alsprite/1505.ogg' } } } }, ''],
    ['advisor', { test_side: { 'report.first_person': { agent: { sound: 'swr-original:sound/alsprite/1128.ogg', translated: true } } } }, ''],
    ['advisor', { test_side: { answer_in_transit: { agent: { anim: 'swr-original:anim/alsprite/3002.fwa', sound: 'swr-original:sound/alsprite/1096.ogg' } } } }, ''],
    ['advisor', { _comment: 'a note', test_side: { _comment: 'another', research: { _note: 'x', days: 5 } } }, ''],
    ['advisor', 'no', 'pack.json advisor: must be an object of side -> news.'],
    ['advisor', { rebels: {} }, "pack.json advisor: 'rebels' is neither a faction in factions.json nor one of repeat_days, frame_seconds."],
    ['advisor', { test_side: { gossip: {} } }, `pack.json advisor.test_side: 'gossip' is not news the droids speak about. Known: ${events}, and report./captured./released.<character id>.`],
    ['advisor', { test_side: { 'report.yoda_the_great': {} } }, "pack.json advisor.test_side['report.yoda_the_great']: names no character in characters.json."],
    ['advisor', { test_side: { research: { messenger: { anim: 'swr-original:anim/alsprite/3331.png' } } } }, "pack.json advisor.test_side['research'].messenger.anim: 'swr-original:anim/alsprite/3331.png' is not a .fwa file."],
    ['advisor', { test_side: { research: { agent: { translated: 'yes' } } } }, "pack.json advisor.test_side['research'].agent.translated: must be true or false."],
    ['advisor', { test_side: { research: 'loud' } }, "pack.json advisor.test_side['research']: must be an object (days, messenger, agent)."],
    ['advisor', { test_side: { research: { days: -1 } } }, "pack.json advisor.test_side['research']: days must be a number of days."],
    ['advisor', { frame_seconds: 0 }, 'pack.json advisor.frame_seconds: must be a positive number.'],
    ['voices', { first_person: { order: ['swr-original:sound/alsprite/1301.ogg', 'swr-original:sound/alsprite/1302.ogg'] } }, ''],
    ['voices', { yoda_the_great: {} }, "pack.json voices: 'yoda_the_great' is no character in characters.json."],
    ['voices', { first_person: { sings: 'swr-original:sound/alsprite/1.ogg' } }, `pack.json voices.first_person: 'sings' is not a line. Known: ${lines}.`],
    ['voices', { first_person: { order: [] } }, 'pack.json voices.first_person.order: names no sound.'],
    ['voices', { first_person: { order: 'other-set:sound/x/1.ogg' } }, "pack.json voices.first_person.order: 'other-set:sound/x/1.ogg' is from art set 'other-set', which art_sets does not declare."],
    ['sounds', { cockpit_exit: 'swr-original:sound/common/8002.ogg' }, ''],
    ['sounds', { cockpit_whistle: 'swr-original:sound/common/8003.ogg' }, "pack.json sounds: 'cockpit_whistle' is not a moment. Known: cockpit_galaxy_size, cockpit_load, cockpit_exit, cockpit_control, window_button, control_panel, control_panel_gid, window_open_sector, window_close_sector, window_open_system, window_close_system, window_minimize_alliance, window_minimize_empire, window_restore_alliance, window_restore_empire."],
    ['sounds', { cockpit_exit: 'swr-original:sound/common/8002.wav' }, "pack.json sounds.cockpit_exit: 'swr-original:sound/common/8002.wav' is not a .ogg file."],
    ['sounds', { cockpit_exit: 'no-such-file.ogg' }, "pack.json sounds.cockpit_exit: 'no-such-file.ogg' is not in res://packs/star-wars-rebellion."],
    ['briefing', { test_side: { steps: [{ focus: 12 }, line], skip: [line] } }, ''],
    ['briefing', { _comment: 'a note', test_side: { steps: [{ _note: 'x', focus: 1 }] } }, ''],
    ['briefing', 'no', 'pack.json briefing: must be an object of side -> the briefing.'],
    ['briefing', { rebels: {} }, "pack.json briefing: 'rebels' is not a faction in factions.json."],
    ['briefing', { test_side: [] }, 'pack.json briefing.test_side: must be an object (steps, skip).'],
    ['briefing', { test_side: { prologue: [] } }, "pack.json briefing.test_side: 'prologue' is neither steps, skip, views nor release."],
    ['briefing', { test_side: { release: 11 } }, ''],
    ['briefing', { test_side: { release: 'last' } }, 'pack.json briefing.test_side.release: must be a focus number.'],
    ['briefing', { test_side: { views: { '12': { show: 'off' }, '14': { caption: 'Ours', show: 'loyal:test_side' }, '18': { show: 'system:core_world' }, '7': { show: 'character:first_person' }, '3': { show: 'hq:test_side' } } } }, ''],
    ['briefing', { test_side: { views: [] } }, 'pack.json briefing.test_side.views: must be an object of focus number -> view.'],
    ['briefing', { test_side: { views: { first: { show: 'off' } } } }, "pack.json briefing.test_side.views['first']: the key must be a focus number."],
    ['briefing', { test_side: { views: { '1': { caption: 'x' } } } }, "pack.json briefing.test_side.views['1']: must be an object with a show."],
    ['briefing', { test_side: { views: { '1': { show: 'sparkle' } } } }, "pack.json briefing.test_side.views['1'].show: 'sparkle' is not a view. Known: off, military, unexplored, defenses, or mode:/loyal:/system:/hq:/character:<id>."],
    ['briefing', { test_side: { views: { '1': { show: 'system:alderaan_two' } } } }, "pack.json briefing.test_side.views['1'].show: 'system:alderaan_two' names nothing this pack has."],
    ['briefing', { test_side: { steps: 'all of it' } }, 'pack.json briefing.test_side.steps: must be a list of steps.'],
    ['briefing', { test_side: { steps: [7] } }, 'pack.json briefing.test_side.steps[0]: must be an object (a focus, or anim and sound).'],
    ['briefing', { test_side: { steps: [{ focus: 'Yavin' }] } }, 'pack.json briefing.test_side.steps[0].focus: must be a number.'],
    ['briefing', { test_side: { steps: [{ pause: 2 }] } }, 'pack.json briefing.test_side.steps[0]: is neither a focus nor a line (anim, sound).'],
    ['briefing', { test_side: { steps: [{ sound: 'swr-original:sound/albrief/1155.wav' }] } }, "pack.json briefing.test_side.steps[0].sound: 'swr-original:sound/albrief/1155.wav' is not a .ogg file."],
    ['briefing', { test_side: { steps: [{ anim: 'other-set:anim/albrief/2101.fwa' }] } }, "pack.json briefing.test_side.steps[0].anim: 'other-set:anim/albrief/2101.fwa' is from art set 'other-set', which art_sets does not declare."]
  ]
  for (const [field, v, want] of cases)
    it(`${field} ${JSON.stringify(v)} -> ${want === '' ? 'accepted' : 'refused'}`, () => {
      expect(errs(field, v)).toEqual(want === '' ? [] : [want])
    })
  it('reads them as the game does: comments left out at every level', () => {
    const { pack: p } = hydrate(pack({}, {}, { ...base, briefing: { _comment: 'x', test_side: { steps: [{ _n: 1, focus: 12 }] } }, sounds: { _c: 'y', cockpit_exit: 'swr-original:sound/common/8002.ogg' } }))
    expect(p.manifest.briefingRaw).toEqual({ test_side: { steps: [{ focus: 12 }] } })
    expect(p.manifest.briefingGiven).toBe(true)
    expect(p.manifest.soundsRaw).toEqual({ cockpit_exit: 'swr-original:sound/common/8002.ogg' })
    expect(p.manifest.advisorGiven).toBe(false)
  })
})

// Rule 29, the game's tests/advice.gd cases (pack_loader.gd _validate_advice).
describe('advice (rule 29), as the game checks it', () => {
  const ok = { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} }
  const base = { logistics: ok, art_sets: ['swr-original'], skin: 'empire' }
  const baseline = new Set(errorsOf(pack({}, {}, base)))
  const errs = (v: unknown) => errorsOf(pack({}, {}, { ...base, advice: v })).filter((e) => !baseline.has(e))
  const good = { messages: 'swr-original:advice.json', list: 'alliance', opening: 7, picture: 'swr-original:windows/advice.alliance.png' }
  const cases: [unknown, string][] = [
    [{ test_side: good }, ''],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance' } }, ''],
    ['no', 'pack.json advice: must be an object of side -> the advice.'],
    [{ rebels: good }, "pack.json advice: 'rebels' is not a faction in factions.json."],
    [{ test_side: [] }, 'pack.json advice.test_side: must be an object (messages, list, opening, picture, events, periodic, every).'],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', voice: 'x' } }, "pack.json advice.test_side: 'voice' is none of messages, list, opening, picture, events, periodic, every."],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', events: { sector: 6, missions: 4 }, periodic: 1, every: 300 } }, ''],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', events: [] } }, 'pack.json advice.test_side.events: must be an object of window -> group.'],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', events: { cantina: 2 } } }, "pack.json advice.test_side.events: 'cantina' is not a window. Known: sector, manufacturing, fleet, defenses, missions."],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', events: { fleet: 'three' } } }, 'pack.json advice.test_side.events.fleet: must be a group number.'],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', periodic: -1 } }, 'pack.json advice.test_side.periodic: must be a group number.'],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', every: 0 } }, 'pack.json advice.test_side.every: must be a number of ticks.'],
    [{ test_side: { list: 'alliance' } }, 'pack.json advice.test_side: names no messages file.'],
    [{ test_side: { messages: 'swr-original:advice.txt', list: 'alliance' } }, "pack.json advice.test_side.messages: 'swr-original:advice.txt' is not a .json file."],
    [{ test_side: { messages: 'other-set:advice.json', list: 'alliance' } }, "pack.json advice.test_side.messages: 'other-set:advice.json' is from art set 'other-set', which art_sets does not declare."],
    [{ test_side: { messages: 'swr-original:advice.json' } }, "pack.json advice.test_side.list: must name the file's list for this side."],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', opening: 'start' } }, 'pack.json advice.test_side.opening: must be a group number.'],
    [{ test_side: { messages: 'swr-original:advice.json', list: 'alliance', picture: 'swr-original:windows/advice.bmp' } }, "pack.json advice.test_side.picture: 'swr-original:windows/advice.bmp' is not a .png file."]
  ]
  for (const [v, want] of cases)
    it(`advice ${JSON.stringify(v)} -> ${want === '' ? 'accepted' : 'refused'}`, () => {
      expect(errs(v)).toEqual(want === '' ? [] : [want])
    })
  it('reads it as the game does: comments left out', () => {
    const { pack: p } = hydrate(pack({}, {}, { ...base, advice: { _comment: 'x', test_side: { _n: 1, ...good } } }))
    expect(p.manifest.adviceRaw).toEqual({ test_side: good })
    expect(p.manifest.adviceGiven).toBe(true)
  })
})

// Rule 30 (pack_loader.gd _validate_report_backdrop). Its sides are not checked
// against factions.json, and Godot's is_valid_hex_number takes one leading sign.
describe('report_backdrop (rule 30), as the game checks it', () => {
  const base = { logistics: { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} } }
  const baseline = new Set(errorsOf(pack({}, {}, base)))
  const errs = (v: unknown) => errorsOf(pack({}, {}, { ...base, report_backdrop: v })).filter((e) => !baseline.has(e))
  const notColour = (side: string, h: string) => `pack.json report_backdrop.${side}: '${h}' is not an "rrggbb" colour.`
  const cases: [unknown, string[]][] = [
    [null, []],
    [{ alliance: ['000000', '0000FF', 'a0b1c2'], anyone: ['ffffff'] }, []],
    [{ alliance: ['+abcde', '-00000'] }, []],
    ['no', ['pack.json report_backdrop: must be an object of side -> colours.']],
    [['000000'], ['pack.json report_backdrop: must be an object of side -> colours.']],
    [{ alliance: [] }, ['pack.json report_backdrop.alliance: must be a non-empty list of "rrggbb" colours.']],
    [{ alliance: '000000', empire: ['000000'] }, ['pack.json report_backdrop.alliance: must be a non-empty list of "rrggbb" colours.']],
    [
      { alliance: ['#00000', '#000000', '00000', 'ggg000', 'abcdef ', '++abcd'] },
      [notColour('alliance', '#00000'), notColour('alliance', '#000000'), notColour('alliance', '00000'), notColour('alliance', 'ggg000'), notColour('alliance', 'abcdef '), notColour('alliance', '++abcd')]
    ],
    [
      { alliance: [123456, 12345, null, true, ['a']] },
      [notColour('alliance', '123456.0'), notColour('alliance', '12345.0'), notColour('alliance', '<null>'), notColour('alliance', 'true'), notColour('alliance', '["a"]')]
    ]
  ]
  for (const [v, want] of cases)
    it(`report_backdrop ${JSON.stringify(v)} -> ${want.length === 0 ? 'accepted' : 'refused'}`, () => {
      expect(errs(v)).toEqual(want)
    })
  it('absent is not given', () => {
    const { pack: p } = hydrate(pack({}, {}, base))
    expect(p.manifest.reportBackdropGiven).toBe(false)
  })
  it('reads it as the game does: comments left out', () => {
    const { pack: p } = hydrate(pack({}, {}, { ...base, report_backdrop: { _comment: 'x', alliance: ['000000'] } }))
    expect(p.manifest.reportBackdropRaw).toEqual({ alliance: ['000000'] })
    expect(p.manifest.reportBackdropGiven).toBe(true)
    expect(errs({ _comment: ['not', 'a', 'side'], alliance: ['000000'] })).toEqual([])
  })
})

describe('card_image, as the game checks it', () => {
  const ok = { core_system_facilities: {}, rim_system_facilities: {}, garrison: {} }
  it('a missing file is not an error', () => {
    expect(errorsOf(pack({}, {}, { logistics: ok, card_image: 'no-such-picture.jpg' }))).toEqual(errorsOf(pack({}, {}, { logistics: ok })))
  })
  it('an art-set reference must name a declared set', () => {
    expect(errorsOf(pack({}, {}, { logistics: ok, card_image: 'swr-original:screens/card.png' }))).toContain(
      "pack.json card_image: 'swr-original:screens/card.png' names art set 'swr-original', which art_sets does not declare."
    )
  })
})
