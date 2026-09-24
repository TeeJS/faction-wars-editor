// The engine's vocabulary, copied from the game's loader so the editor offers
// exactly what the game accepts. Source of truth (read-only here):
//   TeeJS/faction-wars src/data/pack_loader.gd:7-72, :244
//   TeeJS/faction-wars src/game/mission_catalog.gd:29-44 (+ enums.gd MissionType)
// When the game adds a word, add it here and to tests/vocab.test.ts.

export const SUPPORTED_SCHEMA_VERSION = 1

/** The 12 files every pack must carry, in the game's load order (pack_loader.gd:94-105). */
export const PACK_JSON_FILES = [
  'pack.json',
  'factions.json',
  'map.json',
  'characters.json',
  'facilities.json',
  'units.json',
  'weapons.json',
  'missions.json',
  'mission_tables.json',
  'rules.json',
  'setup.json',
  'display.json'
] as const
export type PackJsonFile = (typeof PACK_JSON_FILES)[number]

export const KNOWN_HQ_KINDS = ['fixed', 'hidden']
export const KNOWN_OCCUPATION_POLICIES = ['garrison_bonus', 'occupation_penalty']
export const KNOWN_COMMAND_RANKS = ['admiral', 'commander', 'general']
export const KNOWN_FACILITY_ROLES = [
  'headquarters', 'extracts_raw', 'refines', 'produces_unit', 'produces_troop',
  'produces_facility', 'planet_defense', 'shield', 'disable', 'anti_ship', 'superweapon_shield'
]
export const KNOWN_WEAPON_ROLES = [
  'fighter_accuracy_scaled', 'no_fighter_effect', 'requires_shields_down', 'squadron_only'
]
export const KNOWN_UNIT_KINDS = ['capital_ship', 'fighter', 'troop', 'spec_force']
export const KNOWN_GID_KINDS = [
  'support', 'uprising', 'my_fleets', 'personnel', 'status_figure', 'facility_count',
  'idle_producer', 'defence_figure', 'intel_line_count', 'constant_zero'
]
export const KNOWN_GID_FLARES = ['big', 'mid', 'low', 'none']
export const SPECIAL_POWER_RANK_KEYS = ['none', 'novice', 'trainee', 'student', 'knight', 'master']
export const KNOWN_TERMS = [
  // unit stats
  'hyperdrive', 'sublight', 'shield', 'hull', 'detection', 'weapons',
  'bombardment', 'bombardment_defense', 'bombardment_modifier',
  'maintenance', 'squadron_size', 'fighter_capacity', 'troop_capacity',
  // the economy
  'energy', 'raw_materials', 'refined_materials', 'mine', 'mines', 'refinery', 'refineries',
  // the two defence kinds, as prose plurals
  'planetary_shields', 'orbital_batteries',
  // unit kinds, singular and plural
  'fighter_squadron', 'fighter_squadrons', 'trooper_regiment', 'trooper_regiments',
  // movement between systems
  'in_transit',
  // the five ship systems tactical damage tracks
  'system_shield_recharge', 'system_weapon_recharge', 'system_tractor', 'system_engines', 'system_hyperdrive',
  // a standing defence's state tag in the Defenses window
  'shield_active', 'weapon_armed'
]
export const KNOWN_MENU_ACTIONS = [
  'difficulty', 'galaxy_size', 'start', 'load_game', 'credits', 'hq_only_victory', 'multiplayer', 'exit'
]
export const KNOWN_DIFFICULTIES = ['easy', 'medium', 'hard']
export const KNOWN_CHARACTER_ROLES = [
  'starts_at_first_world', 'starts_at_hq', 'starts_at_random_holding',
  'pilgrim', 'heir', 'dark_lord', 'dark_master', 'smuggler', 'companion'
]
export const SINGLETON_CHARACTER_ROLES = ['pilgrim', 'heir', 'dark_lord', 'dark_master', 'smuggler', 'companion']
export const KNOWN_UNIT_ROLES = ['superweapon', 'garrison_troop']
/** The art sets the engine knows, and the side looks (skins) each has. */
export const KNOWN_ART_SETS: Record<string, string[]> = { 'swr-original': ['alliance', 'empire'] }
export const ART_KINDS = ['characters', 'units', 'facilities', 'missions', 'planets']
export const KNOWN_CORNER_ICONS = ['manufacturing', 'defenses', 'fleet', 'mission', 'uprising']

/** Enums.MissionType members in snake_case, then the two scripted stays (mission_catalog.gd). */
export const KNOWN_BEHAVIOURS = [
  'diplomacy', 'espionage', 'recruitment', 'incite_uprising', 'subdue_uprising', 'reconnaissance',
  'abduction', 'assassination', 'rescue', 'sabotage', 'superweapon_sabotage', 'ship_design_research',
  'troop_training_research', 'facility_design_research', 'special_power_training',
  'dagobah', 'palace'
]

// ---- Editor-only knowledge: engine requirements the loader does not check. ----

/** Mission-table ids the engine looks up by name (mission_manager.gd, captivity_manager.gd,
 * informant_manager.gd, story_manager.gd via mission_table_manager.gd; uprising_table.gd). */
export const ENGINE_MISSION_TABLES = ['foil', 'decoy', 'evasion', 'escape', 'informants', 'uprising_start']
/** Tables both shipped packs carry that no game code reads yet (the game agent's research,
 * 2026-09-24): editing them changes nothing in play. */
export const UNUSED_MISSION_TABLES = ['troop_decoy', 'character_search', 'resource_event', 'uprising_end']
/** Packs that ship with the game; the importer refuses a zip that reuses their id. */
export const SHIPPED_PACK_IDS = ['star-wars-rebellion', 'ww2']
/** The hidden-HQ sentinel: a random planet in a sector with ring > 1. */
export const RANDOM_RIM = 'random_rim'

export const RATING_KEYS = [
  'diplomacy', 'espionage', 'combat', 'leadership', 'loyalty',
  'ship_research', 'troop_research', 'facility_research'
]
export const MISSION_FLAG_KEYS = [
  'can_continue', 'scripted', 'return_on_abort', 'target_known_required', 'abort_on_blockade', 'can_escape', 'can_kill'
]
export const MISSION_TARGET_KEYS = ['friendly', 'neutral', 'hostile']
export const INTEL_TIERS = ['live', 'presence']

/** The stat keys the engine reads, per unit kind (observed in the engine; SCHEMA.md section 6). */
export const UNIT_STAT_KEYS: Record<string, string[]> = {
  capital_ship: [
    'detection', 'shield', 'sublight', 'maneuverability', 'hyperdrive', 'hyperdrive_damaged', 'hull',
    'tractor_power', 'tractor_range', 'gravity_well', 'interdiction_strength', 'bombardment',
    'damage_control', 'weapon_recharge', 'shield_recharge', 'fighter_capacity', 'troop_capacity'
  ],
  fighter: [
    'detection', 'shield', 'sublight', 'maneuverability', 'hyperdrive', 'hyperdrive_damaged', 'bombardment', 'squadron_size'
  ],
  troop: ['detection', 'bombardment_defense', 'attack', 'defense'],
  spec_force: ['detection', 'diplomacy_rating', 'espionage_rating', 'combat_rating', 'leadership_rating']
}
export const FACILITY_STAT_KEYS = ['bombardment_defense', 'processing_rate', 'weapon_rating', 'shield_strength']
export const ARC_KEYS = ['fore', 'aft', 'starboard', 'port']

/** GID quantity kinds and the one argument each takes (gid.gd:281-313, intel_manager.gd). */
export const GID_KIND_ARGS: Record<string, { arg: string; values?: string[]; type?: 'bool' | 'family' } | null> = {
  support: null,
  uprising: null,
  my_fleets: { arg: 'status', values: ['awaiting_orders', 'enroute'] },
  personnel: { arg: 'busy', type: 'bool' },
  status_figure: { arg: 'key', values: ['energy', 'materials', 'energy_used', 'mines', 'garrison_requirement'] },
  facility_count: { arg: 'family', type: 'family' },
  idle_producer: { arg: 'role', values: ['produces_unit', 'produces_troop', 'produces_facility'] },
  defence_figure: { arg: 'key', values: ['batteries', 'shields', 'shield_strength', 'ion_cannons'] },
  intel_line_count: { arg: 'section', values: ['fighters', 'troopers'] },
  constant_zero: null
}

/** The rule EntryId the travel-time divisor comes from (rule_id.gd SpaceTravelDistanceDiv). */
export const RULE_SPACE_TRAVEL_DISTANCE_DIV = 74
