// Byte-preserving round trips: an untouched look.json is written back byte for
// byte, and changing one colour changes only that value.

import { describe, expect, it } from 'vitest'
import { LookFile } from '../../src/core/look/lookfile'
import { haveLook, ww2LookBytes, ww2LookText } from './game'

const enc = new TextEncoder()
const dec = new TextDecoder()
const crlf = (s: string) => s.replace(/\r?\n/g, '\r\n')
const withLook = haveLook ? describe : describe.skip

withLook('round trip', () => {
  it('the WWII look, unchanged, gives back the identical bytes', () => {
    const bytes = ww2LookBytes()
    expect(dec.decode(bytes)).not.toContain('\r')
    const f = LookFile.fromBytes(bytes)
    expect(f.dirty).toBe(false)
    expect(f.toBytes()).toEqual(bytes)
  })

  it('a CRLF copy (a Windows checkout) comes back identical too', () => {
    const bytes = enc.encode(crlf(ww2LookText()))
    expect(LookFile.fromBytes(bytes).toBytes()).toEqual(bytes)
  })

  it('a byte-order mark is kept', () => {
    const body = ww2LookBytes()
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...body])
    const f = LookFile.fromBytes(bytes)
    f.setColor('brass', '#123456')
    const out = f.toBytes()
    expect([...out.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })
})

withLook('one change, one value', () => {
  for (const [name, text] of [
    ['LF', ww2LookText()],
    ['CRLF', crlf(ww2LookText())]
  ] as const)
    it(`changing brass changes only brass's value (${name})`, () => {
      const f = LookFile.fromBytes(enc.encode(text))
      f.setColor('brass', '#123456')
      expect(f.dirty).toBe(true)
      const expected = text.replace('"brass": "#a88a4e"', '"brass": "#123456"')
      expect(expected).not.toBe(text)
      expect(dec.decode(f.toBytes())).toBe(expected)
    })

  it('setting the value already there changes nothing', () => {
    const f = LookFile.fromBytes(ww2LookBytes())
    f.setColor('brass', '#a88a4e')
    expect(f.dirty).toBe(false)
  })

  it('a side colour changes in place; comments stay', () => {
    const text = ww2LookText()
    const f = LookFile.fromBytes(enc.encode(text))
    f.setSide('allies', '#000000')
    expect(dec.decode(f.toBytes())).toBe(text.replace('"allies": "#6f8fb5"', '"allies": "#000000"'))
    expect(f.text).toContain('"_comment"')
  })

  it('keys are exact, as the game matches them: "Brass" is not brass', () => {
    const f = LookFile.fromValue({ colors: { Brass: '#111111' } })
    f.setColor('brass', '#222222')
    expect(f.value).toEqual({ colors: { Brass: '#111111', brass: '#222222' } })
  })

  it('a new file is written in the shipped style: 2-space indent, LF, final newline', () => {
    const f = LookFile.fromValue({ colors: { chassis: '#000000' } })
    expect(f.text).toBe('{\n  "colors": {\n    "chassis": "#000000"\n  }\n}\n')
  })
})
