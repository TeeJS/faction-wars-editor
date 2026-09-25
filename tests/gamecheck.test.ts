// Writes editor-made packs for the GAME to check (tests/gamecheck/README.md):
// each pack goes through a zip export and back, exactly as a player's would,
// then lands as a folder the game's own validator and soak can load.
// Runs only when FWE_GAMECHECK_DIR is set.

import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PackDocument } from '../src/core/document'
import { findUsages, renameUsages } from '../src/core/refs'
import { clonePack, createStarterPack } from '../src/core/starter'
import { validatePack } from '../src/core/validate'
import { buildPackZip, checkImportable, openPackZip } from '../src/core/zip'
import { commentedCopy, haveGameRepo, loadShipped } from './helpers'

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

// Broken on purpose: the game's own validator (its tests/validate_pack.gd) must print
// exactly these errors, in this order. Each folder gets <id>.expected.txt beside it,
// one error per line; an empty file means the pack must load.
function writeParity(doc: PackDocument, expectErrors: boolean): void {
  const dir = join(out!, 'parity')
  const target = join(dir, doc.packId)
  rmSync(target, { recursive: true, force: true })
  for (const f of doc.allFiles()) {
    mkdirSync(dirname(join(target, f.path)), { recursive: true })
    writeFileSync(join(target, f.path), f.bytes)
  }
  // The game prints the folder's full name with '/' separators - a Windows short
  // name (C:/Users/RUNNER~1/...) comes out long - so the expected text does too.
  const errors = validatePack(doc, { packDirLabel: realpathSync.native(target).replace(/\\/g, '/') }).map((e) => e.message)
  expect(errors.length > 0, errors.join('\n')).toBe(expectErrors)
  writeFileSync(join(dir, `${doc.packId}.expected.txt`), errors.map((e) => e + '\n').join(''))
}

function starter(id: string): PackDocument {
  return createStarterPack({
    id,
    displayName: id,
    sides: [
      { id: 'rome', displayName: 'Rome' },
      { id: 'carthage', displayName: 'Carthage' }
    ]
  })
}

suite("the game's validator says what the editor's says, word for word", () => {
  it('fewer than three galaxy sizes', () => {
    const doc = starter('parity-sizes')
    doc.edit('two sizes', (e) => e.set('pack.json', ['setup', 'galaxy_sizes'], ['standard', 'large']))
    writeParity(doc, true)
  })

  it('empty seeds, and a hidden headquarters with no placement', () => {
    const doc = starter('parity-seed')
    doc.edit('break seeds', (e) => {
      e.set('factions.json', ['factions', 0, 'seed', 'fleet'], '')
      e.set('factions.json', ['factions', 0, 'seed', 'hq_garrison'], '')
      e.set('factions.json', ['factions', 1, 'hq'], { kind: 'hidden' })
    })
    writeParity(doc, true)
  })

  it('logistics: a missing Core table, a Rim table that is not an object, and comment keys', () => {
    const doc = starter('parity-logistics')
    doc.edit('break logistics', (e) => {
      e.remove('setup.json', ['logistics', 'core_system_facilities'])
      e.set('setup.json', ['logistics', 'rim_system_facilities'], 5)
      e.set('setup.json', ['logistics', '_comment'], 'a note, not a table')
      e.set('mission_tables.json', ['tables', '_comment'], 'a note, not a table')
    })
    writeParity(doc, true)
  })

  it.runIf(haveGameRepo)('Cockpit screen corners that are not four [x, y] pairs', () => {
    const doc = clonePack(loadShipped('star-wars-rebellion'), 'parity-quad', 'Parity quad')
    doc.edit('break quads', (e) => {
      e.set('pack.json', ['menu', 'regions', 0, 'quad'], [
        [0, 0],
        [10, 0],
        [10, 10]
      ])
      e.set('pack.json', ['menu', 'regions', 1, 'quad'], 'none')
    })
    writeParity(doc, true)
  })

  it.runIf(haveGameRepo)('Cockpit monitors: every check', () => {
    const doc = clonePack(loadShipped('star-wars-rebellion'), 'parity-monitors', 'Parity monitors')
    const n = (doc.get('pack.json', ['menu', 'monitors']) as unknown[]).length
    doc.edit('break monitors', (e) => {
      e.set('pack.json', ['menu', 'monitor_fps'], 0)
      e.insert('pack.json', ['menu', 'monitors'], n, { at: [1], frames: 2, still: 2, selected_image: 'no-such.png' })
      e.insert('pack.json', ['menu', 'monitors'], n + 1, { image: 'nowhere.png', at: [0, 0], frames: 0, region: 'nowhere' })
      e.insert('pack.json', ['menu', 'monitors'], n + 2, { image: 'other-set:menu/x.png', at: [0, 0] })
    })
    writeParity(doc, true)
  })

  it('a card picture from an art set the pack does not declare', () => {
    const doc = starter('parity-card')
    doc.edit('card', (e) => e.set('pack.json', ['card_image'], 'swr-original:screens/card.png'))
    writeParity(doc, true)
  })

  it('a card picture the pack left behind still loads', () => {
    const doc = starter('parity-card-missing')
    doc.edit('card', (e) => e.set('pack.json', ['card_image'], 'no-such-picture.jpg'))
    writeParity(doc, false)
  })

  it.runIf(haveGameRepo)('WW2 with a comment in every JSON object loads clean', () => {
    const { doc } = commentedCopy(clonePack(loadShipped('ww2'), 'parity-comments', 'Parity comments'), 'parity-comments')
    writeParity(doc, false)
  })
})
