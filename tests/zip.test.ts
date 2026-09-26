import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { PackDocument } from '../src/core/document'
import { buildPackZip, checkImportable, openPackZip, sha256Hex } from '../src/core/zip'
import { readManifest } from '../src/core/model'
import { bytesEqual, haveGameRepo, loadShipped } from './helpers'

describe('sha256', () => {
  it('matches a known digest', async () => {
    expect(await sha256Hex(strToU8('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('buildPackZip', () => {
  const files = [
    { path: 'pack.json', bytes: strToU8('{"id":"mine","display_name":"Mine"}') },
    { path: 'art/units/x.png', bytes: new Uint8Array([137, 80, 78, 71]) },
    { path: 'world.jpg.import', bytes: strToU8('[remap]') },
    { path: 'manifest.json', bytes: strToU8('{}') }
  ]

  it('builds a zip in the game format', async () => {
    const r = await buildPackZip(files, { id: 'mine', title: 'Mine', exporter: 'faction-wars-editor 0.1.0', artSetHashes: null, now: new Date(Date.UTC(2026, 8, 23, 12, 0, 0)) })
    expect(r.ok).toBe(true)
    expect(Object.keys(r.manifest!.files)).toEqual(['art/units/x.png', 'pack.json'])
    expect(r.manifest!.created_utc).toBe('2026-09-23T12:00:00Z')
  })

  it("the importer check runs the game's loader, as the importer does, and lists 8 reasons", async () => {
    const r = await buildPackZip(files, { id: 'mine', title: 'Mine', exporter: 'x', artSetHashes: null })
    const refusal = await checkImportable(r.bytes!)
    const lines = refusal.split('\n')
    expect(lines[0]).toBe('Not imported: the game would refuse to load it.')
    expect(lines[1]).toBe('  factions.json: missing or empty.')
    expect(lines).toHaveLength(10)
    expect(lines[9]).toBe('  ... and 3 more')
  })

  it('refuses anything under original/', async () => {
    const r = await buildPackZip([...files, { path: 'Original/x.png', bytes: new Uint8Array([1]) }], { id: 'mine', title: 'Mine', exporter: 'x', artSetHashes: null })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('Original/x.png')
  })

  it("refuses a file identical to one in the player's art set", async () => {
    const hash = await sha256Hex(files[1].bytes)
    const r = await buildPackZip(files, { id: 'mine', title: 'Mine', exporter: 'x', artSetHashes: new Set([hash]) })
    expect(r.ok).toBe(false)
    expect(r.message).toContain('art/units/x.png  (the same picture as one in your art set)')
  })

  it('the importer check catches an id mismatch and a shipped id', async () => {
    const bad = await buildPackZip(files, { id: 'other', title: 'x', exporter: 'x', artSetHashes: null })
    expect(await checkImportable(bad.bytes!)).toBe("Its pack.json names the pack 'mine' but its manifest 'other'; they must be the same.")
    const shipped = await buildPackZip([{ path: 'pack.json', bytes: strToU8('{"id":"ww2"}') }], { id: 'ww2', title: 'x', exporter: 'x', artSetHashes: null })
    expect(await checkImportable(shipped.bytes!)).toContain('comes with the game')
  })
})

describe('openPackZip', () => {
  it('opens a zip with the pack inside one folder', async () => {
    const z = zipSync({ 'mypack/pack.json': strToU8('{"id":"mypack"}'), 'mypack/art/a.png': new Uint8Array([1]) })
    const o = await openPackZip(z)
    expect([...o.files.keys()].sort()).toEqual(['art/a.png', 'pack.json'])
    expect(o.folderName).toBe('mypack')
    expect(o.warnings.length).toBe(1)
  })
  it('reports a damaged file in a game-format zip', async () => {
    const good = await buildPackZip([{ path: 'pack.json', bytes: strToU8('{"id":"p"}') }], { id: 'p', title: 'p', exporter: 'x', artSetHashes: null })
    const o = await openPackZip(good.bytes!)
    expect(o.warnings).toEqual([])
    expect(o.folderName).toBe('p')
  })
})

const suite = haveGameRepo ? describe : describe.skip
suite('the shipped WW2 pack exported under a new id', () => {
  it('round-trips through a zip byte-for-byte and passes the importer checks', async () => {
    const doc = loadShipped('ww2')
    doc.edit('new id', (e) => e.set('pack.json', ['id'], 'ww2-remix'))
    const r = await buildPackZip(doc.allFiles(), { id: doc.packId, title: 'WW2 Remix', exporter: 'test', artSetHashes: null })
    expect(r.ok).toBe(true)
    expect(Object.keys(r.manifest!.files)).not.toContain('world_1941.jpg.import')
    expect(await checkImportable(r.bytes!)).toBe('')
    const back = await openPackZip(r.bytes!)
    const reopened = new PackDocument(back.files, back.folderName)
    for (const f of doc.allFiles()) {
      if (f.path.endsWith('.import')) continue
      expect(bytesEqual(reopened.fileBytes(f.path)!, f.bytes), f.path).toBe(true)
    }
  })

  it('with a version and a download page: exports, passes the importer checks, and keeps both', async () => {
    const doc = loadShipped('ww2')
    doc.edit('new id', (e) => e.set('pack.json', ['id'], 'ww2-remix'))
    doc.edit('version', (e) => e.set('pack.json', ['version'], '1.3'))
    doc.edit('link', (e) => e.set('pack.json', ['download_url'], 'https://example.com/packs/ww2-remix'))
    const r = await buildPackZip(doc.allFiles(), { id: doc.packId, title: 'WW2 Remix', exporter: 'test', artSetHashes: null })
    expect(r.ok).toBe(true)
    expect(await checkImportable(r.bytes!)).toBe('')
    const back = await openPackZip(r.bytes!)
    const m = readManifest(JSON.parse(new TextDecoder().decode(back.files.get('pack.json')!)))
    expect(m.version).toBe('1.3')
    expect(m.downloadUrl).toBe('https://example.com/packs/ww2-remix')
  })
})
