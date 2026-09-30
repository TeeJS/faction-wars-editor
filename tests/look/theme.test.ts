// The mock-ups paint each part in the token the GAME paints it in: every style
// they use is a line of the game's own source, and each line must be in that
// source: src/ui/<file> of the game (tests/look/game.ts). When the game
// changes one of these lines, the test names it: update src/core/look/theme.ts.

import { describe, expect, it } from 'vitest'
import { BOXES, COLORS, FONTS, PALETTE, PLAIN, SECTOR, readBox, readColor, readFont, readNumbers, readPalette, readPlain, readTolerance, sectorNumber, type Source } from '../../src/core/look/theme'
import { KNOWN_LOOK_COLORS, KNOWN_LOOK_FONTS, KNOWN_LOOK_SIZES } from '../../src/core/look/vocab'
import { gameText } from './game'

const texts = new Map<string, string | null>()
const game = (file: string): string | null => {
  if (!texts.has(file)) texts.set(file, gameText(`src/ui/${file}`))
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
describe("every row of the window dress's palette trade is in the game", () => everyLineIsTheGames(PALETTE))
describe("every window's own frame colour is in the game", () => everyLineIsTheGames(PLAIN))
describe("every number of the sector window's theatre plate is in the game", () => everyLineIsTheGames(SECTOR))

describe("the sector window's numbers", () => {
  it('reads each out of its line, never one inside a name', () => {
    expect(readNumbers(SECTOR.DISC)).toEqual([32, 32])
    expect(readNumbers(SECTOR.NAME_BELOW)).toEqual([30])
    expect(readNumbers(SECTOR.ON_PAPER_TRIES)).toEqual([4.5, 20])
    expect([sectorNumber('WASH'), sectorNumber('SHARP_ZOOM'), sectorNumber('NAME_BOX', 1), sectorNumber('FLARE_SCALE')]).toEqual([0.58, 4, 20, 0.45])
  })
  it('the plate and its marks read to the look colours the game uses', () => {
    expect([readColor(COLORS.plate_paper), readColor(COLORS.plate_grid), readColor(COLORS.mark_unheld), readColor(COLORS.mark_hq), readColor(COLORS.mark_rim)]).toEqual(['paper', 'ink_muted', 'paper', 'brass', 'ink'])
    expect([readColor(COLORS.name_unheld), readColor(COLORS.name_halo), readColor(COLORS.corner_uprising), readColor(COLORS.corner_glyph)]).toEqual(['ink', 'paper', 'signal', 'ink'])
    expect([readColor(COLORS.bar_energy), readColor(COLORS.bar_mines), readColor(COLORS.bar_free), readColor(COLORS.bar_edge)]).toEqual(['ink', 'olive', 'paper', 'ink'])
    expect(readBox(BOXES.plate_frame)).toMatchObject({ fill: null, edge: 'brass_dim', width: [1, 1, 1, 1], radius: 0 })
    expect(readBox(BOXES.corner_tab)).toMatchObject({ fill: 'paper', edge: null, radius: 2, pad: 0 })
    expect(readFont(FONTS.sector_name)).toEqual({ role: 'body_bold', size: null })
  })
})

describe("the window dress's palette trade", () => {
  it('reads every row, to known tokens', () => {
    const rows = { BG_MAP: readPalette(PALETTE.BG_MAP), EDGE_MAP: readPalette(PALETTE.EDGE_MAP), TEXT_MAP: readPalette(PALETTE.TEXT_MAP) }
    expect([rows.BG_MAP.length, rows.EDGE_MAP.length, rows.TEXT_MAP.length]).toEqual([9, 3, 18])
    for (const r of [...rows.BG_MAP, ...rows.EDGE_MAP, ...rows.TEXT_MAP]) expect(KNOWN_LOOK_COLORS).toContain(r.token)
    expect(rows.BG_MAP[0]).toEqual({ rgb: [0.18, 0.22, 0.28], token: 'chassis_deep' })
    expect(readTolerance(PALETTE.TOLERANCE)).toBe(0.015)
  })

  it.runIf(game('look_window.gd') !== null)("has every row the game's tables have: none missed", () => {
    const text = game('look_window.gd')!
    for (const table of ['BG_MAP', 'EDGE_MAP', 'TEXT_MAP'] as const) {
      const body = new RegExp(`const ${table} := \\[([\\s\\S]*?)\\n\\]`).exec(text)![1]
      const gameRows = [...body.matchAll(/\[Color\(/g)].length
      expect(readPalette(PALETTE[table]), table).toHaveLength(gameRows)
    }
  })

  it("reads a window's own frame and title", () => {
    expect(readPlain(PLAIN.overview_panel)).toEqual({ bg: '#0f1421', edge: '#669eeb', width: 1, text: null, size: null })
    expect(readPlain(PLAIN.overview_title)).toEqual({ bg: null, edge: null, width: 0, text: '#f2f7ff', size: 20 })
  })
})

describe('lines that pick between two', () => {
  it('a colour: C("a") if x else C("b"), and C("a" if x else "b")', () => {
    expect(readColor(COLORS.row_unread)).toBe('text')
    expect(readColor(COLORS.row_read)).toBe('text_muted')
    expect(readColor(COLORS.stamp_paper_urgent)).toBe('signal')
    expect(readColor(COLORS.stamp_paper)).toBe('ink_muted')
    expect(readColor(COLORS.finder_row_muted)).toBe('text_muted')
  })
  it('a face and a size', () => {
    expect(readFont(FONTS.row_read)).toEqual({ role: 'body', size: null })
    expect(readFont(FONTS.row_unread)).toEqual({ role: 'body_bold', size: null })
    expect(readFont(FONTS.stamp_paper)).toEqual({ role: 'typed_bold', size: { name: 'label', plus: 0 } })
    expect(readFont(FONTS.stamp_ledger)).toEqual({ role: 'typed_bold', size: { name: 'small', plus: 0 } })
    expect(readFont(FONTS.dispatch_subject)).toEqual({ role: 'display', size: { name: 'heading', plus: 4 } })
  })
})

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
