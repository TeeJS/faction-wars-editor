import { strToU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { findOriginals, indexArtSets, originalOf } from '../src/core/artset'
import { lintPack } from '../src/core/lint'
import { createStarterPack } from '../src/core/starter'
import { artSetFromManifest, sha256Hex } from '../src/core/zip'

const luke = strToU8('the original portrait')
const mine = strToU8('a portrait of my own')

async function artWith(files: Record<string, Uint8Array>) {
  const hashes: Record<string, string> = {}
  for (const [p, b] of Object.entries(files)) hashes[p] = await sha256Hex(b)
  const set = artSetFromManifest(JSON.stringify({ format: 1, kind: 'art_set', id: 'swr-original', files: hashes }))!
  return indexArtSets([{ ...set, path: '/art/swr-original.art.zip' }])
}

describe("the original's pictures, by fingerprint", () => {
  it("names the art set's copy of a picture, and nothing else", async () => {
    const art = await artWith({ 'portraits/characters/luke_skywalker.png': luke })
    expect(await originalOf(new Uint8Array(luke), art)).toBe('swr-original:portraits/characters/luke_skywalker.png')
    expect(await originalOf(mine, art)).toBeNull()
    expect(await originalOf(luke, null)).toBeNull()
  })

  it('finds every pack file that is one of them', async () => {
    const art = await artWith({ 'portraits/characters/luke_skywalker.png': luke })
    const found = await findOriginals(
      [
        { path: 'art/portraits/characters/hero.png', bytes: new Uint8Array(luke) },
        { path: 'art/portraits/characters/villain.png', bytes: mine }
      ],
      art
    )
    expect(found).toEqual([{ path: 'art/portraits/characters/hero.png', original: 'swr-original:portraits/characters/luke_skywalker.png' }])
  })

  it('an art-set manifest is recognised; a faction pack manifest is not', () => {
    expect(artSetFromManifest(JSON.stringify({ kind: 'art_set', id: 'swr-original', files: { 'a.png': 'ABC' } }))).toEqual({ id: 'swr-original', files: { 'a.png': 'abc' } })
    expect(artSetFromManifest(JSON.stringify({ kind: 'faction_pack', id: 'x', files: {} }))).toBeNull()
  })
})

describe('card_image', () => {
  it('a missing card picture is a warning, never an error', () => {
    const doc = createStarterPack({ id: 'card-test', displayName: 'Card', sides: [{ id: 'a', displayName: 'A' }, { id: 'b', displayName: 'B' }] })
    doc.edit('card', (e) => e.set('pack.json', ['card_image'], 'no-such.jpg'))
    expect(lintPack(doc).map((i) => i.message)).toContain(
      "pack.json: card_image 'no-such.jpg' is not in the pack - the launch screen card will have no picture (the pack still loads)."
    )
  })
})
