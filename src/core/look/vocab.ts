// The look's vocabulary, word for word from the game (TeeJS/faction-wars at
// origin/main 4ad04bf): src/data/pack_loader.gd KNOWN_LOOK_* and the message
// categories (validation rule 31), and src/ui/look.gd CONTRAST_PAIRS,
// DEFAULT_SIZES, DEFAULT_METRICS. SCHEMA.md section 15 documents each one.

/** Every colour a look must declare, in the game's order (rule 31: all required). */
export const KNOWN_LOOK_COLORS = [
  'chassis', 'chassis_deep', 'chassis_raised', 'chassis_hover',
  'edge', 'brass', 'brass_dim', 'text', 'text_muted', 'text_disabled', 'heading',
  'paper', 'paper_edge', 'ink', 'ink_muted', 'khaki', 'olive', 'olive_deep',
  'signal', 'signal_text', 'note', 'note_ink', 'overlay'
] as const
export type ColorToken = (typeof KNOWN_LOOK_COLORS)[number]

export const KNOWN_LOOK_FONTS = ['display', 'display_bold', 'body', 'body_bold', 'typed', 'typed_bold'] as const
export const KNOWN_LOOK_SIZES = ['body', 'small', 'label', 'title', 'heading', 'display'] as const
export const KNOWN_LOOK_METRICS = ['radius', 'border', 'focus', 'pad'] as const
/** `map_detail` is a sharper scan of map_image for the sector windows' theatre plates (.png or .jpg). */
export const KNOWN_LOOK_TEXTURES = ['paper', 'paper_frame', 'desk', 'grain', 'rule', 'map_detail'] as const
export const KNOWN_DOSSIER_KEYS = ['subtitle', 'map_rect', 'map_caption'] as const
/** `objectives_legend`: the objectives laid over map_image's own legend - its box in the picture's pixels and the legend's printed colours. */
export const KNOWN_OBJECTIVES_LEGEND_KEYS = ['rect', 'paper', 'ink', 'accent'] as const
/** A `map_insets` entry: a larger-scale map of part of the world and where it lies, in map units. */
export const KNOWN_MAP_INSET_KEYS = ['image', 'at'] as const
/** `messages` (the Message Index as dispatches): its keys, and the categories a stamp or
 * the urgent band can name - the game's Enums.MessageCategory less "All". */
export const KNOWN_MESSAGES_KEYS = ['header', 'stamps', 'urgent'] as const
export const KNOWN_MESSAGE_CATEGORIES = ['Loyalty', 'Fleets', 'Missions', 'Resources', 'Manufacturing', 'Defense', 'Conflict', 'Chat', 'Advice'] as const

/** The sizes and metrics the game uses when a look names none (look.gd). */
export const DEFAULT_SIZES: Record<(typeof KNOWN_LOOK_SIZES)[number], number> = {
  body: 16, small: 13, label: 14, title: 15, heading: 18, display: 34
}
export const DEFAULT_METRICS: Record<(typeof KNOWN_LOOK_METRICS)[number], number> = {
  radius: 0, border: 1, focus: 2, pad: 8
}
export const DEFAULT_OVERLAY_ALPHA = 0.55

/**
 * The pairs a reader must be able to tell apart, with the WCAG contrast each
 * needs (look.gd CONTRAST_PAIRS). The game's tests/look_system.gd fails a look
 * below these; the game still loads it, so the Look page only shows them.
 */
export const CONTRAST_PAIRS: readonly [ColorToken, ColorToken, number][] = [
  ['text', 'chassis', 4.5], ['text', 'chassis_deep', 4.5], ['text', 'chassis_raised', 4.5],
  ['text', 'chassis_hover', 4.5], ['text', 'olive_deep', 4.5],
  ['text_muted', 'chassis', 4.5], ['text_muted', 'chassis_deep', 4.5], ['text_muted', 'chassis_raised', 4.5],
  ['heading', 'chassis', 4.5], ['heading', 'chassis_deep', 4.5],
  ['ink', 'paper', 4.5], ['ink_muted', 'paper', 4.5], ['ink', 'paper_edge', 4.5],
  ['note_ink', 'note', 4.5], ['signal_text', 'signal', 4.5], ['text', 'signal', 4.5],
  ['text_disabled', 'chassis', 3.0], ['text_disabled', 'chassis_raised', 3.0],
  ['brass', 'chassis', 3.0], ['brass', 'chassis_deep', 3.0], ['brass', 'chassis_raised', 3.0],
  ['brass', 'chassis_hover', 3.0],
  ['brass_dim', 'chassis', 3.0], ['ink', 'khaki', 4.5],
  // The dispatches (phase 4): a ledger row under the pointer, a stamp's
  // word, an urgent stamp in red ink on the parchment.
  ['text_muted', 'chassis_hover', 4.5], ['heading', 'chassis_hover', 4.5], ['signal', 'paper', 4.5]
]
