// A pack author's "_" keys are comments, never data, in every keyed map - as in the
// game (JsonUtil.data_keys; its tests/pack_comments.gd). A copy of the Star Wars pack
// with a "_comment" in EVERY JSON object validates clean and hydrates the same.

import { describe, expect, it } from 'vitest'
import { lintPack } from '../src/core/lint'
import { hydrate, type LoadedPack } from '../src/core/model'
import { validatePack } from '../src/core/validate'
import { commentedCopy, haveGameRepo, loadShipped } from './helpers'

/** The engine keeps rule rows, side-lottery rows and logistics tables as read, and
 * reads their fields by name, so a note inside them stays (the game's test strips
 * these too). Everything hydrated into a keyed map must not keep it. */
function comparable(p: LoadedPack): unknown {
  return { ...p, rules: p.rules.length, setup: { sideLottery: p.setup.sideLottery.length, logistics: Object.keys(p.setup.logistics) } }
}

const suite = haveGameRepo ? describe : describe.skip
suite('comments in every JSON object', () => {
  it('the Star Wars pack, commented everywhere, validates clean and hydrates the same', () => {
    const plain = loadShipped('star-wars-rebellion')
    const { doc: commented, added } = commentedCopy(plain, 'star-wars-rebellion')
    expect(added).toBeGreaterThan(1000)
    expect(validatePack(commented).map((e) => e.message)).toEqual([])
    expect(comparable(hydrate(commented).pack)).toEqual(comparable(hydrate(plain).pack))
    expect(lintPack(commented).map((e) => e.message)).toEqual(lintPack(plain).map((e) => e.message))
  })
})
