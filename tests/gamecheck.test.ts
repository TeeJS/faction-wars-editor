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
import { LOOK_FILE, createLook, editLook } from '../src/core/look/pack'
import { PRESETS, lookFromPreset } from '../src/core/look/presets'

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

// ---- the look (rule 31) ----
// On the starter wearing the WW2 pack's look and its files (WW2's sides given
// to the starter's), so nothing else in the pack can differ between the two
// validators. Every test here has "the look" in its name: -t "the look" runs
// just these.

const haveWw2Look = haveGameRepo && loadShipped('ww2').hasFile(LOOK_FILE)

type Look = Record<string, any>

function starterInWw2Look(id: string, change?: (l: Look) => void): PackDocument {
  const ww2 = loadShipped('ww2')
  const doc = starter(id)
  const look = JSON.parse(new TextDecoder().decode(ww2.fileBytes(LOOK_FILE)))
  look.sides = { rome: look.sides.axis, carthage: look.sides.allies }
  change?.(look)
  doc.edit('the WW2 look', (e) => {
    for (const rel of ww2.otherFiles()) if (rel.startsWith('look/')) e.setFile(rel, ww2.fileBytes(rel)!)
    e.setFile(LOOK_FILE, new TextEncoder().encode(JSON.stringify(look, null, 2) + '\n'))
  })
  return doc
}

/** The game's own _look_case changes, then value shapes that test Godot's str(). */
const LOOK_CASES: [string, (l: Look) => void][] = [
  ['missing-colour', (l) => delete l.colors.brass],
  ['colour-not-hex', (l) => (l.colors.ink = 'black')],
  ['unknown-colour', (l) => (l.colors.mauve = '#aa00aa')],
  ['side-not-a-faction', (l) => (l.sides.empire = '#00ff00')],
  ['unknown-font-role', (l) => (l.fonts.headline = { file: 'look/fonts/Oswald-Variable.ttf' })],
  ['font-not-shipped', (l) => (l.fonts.display = { file: 'look/fonts/Missing.ttf' })],
  ['font-not-a-font', (l) => (l.fonts.display = { file: 'look/paper.png' })],
  ['font-weight', (l) => (l.fonts.display = { file: 'look/fonts/Oswald-Variable.ttf', weight: 1200 })],
  ['size-not-whole', (l) => (l.sizes.body = 15.5)],
  ['unknown-size', (l) => (l.sizes.huge = 40)],
  ['negative-metric', (l) => (l.metrics.radius = -1)],
  ['overlay-above-1', (l) => (l.overlay_alpha = 1.5)],
  ['unknown-texture', (l) => (l.textures.wallpaper = 'look/paper.png')],
  ['texture-not-shipped', (l) => (l.textures.paper = 'look/missing.png')],
  ['map-rect', (l) => (l.dossier.map_rect = [10, 10, 0])],
  ['unknown-dossier-key', (l) => (l.dossier.banner = 'x')],
  ['colour-number', (l) => (l.colors.ink = 5)],
  ['colour-fraction', (l) => (l.colors.ink = 2.5)],
  ['colour-null', (l) => (l.colors.ink = null)],
  ['colour-bool', (l) => (l.colors.ink = true)],
  ['colour-list', (l) => (l.colors.ink = [1, 'a'])],
  ['colour-object', (l) => (l.colors.ink = { a: 1 })],
  ['colour-blank', (l) => (l.colors.ink = '   ')],
  ['side-number', (l) => (l.sides.carthage = 7)],
  ['colours-gone', (l) => delete l.colors],
  ['only-two-colours', (l) => (l.colors = { zzz: '#000000', chassis: '#000000' })],
  ['shapes', (l) => Object.assign(l, { sides: 'x', fonts: 3, sizes: null, metrics: [], dossier: 'x', textures: false })],
  ['font-details', (l) => Object.assign(l.fonts, { body: { weight: 'bold', tabular: 'yes' }, typed: 'x', display: { file: null } })],
  ['texture-details', (l) => Object.assign(l.textures, { desk: null, paper_frame: { file: 'look/paper_frame.png', margin: -2 } })],
  ['unchecked-key', (l) => (l.notes = { anything: 'goes' })],
  ['messages-not-object', (l) => (l.messages = 'x')],
  ['messages-unknown-key', (l) => (l.messages.banner = 'x')],
  ['messages-shapes', (l) => Object.assign(l.messages, { header: 5, stamps: [], urgent: 'Conflict' })],
  ['messages-categories', (l) => Object.assign(l.messages, { stamps: { Loyalty: 'Intel', Weather: 'x', Fleets: '  ', Chat: 3 }, urgent: ['Conflict', 'Storms', 2] })]
]

suite('look packs for the game to check', () => {
  it.runIf(haveWw2Look)("the look: WW2's, a colour changed, a face copied in from disk, sizes and corners changed", async () => {
    const doc = starterInWw2Look('editor-look')
    const face = doc.fileBytes('look/fonts/CourierPrime-Regular.ttf')!
    editLook(
      doc,
      'the look',
      (l) => {
        l.setColor('brass', '#b08f55')
        l.set(['fonts', 'display', 'file'], 'look/fonts/My Face.ttf')
        l.set(['fonts', 'display', 'weight'], undefined)
        l.set(['fonts', 'typed'], undefined)
        l.set(['sizes', 'heading'], 22)
        l.set(['metrics', 'radius'], 6)
        l.set(['overlay_alpha'], 0.7)
      },
      [['look/fonts/My Face.ttf', face]]
    )
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
    await throughZip(doc, out!)
  })

  it('the look: the Plain grey preset, with its own side colours', async () => {
    const doc = starter('editor-look-plain')
    const look = lookFromPreset(PRESETS.find((p) => p.id === 'plain-grey')!)
    look.sides = { rome: '#ff8a80', carthage: '#8ab4ff' }
    createLook(doc, 'Plain grey', look)
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
    await throughZip(doc, out!)
  })
})

suite("the look: the game's validator says what the editor's says, word for word", () => {
  for (const [name, change] of LOOK_CASES)
    it.runIf(haveWw2Look)(`the look: ${name}`, () => writeParity(starterInWw2Look(`parity-look-${name}`, change), name !== 'unchecked-key'))
})

// ---- report_backdrop (rule 30) and credits.json (rule 32) ----

const withCredits = (doc: PackDocument, value: unknown): PackDocument => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'
  doc.edit('credits', (e) => e.setFile('credits.json', new TextEncoder().encode(text)))
  return doc
}
const credit = { title: 'Galaxy', author: 'The editor', licence: 'CC0', files: ['map.png'] }

suite("report_backdrop and credits: the game's validator says what the editor's says, word for word", () => {
  it('report_backdrop: every check', () => {
    const doc = starter('parity-backdrop')
    doc.edit('backdrop', (e) =>
      e.set('pack.json', ['report_backdrop'], {
        _comment: 'a note, not a side',
        rome: ['000000', '0000FF', '+abcde', '-00000', '#00000', '#000000', '00000', 'ggg000', 'abcdef ', '++abcd', '-', 123456, 12345, null, true, ['a'], { a: 1 }],
        carthage: [],
        gaul: '000000'
      })
    )
    writeParity(doc, true)
  })

  it('report_backdrop: not an object', () => {
    const doc = starter('parity-backdrop-shape')
    doc.edit('backdrop', (e) => e.set('pack.json', ['report_backdrop'], ['000000']))
    writeParity(doc, true)
  })

  it('report_backdrop: good colours, for any side, load clean', () => {
    const doc = starter('parity-backdrop-good')
    doc.edit('backdrop', (e) => e.set('pack.json', ['report_backdrop'], { rome: ['000000', 'A0b1C2'], anyone: ['+abcde', 'ffffff'] }))
    writeParity(doc, false)
  })

  for (const [name, text] of [
    ['list', '[]'],
    ['key-case', '{"Assets": []}'],
    ['assets-not-list', '{"assets": {"a": 1}}']
  ])
    it(`credits: not an object with an assets list (${name}), before the other rules`, () => {
      const doc = withCredits(starter(`parity-credits-${name}`), text)
      doc.edit('two sizes', (e) => e.set('pack.json', ['setup', 'galaxy_sizes'], ['standard', 'large']))
      writeParity(doc, true)
    })

  it('credits: a blank file is no credits and loads clean', () => {
    writeParity(withCredits(starter('parity-credits-blank'), ' \n'), false)
  })

  it('credits: every check', () => {
    const doc = withCredits(starter('parity-credits'), {
      assets: [
        'x',
        { title: '', author: ' ', licence: 5, files: [] },
        { ...credit, source: 'http://example.com', licence_url: 5, files: ['nope.png', '../map.png', ' ', 3, 'map.png', './map.png'] },
        { ...credit, title: null, files: 'map.png' },
        { Title: 'Galaxy', author: 'The editor', licence: 'CC0', files: ['map.png'] }
      ]
    })
    writeParity(doc, true)
  })

  it('credits: a good file, links and all, loads clean', () => {
    const doc = withCredits(starter('parity-credits-good'), { _comment: 'a note', assets: [{ ...credit, source: 'https://example.com', licence_url: 'https://example.com/l' }] })
    writeParity(doc, false)
  })

  it.runIf(haveWw2Look)('rules 30, 31 and 32 together, in the game order', () => {
    const doc = withCredits(
      starterInWw2Look('parity-rules-30-32', (l) => (l.colors.ink = 'black')),
      { assets: [{ ...credit, files: ['gone.png'] }] }
    )
    doc.edit('backdrop', (e) => e.set('pack.json', ['report_backdrop'], { rome: ['black'] }))
    writeParity(doc, true)
  })
})
