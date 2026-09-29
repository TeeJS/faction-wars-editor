// The look inside the editor: rule 31 in the Problems list, in the game's order;
// look edits as undoable pack changes that touch only the edited bytes; a new
// look from a preset; the importer check refusing a broken look.

import { describe, expect, it } from 'vitest'
import { PackDocument } from '../../src/core/document'
import { LOOK_FILE, createLook, editLook, lookFileOf, lookPack } from '../../src/core/look/pack'
import { PRESETS, lookFromPreset } from '../../src/core/look/presets'
import { createStarterPack } from '../../src/core/starter'
import { validatePack } from '../../src/core/validate'
import { buildPackZip, checkImportable } from '../../src/core/zip'
import { gamePack, haveLook } from './game'

const enc = new TextEncoder()
const dec = new TextDecoder()

function starter(id = 'look-pack'): PackDocument {
  return createStarterPack({
    id,
    displayName: 'Look Pack',
    sides: [
      { id: 'rome', displayName: 'Rome' },
      { id: 'carthage', displayName: 'Carthage' }
    ]
  })
}

const lookErrors = (doc: PackDocument) => validatePack(doc).filter((i) => i.target?.page === 'look').map((i) => i.message)

describe('a look on the starter pack', () => {
  it('the Plain grey preset: one undoable change, and the game would load it', () => {
    const doc = starter()
    expect(lookFileOf(doc)).toBeNull()
    expect(createLook(doc, 'Start a look', lookFromPreset(PRESETS.find((p) => p.id === 'plain-grey')!))).toBe(true)
    expect(doc.hasFile(LOOK_FILE)).toBe(true)
    expect(validatePack(doc)).toEqual([])
    doc.undo()
    expect(doc.hasFile(LOOK_FILE)).toBe(false)
  })

  it('rule 31 errors point at the Look page and come after the rest, as the game prints them', () => {
    const doc = starter()
    createLook(doc, 'Start a look', { colors: { chassis: '#000000' }, sides: { rome: 'red' } })
    doc.edit('break the count', (e) => e.set('pack.json', ['faction_count'], 3))
    const issues = validatePack(doc)
    expect(issues[0].message).toBe('pack.json: faction_count is 3 but factions.json declares 2.')
    const look = issues.filter((i) => i.target?.page === 'look').map((i) => i.message)
    expect(look[0]).toBe("look.json colors: 'chassis_deep' is missing.")
    expect(look).toHaveLength(23)
    expect(look[22]).toBe("look.json sides.rome: 'red' is not a #rrggbb color.")
    expect(issues.slice(-23).map((i) => i.message)).toEqual(look)
  })

  it('a look that is not an object is reported when it is read, before the checks', () => {
    const doc = starter()
    doc.edit('list', (e) => e.setFile(LOOK_FILE, enc.encode('[]\n')))
    doc.edit('break the count', (e) => e.set('pack.json', ['faction_count'], 3))
    expect(validatePack(doc).map((i) => i.message).slice(0, 2)).toEqual([
      'look.json: must be an object.',
      'pack.json: faction_count is 3 but factions.json declares 2.'
    ])
  })

  it('a blank look.json is no look', () => {
    const doc = starter()
    doc.edit('blank', (e) => e.setFile(LOOK_FILE, enc.encode('  \n')))
    expect(validatePack(doc)).toEqual([])
  })

  it('the importer check refuses a zip with a broken look, word for word', async () => {
    const doc = starter()
    createLook(doc, 'Start a look', { colors: {} })
    const r = await buildPackZip(doc.allFiles(), { id: doc.packId, title: 'x', exporter: 'test', artSetHashes: null })
    expect(await checkImportable(r.bytes!)).toContain("look.json colors: 'chassis' is missing.")
  })

  it('a face comes into the pack with the change that names it, and both undo together', () => {
    const doc = starter()
    createLook(doc, 'Start a look', lookFromPreset(PRESETS[0]))
    const face = new Uint8Array([0, 1, 0, 0, 9, 9])
    editLook(doc, 'Display face', (l) => l.set(['fonts', 'display'], { file: 'look/fonts/My Face.ttf' }), [['look/fonts/My Face.ttf', face]])
    expect(lookErrors(doc)).toEqual([])
    expect(doc.fileBytes('look/fonts/My Face.ttf')).toBe(face)
    doc.undo()
    expect(doc.hasFile('look/fonts/My Face.ttf')).toBe(false)
    expect(lookFileOf(doc)!.get(['fonts'])).toBeUndefined()
  })
})

describe.runIf(haveLook)("the game's WWII look in the editor", () => {
  const open = () => new PackDocument(gamePack('ww2'), 'ww2')

  it('validates clean', () => {
    expect(lookErrors(open())).toEqual([])
  })

  it('one colour changed: only its value differs, the pack is dirty, and Undo makes it clean again', () => {
    const doc = open()
    const before = dec.decode(doc.fileBytes(LOOK_FILE))
    expect(editLook(doc, 'brass', (l) => l.setColor('brass', '#00c8ff'))).toBe(true)
    expect(dec.decode(doc.fileBytes(LOOK_FILE))).toBe(before.replace('"brass": "#a88a4e"', '"brass": "#00c8ff"'))
    expect(doc.changedPaths()).toEqual([LOOK_FILE])
    expect(doc.undoLabel).toBe('brass')
    doc.undo()
    expect(doc.dirty).toBe(false)
  })

  it('changing a colour back by hand gives back the saved bytes', () => {
    const doc = open()
    const saved = doc.fileBytes(LOOK_FILE)
    editLook(doc, 'brass', (l) => l.setColor('brass', '#123456'))
    editLook(doc, 'brass', (l) => l.setColor('brass', '#a88a4e'))
    expect(doc.fileBytes(LOOK_FILE)).toBe(saved)
    expect(doc.dirty).toBe(false)
  })

  it('no change, no undo step', () => {
    const doc = open()
    expect(editLook(doc, 'same', (l) => l.setColor('brass', '#a88a4e'))).toBe(false)
    expect(doc.canUndo).toBe(false)
  })

  it('what the Look page reads: the sides, the saved colours, the files it ships', () => {
    const doc = open()
    editLook(doc, 'brass', (l) => l.setColor('brass', '#00c8ff'))
    const p = lookPack(doc)
    expect(p.factions.map((f) => f.id)).toEqual(['axis', 'allies'])
    expect(p.look!.color('brass')).toBe('#00c8ff')
    expect(p.look!.savedColor('brass')).toBe('#a88a4e')
    expect(p.ctx.hasFile('look/fonts/Oswald-Variable.ttf')).toBe(true)
    expect(p.file('look/paper.png')!.length).toBeGreaterThan(0)
    expect(p.samples.planets.length).toBeGreaterThan(0)
  })

  it('a broken face and texture are reported against the pack folder', () => {
    const doc = open()
    editLook(doc, 'break', (l) => {
      l.set(['fonts', 'display', 'file'], 'look/fonts/Missing.ttf')
      l.set(['textures', 'paper'], 'look/missing.png')
    })
    expect(validatePack(doc, { packDirLabel: 'D:/packs/ww2' }).filter((i) => i.target?.page === 'look').map((i) => i.message)).toEqual([
      "look.json fonts.display: 'look/fonts/Missing.ttf' is not in D:/packs/ww2.",
      "look.json textures.paper: 'look/missing.png' is not in D:/packs/ww2."
    ])
  })
})
