// Writes editor-made packs for the GAME to check (tests/gamecheck/README.md):
// each pack goes through a zip export and back, exactly as a player's would,
// then lands as a folder the game's own validator and soak can load.
// Runs only when FWE_GAMECHECK_DIR is set.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PackDocument } from '../src/core/document'
import { findUsages, renameUsages } from '../src/core/refs'
import { clonePack, createStarterPack } from '../src/core/starter'
import { validatePack } from '../src/core/validate'
import { buildPackZip, checkImportable, openPackZip } from '../src/core/zip'
import { haveGameRepo, loadShipped } from './helpers'

const out = process.env.FWE_GAMECHECK_DIR
const suite = out ? describe : describe.skip

async function throughZip(doc: PackDocument, dir: string): Promise<void> {
  const r = await buildPackZip(doc.allFiles(), { id: doc.packId, title: doc.packId, exporter: 'gamecheck', artSetHashes: null })
  expect(r.ok, r.message).toBe(true)
  expect(await checkImportable(r.bytes!)).toBe('')
  writeFileSync(join(dir, `${doc.packId}.zip`), r.bytes!)
  const opened = await openPackZip(r.bytes!)
  const target = join(dir, doc.packId)
  rmSync(target, { recursive: true, force: true })
  for (const [rel, bytes] of opened.files) {
    mkdirSync(dirname(join(target, rel)), { recursive: true })
    writeFileSync(join(target, rel), bytes)
  }
}

suite('packs for the game to check', () => {
  it('the starter, with its sides renamed', async () => {
    mkdirSync(out!, { recursive: true })
    const doc = createStarterPack({
      id: 'editor-starter',
      displayName: 'Editor Starter',
      sides: [
        { id: 'rome', displayName: 'Rome' },
        { id: 'carthage', displayName: 'Carthage' }
      ]
    })
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
    await throughZip(doc, out!)
  })

  it.runIf(haveGameRepo)('WW2 cloned and edited: a planet moved, a unit and a faction renamed', async () => {
    const doc = clonePack(loadShipped('ww2'), 'ww2-edited', 'WW2 (edited)')
    const planets = doc.get('map.json', ['planets']) as { id: string; map: { x: number; y: number } }[]
    const i = planets.findIndex((p) => p.id === 'germany')
    doc.edit('move', (e) => {
      e.set('map.json', ['planets', i, 'map', 'x'], planets[i].map.x + 5)
      e.set('map.json', ['planets', i, 'map', 'y'], planets[i].map.y - 3)
    })
    const units = doc.get('units.json', ['units']) as { id: string }[]
    const u = units.findIndex((x) => x.id === 'commandos')
    doc.edit('rename unit', (e) => {
      renameUsages(doc, e, 'unit', 'commandos', 'raiders')
      e.set('units.json', ['units', u, 'id'], 'raiders')
      e.set('units.json', ['units', u, 'display_name'], 'Raiders')
    })
    doc.edit('rename faction', (e) => {
      renameUsages(doc, e, 'faction', 'axis', 'central')
      e.set('factions.json', ['factions', 0, 'id'], 'central')
    })
    expect(findUsages(doc, 'faction', 'axis')).toEqual([])
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
    await throughZip(doc, out!)
  })
})
