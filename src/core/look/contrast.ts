// Contrast as the game measures it (look.gd Contrast / _luminance: WCAG 2),
// for the pairs it names (CONTRAST_PAIRS) plus each side's chrome colour on
// the chassis (tests/look_system.gd). Shown for information only: the game
// loads a look whatever its contrast.

import type { LookFile } from './lookfile'
import { CONTRAST_PAIRS, type ColorToken } from './vocab'

/** A #rrggbb colour as 0-1 channels, or null when it is not one. */
export function parseHex(hex: string | undefined): [number, number, number] | null {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16) / 255
  return [n(1), n(3), n(5)]
}

function luminance([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/** The WCAG contrast ratio of two #rrggbb colours, 1 to 21; null if either is not one. */
export function contrast(a: string | undefined, b: string | undefined): number | null {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return null
  const la = luminance(pa)
  const lb = luminance(pb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export interface PairResult {
  /** The foreground: a colour token, or a side as "side:<faction id>". */
  fg: string
  bg: ColorToken
  fgLabel: string
  fgHex: string | undefined
  bgHex: string | undefined
  need: number
  ratio: number | null
  /** Meets the game's test; null when a colour is missing or not #rrggbb. */
  ok: boolean | null
}

export interface SideInfo {
  id: string
  name: string
  /** factions.json's colour: the side's colour in the chrome when the look sets none. */
  mapColor: string
}

function result(fg: string, fgLabel: string, fgHex: string | undefined, bg: ColorToken, bgHex: string | undefined, need: number): PairResult {
  const ratio = contrast(fgHex, bgHex)
  return { fg, bg, fgLabel, fgHex, bgHex, need, ratio, ok: ratio === null ? null : ratio >= need }
}

/** Every pair the game's test checks, measured on the look as it stands. */
export function contrastPairs(look: LookFile, sides: readonly SideInfo[]): PairResult[] {
  const out = CONTRAST_PAIRS.map(([fg, bg, need]) => result(fg, fg, look.color(fg), bg, look.color(bg), need))
  for (const s of sides) {
    const hex = look.side(s.id) ?? s.mapColor
    out.push(result(`side:${s.id}`, s.name || s.id, hex, 'chassis', look.color('chassis'), 4.5))
  }
  return out
}

/** The ratio as the Look page prints it: two decimals, "7.12:1". */
export function formatRatio(r: number | null): string {
  return r === null ? '–' : `${r.toFixed(2)}:1`
}
