// Every pack field, described once. Help texts come from SCHEMA.md and the
// game's loader; where the engine depends on something, the help says so.

import { ci, isDict } from '../../../core/model'
import {
  FACILITY_STAT_KEYS,
  GID_KIND_ARGS,
  INTEL_TIERS,
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
  MISSION_FLAG_KEYS,
  MISSION_TARGET_KEYS,
  RANDOM_RIM,
  SPECIAL_POWER_RANK_KEYS,
  UNIT_STAT_KEYS,
  UNUSED_MISSION_TABLES
} from '../../../core/vocab'
import { KNOWN_ART_SETS } from '../../../core/vocab'
import { createElement } from 'react'
import { FixedRange, LogisticsEntries, LotteryMatrix, RuleMatrix } from './special'
import type { Ctx, Dict, FieldDef, FieldProps, ListPageDef, Opt } from './types'

// ---- option sources ----

const named = (list: { id: string; displayName: string }[]): Opt[] => list.map((r) => ({ value: r.id, label: r.displayName || undefined }))
export const factionOpts = (c: Ctx) => named(c.pack.factions)
export const planetOpts = (c: Ctx) => named(c.pack.planets)
export const sectorOpts = (c: Ctx) => named(c.pack.sectors)
export const characterOpts = (c: Ctx) => named(c.pack.characters)
export const unitOpts = (c: Ctx) => named(c.pack.units)
export const facilityOpts = (c: Ctx) => named(c.pack.facilities)
export const logisticsOpts = (c: Ctx) => Object.keys(c.pack.setup.logistics)
export const familyOpts = (c: Ctx) => [...new Set(c.pack.facilities.map((f) => f.family).filter(Boolean))]
export const sizeOpts = (c: Ctx) => c.pack.manifest.setup?.galaxySizes ?? []
export const modeOpts = (c: Ctx) => c.pack.display.categories.flatMap((cat) => cat.modes.map((m) => ({ value: m.id, label: m.label || undefined })))
const skinOpts = (c: Ctx) => c.pack.manifest.artSets.flatMap((s) => KNOWN_ART_SETS[s] ?? [])

const nextId = (base: string, taken: string[]) => {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}_${n}`)) n++
  return `${base}_${n}`
}

const provenance: FieldDef[] = [
  { key: 'source_id', label: 'Source id', kind: 'int', help: 'Provenance: the original table row. Kept for traceability.' },
  { key: 'string_id', label: 'String id', kind: 'int', help: 'Provenance. The exporter maps art to rows with it (Encyclopedia id = string_id - 4096).' }
]
const costs: FieldDef[] = [
  { key: 'construction_cost', label: 'Construction cost', kind: 'int' },
  { key: 'maintenance_cost', label: 'Maintenance cost', kind: 'int' },
  { key: 'research_order', label: 'Research order', kind: 'int' },
  { key: 'research_cost', label: 'Research cost', kind: 'int' }
]

// ---- pack.json ----

export const packFields: FieldDef[] = [
  { key: 'id', label: 'Pack id', kind: 'text', required: true, help: 'Must equal the folder name; the game installs an imported pack under it. Letters, digits, - and _.' },
  { key: 'display_name', label: 'Display name', kind: 'text', required: true, help: "The pack picker card's title." },
  { key: 'summary', label: 'Summary', kind: 'text', multiline: true, wide: true, help: 'One sentence on the setting, for the picker card.' },
  {
    key: 'version',
    label: 'Version',
    kind: 'text',
    placeholder: '1.0',
    help: "This pack's own version, e.g. 1.3. The game shows it on the pack's card, and keeps every version a player has installed so they can join a game on any of them. Raise it each time you share a changed copy: numbers with dots are put in order (1.10 comes after 1.9)."
  },
  {
    key: 'download_url',
    label: 'Download page',
    kind: 'text',
    wide: true,
    placeholder: 'a page where players can download this pack',
    help: 'A page where players can get this pack - a folder, a forum topic, a channel - that stays the same from version to version. The game offers it to a player who joins a game on this pack without having it. Only an http:// or https:// link is offered.'
  },
  { key: 'schema_version', label: 'Schema version', kind: 'int', required: true, help: 'The engine reads version 1.' },
  { key: 'faction_count', label: 'Faction count', kind: 'int', required: true, help: 'Must equal the number of factions (2-4). The Factions page keeps it in step.' },
  {
    key: 'neutral',
    label: 'Neutral side',
    kind: 'object',
    help: 'The unaligned side. It is not a faction; no faction may use its id.',
    addValue: () => ({ id: 'neutral', display_name: 'Neutral', color: '#9a9a9a' }),
    fields: [
      { key: 'id', label: 'Id', kind: 'text', required: true },
      { key: 'display_name', label: 'Display name', kind: 'text', required: true },
      { key: 'color', label: 'Colour', kind: 'color', required: true }
    ]
  },
  { key: 'unexplored_color', label: 'Unexplored colour', kind: 'color', required: true },
  {
    key: 'map_image',
    label: 'Map picture',
    kind: 'file',
    required: true,
    extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'],
    allowArtSet: true,
    help: 'The galaxy backdrop: a file in the pack, or "<art set>:<path>" (e.g. swr-original:screens/galaxy.png).'
  },
  {
    key: 'card_image',
    label: 'Card picture',
    kind: 'file',
    extensions: ['jpg', 'jpeg', 'png'],
    allowArtSet: true,
    preview: true,
    help: "The picture on this pack's card in the game's launch screen, shown when the map picture can't be (its art set isn't imported). A JPG or PNG in the pack, or \"<art set>:<path>\". Optional: if the file is missing, the card just has no picture."
  },
  {
    key: 'map_image_rect',
    label: 'Map picture placement',
    kind: 'rect',
    float: true,
    help: 'Where the picture sits in map space, [x, y, w, h]. Leave empty to use the picture\'s own pixels. Map coordinates are travel time - move the picture, never the planets.'
  },
  {
    key: 'art_sets',
    label: 'Art sets',
    kind: 'multi',
    options: Object.keys(KNOWN_ART_SETS),
    help: "Wear the original game's look from the player's own exported art set. Each faction then needs a skin."
  },
  {
    key: 'setup',
    label: 'Game setup',
    kind: 'object',
    addValue: () => ({ difficulty_default: 'easy', galaxy_sizes: ['standard', 'large', 'huge'], galaxy_size_default: 'standard' }),
    fields: [
      { key: 'difficulty_default', label: 'Default difficulty', kind: 'select', options: KNOWN_DIFFICULTIES, allowEmpty: true },
      {
        key: 'galaxy_sizes',
        label: 'Galaxy sizes',
        kind: 'strings',
        help: 'At least three, smallest first: the game offers three sizes (Standard, Large, Huge); more are allowed. Renaming one here does not rename sector min_size values.'
      },
      { key: 'galaxy_size_default', label: 'Default galaxy size', kind: 'select', options: (c) => sizeOpts(c), allowEmpty: true }
    ]
  },
  {
    key: 'victory_tips',
    label: 'Victory tips',
    kind: 'object',
    optional: true,
    help: 'The win-condition tooltips on the Multiplayer Options screen.',
    addValue: () => ({ standard: '', hq_only: '' }),
    fields: [
      { key: 'standard', label: 'Standard game', kind: 'text', multiline: true, required: true },
      { key: 'hq_only', label: 'Headquarters only', kind: 'text', multiline: true, required: true }
    ]
  },
  {
    key: 'credits',
    label: 'Credits',
    kind: 'strings',
    help: "Who made the setting, one line each; the game's credits screen shows them. A Cockpit menu's own credits (Cockpit page) replace these when it has any."
  }
]

// ---- factions ----

export const factionsPage: ListPageDef = {
  page: 'factions',
  title: 'Factions',
  intro: 'The playable sides (2-4). Order matters: day zero still places characters only for the first two, and it sets the default loyalty-bar order.',
  file: 'factions.json',
  listPath: ['factions'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'faction',
  orderNote: 'Faction order is load-bearing (day zero, default loyalty bar, multiplayer host side).',
  newId: (c) => nextId('new_faction', c.pack.factions.map((f) => f.id)),
  newItem: (_c, id) => ({
    id,
    display_name: 'New Faction',
    color: '#888888',
    loyalty_label: 'Support for New Faction',
    hq: { kind: 'hidden', placement: RANDOM_RIM },
    starting_planets: []
  }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'faction' },
    { key: 'display_name', label: 'Display name', kind: 'text', required: true },
    {
      key: 'adjective',
      label: 'Adjective',
      kind: 'text',
      placeholder: '(the display name)',
      help: `The side as an adjective in the game's own sentences: "the Imperial fleet", "Alliance forces" (the battle alert and results). Optional; the display name when empty.`
    },
    { key: 'color', label: 'Colour', kind: 'color', required: true, help: 'Map markers and the GID legend.' },
    { key: 'loyalty_label', label: 'Loyalty label', kind: 'text', required: true, help: 'GID title for modes with title_from: loyalty_label.' },
    { key: 'agent_name', label: 'Agent name', kind: 'text', placeholder: 'Agent' },
    {
      key: 'skin',
      label: 'Skin',
      kind: 'select',
      options: (c) => skinOpts(c),
      allowEmpty: true,
      help: "Which of the art set's side looks this faction wears. Required with art_sets, forbidden without."
    },
    {
      key: 'hq',
      label: 'Headquarters',
      kind: 'object',
      addValue: () => ({ kind: 'hidden', placement: RANDOM_RIM }),
      fields: [
        { key: 'kind', label: 'Kind', kind: 'select', options: KNOWN_HQ_KINDS, required: true, help: 'fixed: a named world, captured to win. hidden: placed at day zero, sabotaged to win.' },
        { key: 'planet', label: 'Planet', kind: 'select', options: (c) => planetOpts(c), allowEmpty: true, showIf: (r) => ci(r, 'kind') === 'fixed' },
        {
          key: 'placement',
          label: 'Placement',
          kind: 'select',
          options: (c) => [{ value: RANDOM_RIM, label: 'A random Rim world' }, ...planetOpts(c)],
          allowEmpty: true,
          showIf: (r) => ci(r, 'kind') === 'hidden'
        },
        { key: 'movable', label: 'Movable', kind: 'bool' }
      ]
    },
    { key: 'occupation_support_policy', label: 'Occupation support policy', kind: 'select', options: KNOWN_OCCUPATION_POLICIES, allowEmpty: true },
    {
      key: 'starting_planets',
      label: 'Starting planets',
      kind: 'list',
      help: 'The first entry is the "first world" where characters with starts_at_first_world appear.',
      orderNote: 'The first starting planet is the "first world".',
      itemTitle: (it) => String(ci(it, 'planet') ?? '?'),
      newItem: () => ({ planet: '', support: 100, explored: true }),
      fields: [
        { key: 'planet', label: 'Planet', kind: 'select', options: (c) => planetOpts(c), required: true },
        { key: 'support', label: 'Support %', kind: 'int', min: 0, max: 100 },
        { key: 'explored', label: 'Explored', kind: 'bool' },
        { key: 'garrison', label: 'Garrison table', kind: 'select', options: (c) => logisticsOpts(c), allowEmpty: true }
      ]
    },
    {
      key: 'seed',
      label: 'Day-zero seeding',
      kind: 'object',
      optional: true,
      help: 'Logistics tables (Setup → Logistics). With seed present, day zero reads hq_facilities, hq_garrison and fleet - fill all three.',
      addValue: () => ({ hq_facilities: '', hq_garrison: '', fleet: '', procedural_fleet: '' }),
      fields: ['hq_facilities', 'hq_garrison', 'fleet', 'procedural_fleet'].map(
        (k): FieldDef => ({ key: k, label: k.replace(/_/g, ' '), kind: 'select', options: (c) => logisticsOpts(c), allowEmpty: true })
      )
    },
    {
      key: 'victory',
      label: 'Victory',
      kind: 'object',
      optional: true,
      addValue: () => ({ capture_characters: [] }),
      fields: [{ key: 'capture_characters', label: 'Characters to capture', kind: 'multi', options: (c) => characterOpts(c) }]
    }
  ]
}

// ---- map ----

export const sectorsPage: ListPageDef = {
  page: 'sectors',
  title: 'Sectors',
  intro: 'Order is load-bearing: the galaxy is built in file order and day zero draws random numbers as it goes.',
  file: 'map.json',
  listPath: ['sectors'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'sector',
  orderNote: 'Sector order changes day zero (it consumes the random stream in file order).',
  newId: (c) => nextId('new_sector', c.pack.sectors.map((s) => s.id)),
  newItem: (c, id) => ({ id, display_name: 'New Sector', ring: 2, starts_neutral: true, map: { x: 0, y: 0 }, min_size: sizeOpts(c)[0] ?? 'standard' }),
  subtitle: (r) => `ring ${String(ci(r, 'ring') ?? '?')} · ${String(ci(r, 'min_size') ?? '')}`,
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'sector' },
    { key: 'display_name', label: 'Display name', kind: 'text', required: true },
    { key: 'ring', label: 'Ring', kind: 'int', help: '1 = Core, 2 or more = Rim (hidden HQs with random_rim go here).' },
    { key: 'starts_neutral', label: 'Starts neutral', kind: 'bool' },
    {
      key: 'map',
      label: 'Position',
      kind: 'object',
      addValue: () => ({ x: 0, y: 0 }),
      fields: [
        { key: 'x', label: 'x', kind: 'int', required: true },
        { key: 'y', label: 'y', kind: 'int', required: true }
      ]
    },
    { key: 'min_size', label: 'Smallest galaxy size', kind: 'select', options: (c) => sizeOpts(c), required: true, help: 'Sizes are cumulative: a standard sector is in every game.' },
    { key: 'intel_tier', label: 'Intel tier', kind: 'select', options: INTEL_TIERS, allowEmpty: true, help: 'Reserved; nothing reads it yet.' },
    ...provenance
  ]
}

export const planetsPage: ListPageDef = {
  page: 'planets',
  pictures: 'planets',
  title: 'Planets',
  intro: 'Order is load-bearing (day zero). Coordinates are travel time; drag them on the Galaxy Map.',
  file: 'map.json',
  listPath: ['planets'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'planet',
  orderNote: 'Planet order changes day zero.',
  group: (r) => String(ci(r, 'sector') ?? ''),
  newId: (c) => nextId('new_planet', c.pack.planets.map((p) => p.id)),
  newItem: (c, id) => ({ id, display_name: 'New Planet', sector: c.pack.sectors[0]?.id ?? '', starts_inhabited: true, map: { x: 0, y: 0 } }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'planet' },
    { key: 'display_name', label: 'Display name', kind: 'text', required: true },
    { key: 'sector', label: 'Sector', kind: 'select', options: (c) => sectorOpts(c), required: true },
    { key: 'starts_inhabited', label: 'Starts inhabited', kind: 'bool' },
    {
      key: 'map',
      label: 'Position',
      kind: 'object',
      addValue: () => ({ x: 0, y: 0 }),
      help: 'Distance between worlds sets travel days.',
      fields: [
        { key: 'x', label: 'x', kind: 'int', required: true },
        { key: 'y', label: 'y', kind: 'int', required: true }
      ]
    },
    { key: 'artwork_id', label: 'Planet sprite', kind: 'int', help: 'Picks planet_sprites/<n>.png; 0 = none.' },
    { key: 'art', label: 'Art reference', kind: 'art', artKind: 'planets' },
    ...provenance
  ]
}

// ---- roster ----

export const charactersPage: ListPageDef = {
  page: 'characters',
  pictures: 'characters',
  title: 'Characters',
  intro: 'Order is load-bearing: day zero walks the roster in file order.',
  file: 'characters.json',
  listPath: ['characters'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'character',
  orderNote: 'Character order changes day-zero placement.',
  group: (r) => String(ci(r, 'faction') ?? ''),
  subtitle: (r) => (ci(r, 'is_major') ? 'major' : 'minor'),
  newId: (c) => nextId('new_character', c.pack.characters.map((x) => x.id)),
  newItem: (c, id) => ({
    id,
    display_name: 'New Character',
    faction: c.pack.factions[0]?.id ?? '',
    is_major: false,
    ratings: {},
    can_command: [],
    roles: []
  }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'character' },
    { key: 'display_name', label: 'Display name', kind: 'text', required: true },
    { key: 'faction', label: 'Faction', kind: 'select', options: (c) => factionOpts(c), required: true },
    { key: 'is_major', label: 'Major character', kind: 'bool', help: 'Recruitment needs a major character.' },
    { key: 'wont_betray', label: "Won't betray", kind: 'bool' },
    {
      key: 'starts_at',
      label: 'Starts at',
      kind: 'select',
      options: (c) => planetOpts(c),
      allowEmpty: true,
      emptyLabel: '— (use the placement roles)',
      help: "A world the character's side holds at day zero; wins over the placement roles."
    },
    { key: 'roles', label: 'Roles', kind: 'multi', options: KNOWN_CHARACTER_ROLES, help: 'Placement (starts_at_…) and story parts; each story part may be held by one character.' },
    { key: 'can_command', label: 'Can command', kind: 'multi', options: KNOWN_COMMAND_RANKS },
    { key: 'ratings', label: 'Ratings', kind: 'ratings', help: 'Each rating is base ± variance; a missing rating is 0.' },
    {
      key: 'special_power',
      label: 'Special power',
      kind: 'object',
      optional: true,
      addValue: () => ({ probability: 0, is_known_user: false, level: { base: 0, var: 0 }, can_train: false }),
      fields: [
        { key: 'probability', label: 'Probability %', kind: 'int' },
        { key: 'is_known_user', label: 'Known user', kind: 'bool' },
        { key: 'level', label: 'Level', kind: 'baseVar' },
        { key: 'can_train', label: 'Can train', kind: 'bool' }
      ]
    },
    { key: 'art', label: 'Art reference', kind: 'art', artKind: 'characters' },
    ...provenance
  ]
}

// ---- military ----

export const weaponsPage: ListPageDef = {
  page: 'weapons',
  title: 'Weapons',
  intro: 'ORDER CHANGES COMBAT: the engine sums weapon damage in this order, rounding after each. Reordering is a balance change.',
  file: 'weapons.json',
  listPath: ['weapons'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'weapon',
  orderNote: 'Weapon order changes combat results (damage is summed in file order).',
  newId: (c) => nextId('new_weapon', c.pack.weapons.map((w) => w.id)),
  newItem: (_c, id) => ({ id, display_name: 'New Weapon', roles: ['fighter_accuracy_scaled'], arcs: true }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'weapon' },
    { key: 'display_name', label: 'Display name', kind: 'text' },
    { key: 'roles', label: 'Roles', kind: 'multi', options: KNOWN_WEAPON_ROLES, help: 'What the weapon does; the tactical engine branches on these. At least one.' },
    { key: 'arcs', label: 'Fires per arc', kind: 'bool', help: 'Off for torpedoes and bombs (units then give an amount instead of arcs).' },
    { key: 'observed_ranges', label: 'Observed ranges', kind: 'ints', help: 'Informational only; range is set per unit.' }
  ]
}

export const unitsPage: ListPageDef = {
  page: 'units',
  pictures: 'units',
  title: 'Units',
  file: 'units.json',
  listPath: ['units'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'unit',
  group: (r) => String(ci(r, 'kind') ?? ''),
  subtitle: (r) => (Array.isArray(ci(r, 'buildable_by')) ? (ci(r, 'buildable_by') as string[]).join(', ') : ''),
  newId: (c) => nextId('new_unit', c.pack.units.map((u) => u.id)),
  newItem: (c, id) => ({ id, display_name: 'New Unit', kind: 'capital_ship', roles: [], buildable_by: c.pack.factions.map((f) => f.id), weapons: {}, stats: {} }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'unit' },
    { key: 'display_name', label: 'Display name', kind: 'text', required: true },
    { key: 'kind', label: 'Kind', kind: 'select', options: KNOWN_UNIT_KINDS, required: true },
    { key: 'roles', label: 'Roles', kind: 'multi', options: KNOWN_UNIT_ROLES },
    { key: 'buildable_by', label: 'Buildable by', kind: 'multi', options: (c) => factionOpts(c), help: 'None ticked = every side.' },
    ...costs,
    { key: 'weapons', label: 'Weapons', kind: 'unitWeapons', help: 'Per-arc throw for weapons that fire per arc; an amount for arc-less ones; range per weapon (fighters leave it out).' },
    {
      key: 'stats',
      label: 'Stats',
      kind: 'kv',
      valueKind: 'number',
      suggest: (_c, r) => UNIT_STAT_KEYS[String(ci(r, 'kind') ?? '')] ?? [],
      help: 'Leave inapplicable stats out (never null). hyperdrive is a time multiplier: lower is faster, 0 cannot jump.'
    },
    { key: 'art', label: 'Art reference', kind: 'art', artKind: 'units' },
    { key: 'source_family_id', label: 'Source family id', kind: 'int', help: 'Provenance.' },
    ...provenance
  ]
}

export const facilitiesPage: ListPageDef = {
  page: 'facilities',
  pictures: 'facilities',
  title: 'Facilities',
  file: 'facilities.json',
  listPath: ['facilities'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'facility',
  group: (r) => String(ci(r, 'family') ?? ''),
  subtitle: (r) => `tier ${String(ci(r, 'tier') ?? 1)}`,
  newId: (c) => nextId('new_facility', c.pack.facilities.map((f) => f.id)),
  newItem: (_c, id) => ({ id, display_name: 'New Facility', family: id, tier: 1, roles: ['produces_unit'], buildable_by: [], stats: {} }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'facility' },
    { key: 'display_name', label: 'Display name', kind: 'text', required: true },
    {
      key: 'family',
      label: 'Family',
      kind: 'select',
      free: true,
      options: (c) => familyOpts(c),
      required: true,
      help: 'Tiers of one building share a family; every family needs a tier 1. GID facility_count modes name families.'
    },
    { key: 'tier', label: 'Tier', kind: 'int', placeholder: '1' },
    { key: 'roles', label: 'Roles', kind: 'multi', options: KNOWN_FACILITY_ROLES, help: 'At least one. Some facility must be the headquarters.' },
    { key: 'buildable_by', label: 'Buildable by', kind: 'multi', options: (c) => factionOpts(c), help: 'None ticked = every side.' },
    ...costs,
    { key: 'stats', label: 'Stats', kind: 'kv', valueKind: 'number', suggest: () => FACILITY_STAT_KEYS },
    { key: 'art', label: 'Art reference', kind: 'art', artKind: 'facilities' },
    { key: 'source_family_id', label: 'Source family id', kind: 'int', help: 'Provenance.' },
    ...provenance
  ]
}

// ---- missions ----

export const missionsPage: ListPageDef = {
  page: 'missions',
  pictures: 'missions',
  title: 'Missions',
  file: 'missions.json',
  listPath: ['missions'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  refKind: 'mission',
  subtitle: (r) => String(ci(r, 'behaviour') || 'no behaviour'),
  newId: (c) => nextId('new_mission', c.pack.missions.map((m) => m.id)),
  newItem: (c, id) => ({
    id,
    display_name: 'New Mission',
    behaviour: '',
    available_to: c.pack.factions.map((f) => f.id),
    spec_forces: [],
    length: { base: 7, spread: 3 },
    flags: {},
    targets: {}
  }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id', refKind: 'mission', help: "Its outcome table in Mission Tables shares this id; renaming renames the table too." },
    { key: 'display_name', label: 'Display name', kind: 'text', required: true },
    {
      key: 'behaviour',
      label: 'Engine behaviour',
      kind: 'select',
      options: KNOWN_BEHAVIOURS,
      allowEmpty: true,
      emptyLabel: '— (inert: the engine runs nothing)',
      help: 'Which engine behaviour this mission is. One mission per behaviour.'
    },
    { key: 'available_to', label: 'Available to', kind: 'multi', options: (c) => factionOpts(c), help: 'None ticked means NOBODY can run it.' },
    { key: 'spec_forces', label: 'Special forces', kind: 'multi', options: (c) => named(c.pack.units.filter((u) => u.kind === 'spec_force')) },
    {
      key: 'length',
      label: 'Length (days)',
      kind: 'object',
      addValue: () => ({ base: 7, spread: 3 }),
      fields: [
        { key: 'base', label: 'Base', kind: 'int', help: '0 or less uses the engine fallback.' },
        { key: 'spread', label: 'Spread', kind: 'int' }
      ]
    },
    {
      key: 'flags',
      label: 'Flags',
      kind: 'object',
      addValue: () => ({}),
      fields: MISSION_FLAG_KEYS.map((k): FieldDef => ({ key: k, label: k.replace(/_/g, ' '), kind: 'bool' }))
    },
    {
      key: 'targets',
      label: 'Targets',
      kind: 'object',
      addValue: () => ({}),
      fields: MISSION_TARGET_KEYS.map((k): FieldDef => ({ key: k, label: k, kind: 'bool' }))
    },
    { key: 'art', label: 'Art reference', kind: 'art', artKind: 'missions' },
    { key: 'source_id', label: 'Source id', kind: 'int', help: 'Provenance; also keys the engine catalog.' }
  ]
}

export const missionTablesPage: ListPageDef = {
  page: 'missionTables',
  title: 'Mission Tables',
  intro: 'Outcome step functions: entries must ascend by Threshold. The engine reads foil, decoy, evasion, escape, informants and uprising_start by name, and each mission by its own id (a mission without one uses the fitted formula). troop_decoy, character_search, resource_event and uprising_end are carried over from the original, but the game does not use them yet.',
  file: 'mission_tables.json',
  listPath: ['tables'],
  mode: 'map',
  idKey: '',
  refKind: 'missionTable',
  newId: (c) => nextId('new_table', Object.keys(c.pack.missionTables)),
  newItem: () => ({ description: '', entries: [{ id: 1, field2: 0, threshold: 0, value: 0 }] }),
  note: (_c, _rec, key) =>
    UNUSED_MISSION_TABLES.includes(String(key))
      ? createElement('div', { className: 'callout' }, "No effect in the game yet: no game code reads this table. It is kept from the original's data, so editing it changes nothing in play.")
      : null,
  fields: [
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'source_file', label: 'Source file', kind: 'text', help: 'Provenance only.' },
    {
      key: 'entries',
      label: 'Entries',
      kind: 'list',
      orderNote: 'Entries must ascend by Threshold.',
      itemTitle: (it, i) => `${i + 1}: ≥ ${String(ci(it, 'threshold') ?? '?')} → ${String(ci(it, 'value') ?? '?')}`,
      newItem: (_c, parent) => {
        const list = ci(parent, 'entries')
        const n = Array.isArray(list) ? list.length : 0
        return { id: n + 1, field2: 0, threshold: 0, value: 0 }
      },
      fields: [
        { key: 'threshold', label: 'Threshold', kind: 'int', required: true },
        { key: 'value', label: 'Value', kind: 'int', required: true },
        { key: 'id', label: 'Row id', kind: 'int', help: 'Provenance.' },
        { key: 'field2', label: 'field2', kind: 'int', help: 'Provenance.' }
      ]
    }
  ]
}

// ---- rules and setup ----

function byFactionMatrix(label: string, lottery = false): FieldDef {
  return { key: 'by_faction', label, kind: 'custom', wide: true, render: (p: FieldProps) => createElement(lottery ? LotteryMatrix : RuleMatrix, p) }
}

export const rulesPage: ListPageDef = {
  page: 'rules',
  title: 'Rules',
  intro: 'The game rules, keyed by the integer EntryId the engine reads (about 160 of the 213 are read by id). Never renumber or drop rows.',
  file: 'rules.json',
  listPath: [],
  mode: 'array',
  idKey: 'EntryId',
  nameKey: 'Name',
  numericId: true,
  newId: (c) => String(Math.max(0, ...c.pack.rules.map((r) => Number(ci(r, 'EntryId')) || 0)) + 1),
  newItem: (c, id) => ({
    EntryId: Number(id),
    Name: 'New rule',
    ParameterId: 0,
    Development: 0,
    Multiplayer: 0,
    by_faction: Object.fromEntries(c.pack.factions.map((f) => [f.id, { easy: 0, medium: 0, hard: 0 }]))
  }),
  fields: [
    { key: 'EntryId', label: 'EntryId', kind: 'id', numeric: true, help: 'What the engine reads it by. Changing it breaks whatever read the old number.' },
    { key: 'Name', label: 'Name', kind: 'text' },
    { key: 'ParameterId', label: 'ParameterId', kind: 'int' },
    { key: 'Development', label: 'Development', kind: 'int', help: 'The fallback for structural reads.' },
    { key: 'Multiplayer', label: 'Multiplayer', kind: 'int', help: 'The head-to-head column.' },
    byFactionMatrix('Per side and difficulty')
  ]
}

export const sideLotteryPage: ListPageDef = {
  page: 'sideLottery',
  title: 'Side Lottery',
  intro: 'Per-perspective tables: for each side viewing, each difficulty, a number per side. The engine reads EntryIds 30-35 by name.',
  file: 'setup.json',
  listPath: ['side_lottery'],
  mode: 'array',
  idKey: 'EntryId',
  nameKey: 'Name',
  numericId: true,
  newId: (c) => String(Math.max(0, ...c.pack.setup.sideLottery.map((r) => Number(ci(r, 'EntryId')) || 0)) + 1),
  newItem: (c, id) => {
    const ids = c.pack.factions.map((f) => f.id)
    const cells = Object.fromEntries(ids.map((f) => [f, 0]))
    return {
      EntryId: Number(id),
      Name: 'New entry',
      GroupId: 0,
      by_faction: Object.fromEntries(ids.map((p) => [p, { easy: { ...cells }, medium: { ...cells }, hard: { ...cells } }])),
      dev: { ...cells },
      mp: { ...cells }
    }
  },
  fields: [
    { key: 'EntryId', label: 'EntryId', kind: 'id', numeric: true },
    { key: 'Name', label: 'Name', kind: 'text' },
    { key: 'GroupId', label: 'GroupId', kind: 'int' },
    byFactionMatrix('Per perspective, difficulty and side', true),
    { key: 'dev', label: 'Development', kind: 'kv', valueKind: 'int', keyOptions: (c) => factionOpts(c).map((o) => o.value) },
    { key: 'mp', label: 'Multiplayer', kind: 'kv', valueKind: 'int', keyOptions: (c) => factionOpts(c).map((o) => o.value) }
  ]
}


export const logisticsPage: ListPageDef = {
  page: 'logistics',
  title: 'Logistics',
  intro:
    'Day-zero seeding tables. A Type containing "SYFC" is a flat system-facilities table; anything else is hierarchical (a carrier slot, then its payload). core_system_facilities and rim_system_facilities are read by name.',
  file: 'setup.json',
  listPath: ['logistics'],
  mode: 'map',
  idKey: '',
  refKind: 'logistics',
  newId: (c) => nextId('new_table', Object.keys(c.pack.setup.logistics)),
  newItem: () => ({ Type: 'CMUN/FACL (Hierarchical)', Description: 'SeedFamilyTableEntry', Entries: [] }),
  subtitle: (r) => (String(ci(r, 'Type') ?? '').includes('SYFC') ? 'flat' : 'hierarchical'),
  fields: [
    { key: 'Type', label: 'Type', kind: 'select', free: true, options: ['SYFC (Flat)', 'CMUN/FACL (Hierarchical)'], required: true, help: 'Load-bearing: containing "SYFC" makes it flat.' },
    { key: 'Description', label: 'Description', kind: 'text' },
    { key: 'source_file', label: 'Source file', kind: 'text', help: 'Provenance only.' },
    {
      key: 'fixed_range',
      label: 'Fixed range',
      kind: 'custom',
      render: (p: FieldProps) => createElement(FixedRange, p),
      help: '[first rule EntryId, max rule EntryId]: deploy parents first..max by position. Empty: roll 1-100 and take the last entry whose threshold is at or below the roll.'
    },
    { key: 'Entries', label: 'Entries', kind: 'custom', wide: true, render: (p: FieldProps) => createElement(LogisticsEntries, p) }
  ]
}

// ---- display ----

export const gidPage: ListPageDef = {
  page: 'gid',
  title: 'GID Modes',
  intro: 'The Galactic Information Display: categories of modes, each a quantity the engine computes bucketed into tiers. The first mode of the first category is the default.',
  file: 'display.json',
  listPath: ['categories'],
  mode: 'array',
  idKey: 'id',
  nameKey: 'display_name',
  newId: (c) => nextId('new_category', c.pack.display.categories.map((x) => x.id)),
  newItem: (_c, id) => ({
    id,
    display_name: 'New Category',
    modes: [{ id: `${id}_mode`, label: 'New Mode', quantity: { kind: 'support' }, tiers: [{ min: 50, label: 'High', flare: 'big' }, { min: 0, label: 'Low', flare: 'none' }] }]
  }),
  fields: [
    { key: 'id', label: 'Id', kind: 'id' },
    { key: 'display_name', label: 'Display name', kind: 'text' },
    {
      key: 'modes',
      label: 'Modes',
      kind: 'list',
      itemTitle: (it) => `${String(ci(it, 'label') ?? '')} (${String(ci(it, 'id') ?? '?')})`,
      newItem: () => ({ id: 'new_mode', label: 'New Mode', quantity: { kind: 'support' }, tiers: [{ min: 0, label: 'None', flare: 'none' }] }),
      fields: [
        { key: 'id', label: 'Id', kind: 'id', refKind: 'gidMode' },
        { key: 'label', label: 'Label', kind: 'text', required: true, help: 'Part of the lockstep game signature when active - renaming it changes replays.' },
        { key: 'title', label: 'Title', kind: 'text', help: 'Key-panel title; empty = the label.' },
        { key: 'title_from', label: 'Title from', kind: 'select', options: ['loyalty_label'], allowEmpty: true },
        {
          key: 'quantity',
          label: 'Quantity',
          kind: 'object',
          addValue: () => ({ kind: 'support' }),
          fields: [
            { key: 'kind', label: 'Kind', kind: 'select', options: KNOWN_GID_KINDS, required: true },
            { key: 'status', label: 'Status', kind: 'select', options: GID_KIND_ARGS.my_fleets!.values!, showIf: (r) => ci(r, 'kind') === 'my_fleets', required: true },
            { key: 'busy', label: 'Busy', kind: 'bool', showIf: (r) => ci(r, 'kind') === 'personnel' },
            {
              key: 'key',
              label: 'Key',
              kind: 'select',
              required: true,
              options: (_c, r) => GID_KIND_ARGS[String(ci(r, 'kind'))]?.values ?? [],
              showIf: (r) => ci(r, 'kind') === 'status_figure' || ci(r, 'kind') === 'defence_figure'
            },
            { key: 'family', label: 'Facility family', kind: 'select', options: (c) => familyOpts(c), required: true, showIf: (r) => ci(r, 'kind') === 'facility_count' },
            { key: 'role', label: 'Role', kind: 'select', options: GID_KIND_ARGS.idle_producer!.values!, required: true, showIf: (r) => ci(r, 'kind') === 'idle_producer' },
            { key: 'section', label: 'Section', kind: 'select', options: GID_KIND_ARGS.intel_line_count!.values!, required: true, showIf: (r) => ci(r, 'kind') === 'intel_line_count' }
          ]
        },
        {
          key: 'tiers',
          label: 'Tiers',
          kind: 'list',
          help: 'Descending by min; the last must be min 0 (the bare dot every world falls into).',
          itemTitle: (it) => `≥ ${String(ci(it, 'min') ?? '?')}: ${String(ci(it, 'label') ?? '')}`,
          newItem: () => ({ min: 0, label: '', flare: 'none' }),
          fields: [
            { key: 'min', label: 'Min', kind: 'float', required: true },
            { key: 'label', label: 'Label', kind: 'text' },
            { key: 'flare', label: 'Flare', kind: 'select', options: KNOWN_GID_FLARES, allowEmpty: true, emptyLabel: '— (none)' }
          ]
        }
      ]
    }
  ]
}

export const displaySettingsFields: FieldDef[] = [
  {
    key: 'galaxy_display_modes',
    label: 'Alt+1…9 display slots',
    kind: 'orderedRefs',
    options: (c) => modeOpts(c),
    help: 'The GID modes on the number keys, in order.'
  },
  {
    key: 'special_power_ranks',
    label: 'Special-power band labels',
    kind: 'object',
    addValue: () => Object.fromEntries(SPECIAL_POWER_RANK_KEYS.map((k) => [k, k])),
    help: 'All six are required. The engine owns the thresholds (10/20/80/100/120).',
    fields: SPECIAL_POWER_RANK_KEYS.map((k): FieldDef => ({ key: k, label: k, kind: 'text', required: true }))
  },
  {
    key: 'terms',
    label: 'Terms',
    kind: 'kv',
    valueKind: 'text',
    keyOptions: () => KNOWN_TERMS,
    help: "What this setting calls the engine's concepts on screen. A key left out takes the engine's neutral label."
  },
  {
    key: 'loyalty_bar',
    label: 'Loyalty bar order',
    kind: 'orderedRefs',
    unique: true,
    options: (c) => factionOpts(c),
    help: 'Sides left to right on the sector window. Name every faction once, or leave it empty for faction order.'
  },
  {
    key: 'icons',
    label: 'Corner icons',
    kind: 'object',
    optional: true,
    addValue: () => ({}),
    help: "The sector window's corner glyphs: white on transparent, 16 px, files in the pack.",
    fields: KNOWN_CORNER_ICONS.map((k): FieldDef => ({ key: k, label: k, kind: 'file', extensions: ['png'] }))
  }
]

// ---- the Cockpit menu ----

export const menuFields: FieldDef[] = [
  { key: 'image', label: 'Cockpit picture', kind: 'file', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'], allowArtSet: true, required: true, help: 'No baked-in selection marks: the engine draws the brackets.' },
  { key: 'selected_color', label: 'Selection colour', kind: 'color' },
  {
    key: 'readout',
    label: 'Victory readout',
    kind: 'object',
    addValue: () => ({ rect: [0, 0, 100, 20], standard: 'Standard Game', hq_only: 'Headquarters Only Victory', color: '#40ff40' }),
    fields: [
      { key: 'rect', label: 'Rect', kind: 'rect', float: true, required: true, help: "In the picture's own pixels; the game truncates to whole pixels." },
      { key: 'standard', label: 'Standard text', kind: 'text', required: true },
      { key: 'hq_only', label: 'HQ-only text', kind: 'text', required: true },
      { key: 'color', label: 'Colour', kind: 'color' }
    ]
  },
  {
    key: 'regions',
    label: 'Regions',
    kind: 'list',
    itemTitle: (it) => `${String(ci(it, 'action') ?? '?')}${ci(it, 'value') ? ':' + String(ci(it, 'value')) : ''}`,
    newItem: () => ({ action: 'exit', rect: [0, 0, 40, 20] }),
    fields: [
      { key: 'action', label: 'Action', kind: 'select', options: KNOWN_MENU_ACTIONS, required: true },
      {
        key: 'value',
        label: 'Value',
        kind: 'select',
        required: true,
        options: (c, r) =>
          ci(r, 'action') === 'difficulty' ? KNOWN_DIFFICULTIES : ci(r, 'action') === 'galaxy_size' ? sizeOpts(c) : ci(r, 'action') === 'start' ? factionOpts(c) : [],
        showIf: (r) => ['difficulty', 'galaxy_size', 'start'].includes(String(ci(r, 'action')))
      },
      { key: 'rect', label: 'Rect', kind: 'rect', float: true, required: true, help: "In the picture's own pixels; the game truncates to whole pixels." },
      {
        key: 'quad',
        label: 'Screen corners',
        kind: 'quad',
        help: "Optional: the screen this region shows, as four corners in the picture's pixels, for a screen seen at an angle. The selection brackets follow them; clicks still use the rect. Drag the corners on the picture."
      },
      { key: 'tooltip', label: 'Tooltip', kind: 'text' },
      { key: 'selected_color', label: 'Selection colour', kind: 'color' }
    ]
  },
  {
    key: 'monitor_fps',
    label: 'Monitor speed',
    kind: 'float',
    placeholder: '10',
    help: 'Frames per second for every monitor picture below. Optional; 10 when empty. Must be above 0.'
  },
  {
    key: 'monitors',
    label: 'Monitor pictures',
    kind: 'list',
    help: "Pictures on the Cockpit's monitors (the rotating side icon of the manual's Fig. 2.2). Each is a strip of equal frames side by side, played in a loop. A monitor whose picture is missing stays dark.",
    itemTitle: (it, i) => {
      const img = String(ci(it, 'image') ?? '')
      const region = String(ci(it, 'region') ?? '')
      return `${i + 1}: ${img.split('/').pop() || '(no picture)'}${region ? ' - while ' + region : ''}`
    },
    newItem: () => ({ image: '', at: [0, 0], frames: 1 }),
    fields: [
      {
        key: 'image',
        label: 'Picture strip',
        kind: 'file',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'],
        allowArtSet: true,
        preview: 'strip',
        required: true,
        help: 'A file in the pack, or "<art set>:<path>" (e.g. swr-original:menu/easy.png).'
      },
      { key: 'at', label: 'Top-left', kind: 'point', required: true, help: "Where the strip's first frame sits, in the Cockpit picture's pixels." },
      { key: 'frames', label: 'Frames', kind: 'int', min: 1, placeholder: '1', help: 'How many equal frames the strip holds, side by side. 1 when empty.' },
      { key: 'still', label: 'Hold frame', kind: 'int', min: 0, help: 'Optional: show only this frame (0 is the first) instead of playing the strip.' },
      {
        key: 'region',
        label: 'While chosen',
        kind: 'select',
        allowEmpty: true,
        emptyLabel: '(always)',
        options: (c) => regionKeys(c),
        help: 'Optional: the region whose choice switches this monitor to its selected picture.'
      },
      {
        key: 'selected_image',
        label: 'Selected picture strip',
        kind: 'file',
        extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'],
        allowArtSet: true,
        preview: 'strip',
        showIf: (r) => String(ci(r, 'region') ?? '') !== '' || ci(r, 'selected_image') !== undefined,
        help: 'Shown instead while that region is chosen.'
      }
    ]
  },
  { key: 'credits', label: 'Credits', kind: 'strings', help: "The Cockpit's credits. When this has any lines, the game shows them instead of the pack's own credits (Pack page)." }
]

/** A Cockpit region's key, as a monitor names it: its action, or action:value. */
function regionKeys(c: Ctx): string[] {
  const keys = (c.pack.manifest.menu?.regions ?? []).map((r) => (r.value ? `${r.action}:${r.value}` : r.action))
  return [...new Set(keys)]
}

export const LIST_PAGES: ListPageDef[] = [
  factionsPage,
  sectorsPage,
  planetsPage,
  charactersPage,
  unitsPage,
  weaponsPage,
  facilitiesPage,
  missionsPage,
  missionTablesPage,
  rulesPage,
  sideLotteryPage,
  logisticsPage,
  gidPage
]

export function isDictRow(v: unknown): v is Dict {
  return isDict(v)
}
