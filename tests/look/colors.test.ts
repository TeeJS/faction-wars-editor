// Contrast measured as the game measures it, hex fields read as the game
// needs them, and side colours set and cleared in place.

import { describe, expect, it } from 'vitest'
import { contrast, contrastPairs, formatRatio, parseHex } from '../../src/core/look/contrast'
import { normalizeHex } from '../../src/core/look/hex'
import { LookFile } from '../../src/core/look/lookfile'
import { CONTRAST_PAIRS } from '../../src/core/look/vocab'
import { haveLook, ww2LookBytes, ww2LookText } from './game'

const withLook = haveLook ? describe : describe.skip
const ww2Sides = [
  { id: 'axis', name: 'Axis Powers', mapColor: '#d22a2a' },
  { id: 'allies', name: 'Allied Powers', mapColor: '#2a62d2' }
]

describe('contrast', () => {
  it('black on white is 21, a colour on itself is 1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 10)
    expect(contrast('#a88a4e', '#a88a4e')).toBe(1)
  })

  it('WCAG reference values', () => {
    // #767676 on white is the classic 4.54:1.
    expect(contrast('#767676', '#ffffff')!).toBeCloseTo(4.54, 2)
    expect(formatRatio(contrast('#767676', '#ffffff'))).toBe('4.54:1')
  })

  it('not a colour: no ratio, no verdict', () => {
    expect(contrast('black', '#ffffff')).toBeNull()
    expect(parseHex('#abc')).toBeNull()
  })
})

withLook('contrast on the WWII look', () => {
  it("the WWII look meets every pair the game's test checks (tests/look_system.gd passes on it)", () => {
    const pairs = contrastPairs(LookFile.fromBytes(ww2LookBytes()), ww2Sides)
    expect(pairs).toHaveLength(CONTRAST_PAIRS.length + 2)
    expect(pairs.filter((p) => p.ok !== true)).toEqual([])
  })

  it("a side with no chrome colour is measured in its map colour, as Look.SideColor falls back", () => {
    const f = LookFile.fromBytes(ww2LookBytes())
    f.setSide('axis', undefined)
    const axis = contrastPairs(f, ww2Sides).find((p) => p.fg === 'side:axis')!
    expect(axis.fgHex).toBe('#d22a2a')
    expect(axis.bg).toBe('chassis')
    expect(axis.need).toBe(4.5)
  })

  it('a change shows at once', () => {
    const f = LookFile.fromBytes(ww2LookBytes())
    f.setColor('text', '#1b1b19')
    const below = contrastPairs(f, ww2Sides).filter((p) => p.ok === false)
    expect(below.map((p) => `${p.fg}/${p.bg}`)).toContain('text/chassis')
  })
})

describe('hex fields', () => {
  it('reads what people type', () => {
    expect(normalizeHex('#A88A4E')).toBe('#a88a4e')
    expect(normalizeHex('a88a4e')).toBe('#a88a4e')
    expect(normalizeHex(' #abc ')).toBe('#aabbcc')
    expect(normalizeHex('abc')).toBe('#aabbcc')
  })
  it('refuses what is not a colour', () => {
    for (const s of ['', '#', '#12345', '#1234567', 'black', '#ggg000', '#a88a4e80']) expect(normalizeHex(s)).toBeNull()
  })
})

withLook('side colours in the file', () => {
  const dec = new TextDecoder()
  it('clearing a side removes just its key', () => {
    const f = LookFile.fromBytes(ww2LookBytes())
    f.setSide('axis', undefined)
    expect(f.side('axis')).toBeUndefined()
    expect(f.side('allies')).toBe('#6f8fb5')
    expect(dec.decode(f.toBytes())).not.toContain('"axis"')
    expect(JSON.parse(dec.decode(f.toBytes())).sides).toEqual({ _comment: expect.any(String), allies: '#6f8fb5' })
  })

  it('giving a side its colour back, then the same one as before, leaves the file as it was', () => {
    const text = ww2LookText()
    const f = LookFile.fromBytes(new TextEncoder().encode(text))
    f.setColor('brass', '#000000')
    f.setColor('brass', '#a88a4e')
    expect(f.dirty).toBe(false)
  })

  it('knows what the file on disk has, to show what changed', () => {
    const f = LookFile.fromBytes(ww2LookBytes())
    f.setColor('brass', '#123456')
    expect(f.color('brass')).toBe('#123456')
    expect(f.savedColor('brass')).toBe('#a88a4e')
    expect(f.savedSide('allies')).toBe('#6f8fb5')
    expect(LookFile.fromValue({ colors: {} }).saved).toBeNull()
  })
})
