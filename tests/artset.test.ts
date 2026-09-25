import { describe, expect, it } from 'vitest'
import { lintPack } from '../src/core/lint'
import { createStarterPack } from '../src/core/starter'
import { buildPackZip, checkImportable, artSetFromManifest, sha256Hex } from '../src/core/zip'
import { strToU8 } from 'fflate'

describe('art sets', () => {
  it('an art-set manifest is recognised; a faction pack manifest is not', () => {
    expect(artSetFromManifest(JSON.stringify({ kind: 'art_set', id: 'swr-original', files: { 'a.png': 'ABC' } }))).toEqual({ id: 'swr-original', files: { 'a.png': 'abc' } })
    expect(artSetFromManifest(JSON.stringify({ kind: 'faction_pack', id: 'x', files: {} }))).toBeNull()
  })
})

describe("the author's pictures are the author's call", () => {
  const starter = () => createStarterPack({ id: 'pics', displayName: 'Pics', sides: [{ id: 'a', displayName: 'A' }, { id: 'b', displayName: 'B' }] })

  it('no warning for an original folder or any picture', () => {
    const doc = starter()
    doc.edit('add', (e) => {
      e.setFile('original/screens/galaxy.png', strToU8('x'))
      e.setFile('art/portraits/characters/hero.png', strToU8('y'))
    })
    expect(lintPack(doc).filter((i) => /original|art set/i.test(i.message))).toEqual([])
  })

  it("the editor's export carries them, even when they match the art set", async () => {
    const doc = starter()
    const picture = strToU8('the original portrait')
    doc.edit('add', (e) => e.setFile('art/portraits/characters/hero.png', picture))
    const hashes = new Set([await sha256Hex(picture)])
    const r = await buildPackZip(doc.allFiles(), { id: 'pics', title: 'Pics', exporter: 'test', artSetHashes: hashes, ignoreOriginals: true })
    expect(r.ok, r.message).toBe(true)
    expect(Object.keys(r.manifest!.files)).toContain('art/portraits/characters/hero.png')
    expect(await checkImportable(r.bytes!, hashes, { ignoreOriginals: true })).toBe('')
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
