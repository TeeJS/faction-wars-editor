// The mock-ups paint each part in the token the GAME paints it in: every style
// they use is a line of the game's own source, and each line must be in that
// source: src/ui/<file> of the game (tests/look/game.ts), and look_window.gd
// from the paused ww2-look-messages branch at 2bd1b98. When the game changes
// one of these lines, the test names it: update src/core/look/theme.ts.

import { describe, expect, it } from 'vitest'
import { BOXES, COLORS, FONTS, readBox, readColor, readFont, type Source } from '../../src/core/look/theme'
import { KNOWN_LOOK_COLORS, KNOWN_LOOK_FONTS, KNOWN_LOOK_SIZES } from '../../src/core/look/vocab'
import { LOOK_WINDOW_REF, gameText } from './game'

const texts = new Map<string, string | null>()
const game = (file: string): string | null => {
  if (!texts.has(file)) texts.set(file, file === 'look_window.gd' ? gameText(`src/ui/${file}`, LOOK_WINDOW_REF) : gameText(`src/ui/${file}`))
  return texts.get(file)!
}

function everyLineIsTheGames(table: Record<string, Source>) {
  for (const [id, src] of Object.entries(table))
    for (const line of src.lines)
      it(`${id}: ${src.file} has \`${line}\``, (t) => {
        const text = game(src.file)
        if (text === null) return t.skip()
        expect(text).toContain(line)
      })
}

describe('every style line is in the game', () => everyLineIsTheGames(BOXES))
describe('every colour line is in the game', () => everyLineIsTheGames(COLORS))
describe('every face and size line is in the game', () => everyLineIsTheGames(FONTS))

describe('reading the lines', () => {
  it('every style reads to known tokens', () => {
    for (const src of Object.values(BOXES)) {
      const b = readBox(src)
      for (const t of [b.fill, b.edge]) if (t) expect(KNOWN_LOOK_COLORS).toContain(t)
    }
  })

  it('every colour line names a known token', () => {
    for (const src of Object.values(COLORS)) expect(KNOWN_LOOK_COLORS).toContain(readColor(src))
  })

  it('every face and size is a known role and size', () => {
    for (const src of Object.values(FONTS)) {
      const f = readFont(src)
      expect(f.role === null || (KNOWN_LOOK_FONTS as readonly string[]).includes(f.role)).toBe(true)
      expect(f.size === null || (KNOWN_LOOK_SIZES as readonly string[]).includes(f.size.name)).toBe(true)
    }
  })

  // Pinned by hand against look.gd, so a reading mistake cannot hide.
  it('a key: chassis_raised with an edge border, 6 px in', () => {
    expect(readBox(BOXES.key)).toEqual({
      fill: 'chassis_raised',
      edge: 'edge',
      width: ['border', 'border', 'border', 'border'],
      radius: 'radius',
      pad: 6,
      expand: [0, 0, 0, 0]
    })
  })

  it('a console key: its whole border is chassis_deep, 2 px at the foot', () => {
    const b = readBox(BOXES.COMMAND)
    expect(b.fill).toBe('chassis_raised')
    expect(b.edge).toBe('chassis_deep')
    expect(b.width).toEqual(['border', 'border', 'border', 2])
  })

  it('a selected rail item: olive_deep, brass 4 px on the left and 1 px round the rest', () => {
    const b = readBox(BOXES.RAIL_pressed)
    expect([b.fill, b.edge, b.width]).toEqual(['olive_deep', 'brass', [4, 1, 1, 1]])
  })

  it('a list row: no fill, an edge hairline under it, square corners', () => {
    const b = readBox(BOXES.ROW)
    expect([b.fill, b.edge, b.width, b.radius]).toEqual([null, 'edge', [0, 0, 0, 1], 0])
  })

  it('the focus ring: brass at the focus width, standing 3 px clear', () => {
    const b = readBox(BOXES.focus_ring)
    expect([b.fill, b.edge, b.width[0], b.expand]).toEqual([null, 'brass', 'focus', [3, 3, 3, 3]])
  })

  it("a dialog's frame reaches 28 px above it for the title", () => {
    expect(readBox(BOXES.dialog_frame).expand).toEqual([1, 28, 1, 1])
  })

  it('the flat document: paper with a paper_edge border, 14 px in', () => {
    const b = readBox(BOXES.DOCUMENT)
    expect([b.fill, b.edge, b.width[0], b.pad]).toEqual(['paper', 'paper_edge', 1, 14])
  })

  it('the paused window dress: a chassis frame with a 1 px brass_dim border, square', () => {
    const b = readBox(BOXES.window_frame)
    expect([b.fill, b.edge, b.width, b.radius, b.pad]).toEqual(['chassis', 'brass_dim', [1, 1, 1, 1], 0, 0])
  })

  it('credits colours come from the helpers that take a token name', () => {
    expect(readColor(COLORS.credits_title)).toBe('ink')
    expect(readColor(COLORS.credits_changes)).toBe('ink_muted')
  })

  it('sizes can add pixels', () => {
    expect(readFont(FONTS.cockpit_title)).toEqual({ role: 'display', size: { name: 'heading', plus: 4 } })
    expect(readFont(FONTS.credits_title)).toEqual({ role: 'display_bold', size: { name: 'heading', plus: 10 } })
  })
})
