// Starting points for a pack that has no look yet. Each gives all 23 colours
// (rule 31) and meets every pair the game's own contrast test checks
// (tests/presets.test.ts). Faces and textures are files, so a preset names
// none: the pack uses the engine's face until it is given its own.

import type { Faction } from './pack'
import { isDict } from './godot'
import { KNOWN_LOOK_COLORS, KNOWN_LOOK_FONTS, KNOWN_LOOK_METRICS, KNOWN_LOOK_SIZES, KNOWN_LOOK_TEXTURES, type ColorToken } from './vocab'

export interface Preset {
  id: string
  name: string
  about: string
  colors: Record<ColorToken, string>
  sizes?: Record<string, number>
  metrics?: Record<string, number>
  overlay_alpha?: number
}

export const PRESETS: Preset[] = [
  {
    id: 'map-room',
    name: 'Map room',
    about: "The WWII pack's colours, sizes and corners: charcoal chassis, brass trim, parchment documents.",
    colors: {
      chassis: '#1b1b19',
      chassis_deep: '#111110',
      chassis_raised: '#2a2923',
      chassis_hover: '#34322a',
      edge: '#3d3a30',
      brass: '#a88a4e',
      brass_dim: '#7d6a3f',
      text: '#e6dcc3',
      text_muted: '#a59d88',
      text_disabled: '#7a7463',
      heading: '#b5a67a',
      paper: '#e9dfc6',
      paper_edge: '#d8c9a3',
      ink: '#2a2620',
      ink_muted: '#5a5244',
      khaki: '#b5a67a',
      olive: '#6b6f45',
      olive_deep: '#4a4d31',
      signal: '#a8322a',
      signal_text: '#f1e6cf',
      note: '#efe6cf',
      note_ink: '#2a2620',
      overlay: '#0b0b0a'
    },
    sizes: { body: 16, small: 13, label: 14, title: 15, heading: 18, display: 34 },
    metrics: { radius: 2, border: 1, focus: 2, pad: 8 },
    overlay_alpha: 0.55
  },
  {
    id: 'plain-grey',
    name: 'Plain grey',
    about:
      "From the Plain Build Parity palette: the stand-ins' plate grey, wells and bevels, white text, the original's readout red for alerts. Lightened where the game's contrast test needs it.",
    colors: {
      chassis: '#3b3b3b',
      chassis_deep: '#141414',
      chassis_raised: '#101010',
      chassis_hover: '#222222',
      edge: '#2d2d2d',
      brass: '#dfdfdf',
      brass_dim: '#8a8a8a',
      text: '#ffffff',
      text_muted: '#b8b8b8',
      text_disabled: '#8f8f8f',
      heading: '#dfdfdf',
      paper: '#d9d9d9',
      paper_edge: '#bdbdbd',
      ink: '#141414',
      ink_muted: '#454545',
      khaki: '#a8a8a8',
      olive: '#6a6a6a',
      olive_deep: '#505050',
      signal: '#c3252b',
      signal_text: '#ffffff',
      note: '#efefef',
      note_ink: '#141414',
      overlay: '#000000'
    },
    metrics: { radius: 3, border: 1, focus: 2, pad: 8 },
    overlay_alpha: 0.55
  }
]

/** A new look from a preset: its colours, sizes, corners and dim. */
export function lookFromPreset(p: Preset): Record<string, unknown> {
  const look: Record<string, unknown> = { colors: { ...p.colors } }
  if (p.sizes) look.sizes = { ...p.sizes }
  if (p.metrics) look.metrics = { ...p.metrics }
  if (p.overlay_alpha !== undefined) look.overlay_alpha = p.overlay_alpha
  return look
}

export interface Borrowed {
  look: Record<string, unknown>
  /** Colours the other look lacked, taken from the Map room preset. */
  filled: string[]
  /** Sides, faces and textures left behind: other ids, or files this pack lacks. */
  dropped: string[]
}

/**
 * A new look from another pack's look.json: its colours, sizes, corners and
 * dim; its side colours for the factions this pack also has; its faces and
 * textures only where this pack ships the same files.
 */
export function lookFromOther(other: unknown, factions: Faction[], hasFile: (rel: string) => boolean): Borrowed {
  const src = isDict(other) ? other : {}
  const filled: string[] = []
  const dropped: string[] = []
  const colors: Record<string, string> = {}
  const theirs = isDict(src.colors) ? src.colors : {}
  for (const t of KNOWN_LOOK_COLORS) {
    const v = theirs[t]
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) colors[t] = v
    else {
      colors[t] = PRESETS[0].colors[t]
      filled.push(t)
    }
  }
  const look: Record<string, unknown> = { colors }
  const keep = (name: string, known: readonly string[], ok: (v: unknown) => boolean) => {
    const d = src[name]
    if (!isDict(d)) return
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(d)) if (known.includes(k) && ok(v)) out[k] = v
    if (Object.keys(out).length) look[name] = out
  }
  keep('sizes', KNOWN_LOOK_SIZES, (v) => typeof v === 'number' && v > 0 && Number.isInteger(v))
  keep('metrics', KNOWN_LOOK_METRICS, (v) => typeof v === 'number' && v >= 0)
  if (typeof src.overlay_alpha === 'number' && src.overlay_alpha >= 0 && src.overlay_alpha <= 1) look.overlay_alpha = src.overlay_alpha

  const ids = factions.map((f) => f.id)
  if (isDict(src.sides)) {
    const sides: Record<string, string> = {}
    for (const [k, v] of Object.entries(src.sides)) {
      if (k.startsWith('_')) continue
      if (ids.includes(k) && typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) sides[k] = v
      else dropped.push(`side ${k}`)
    }
    if (Object.keys(sides).length) look.sides = sides
  }
  if (isDict(src.fonts)) {
    const fonts: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src.fonts)) {
      if (k.startsWith('_')) continue
      const file = isDict(v) ? String(v.file ?? '') : ''
      if ((KNOWN_LOOK_FONTS as readonly string[]).includes(k) && file && hasFile(file)) fonts[k] = v
      else dropped.push(`face ${k}${file ? ` (${file})` : ''}`)
    }
    if (Object.keys(fonts).length) look.fonts = fonts
  }
  if (isDict(src.textures)) {
    const tex: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src.textures)) {
      if (k.startsWith('_')) continue
      const file = isDict(v) ? String(v.file ?? '') : String(v)
      if ((KNOWN_LOOK_TEXTURES as readonly string[]).includes(k) && file && hasFile(file)) tex[k] = v
      else dropped.push(`texture ${k}${file ? ` (${file})` : ''}`)
    }
    if (Object.keys(tex).length) look.textures = tex
  }
  return { look, filled, dropped }
}
