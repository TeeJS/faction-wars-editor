import { describe, expect, it } from 'vitest'
import { lintPack } from '../src/core/lint'
import { SHIPPED_PACKS, haveGameRepo, loadShipped } from './helpers'

const suite = haveGameRepo ? describe : describe.skip

suite('editor warnings on the shipped packs', () => {
  for (const id of SHIPPED_PACKS)
    it(`${id}: only the expected warnings`, () => {
      const warnings = lintPack(loadShipped(id)).map((w) => w.message)
      if (process.env.SHOW_LINT) console.log(id, warnings)
      // A shipped id is expected to warn (an export must use a new id); WW2's
      // top-level credits really is unread (handoff item). Nothing else.
      const expected = warnings.filter((w) => w.includes('ships with the game') || w.includes("top-level 'credits' is never read"))
      expect(warnings).toEqual(expected)
      expect(warnings.some((w) => w.includes('ships with the game'))).toBe(true)
    })
})
