import { describe, expect, it } from 'vitest'
import { lintPack } from '../src/core/lint'
import { findUsages, renameUsages } from '../src/core/refs'
import { clonePack, createStarterPack } from '../src/core/starter'
import { validatePack } from '../src/core/validate'
import { buildPackZip, checkImportable } from '../src/core/zip'
import { haveGameRepo, loadShipped } from './helpers'

describe('the New Pack starter', () => {
  it('validates with no errors and no warnings', () => {
    const doc = createStarterPack({ id: 'my-pack', displayName: 'My Pack' })
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
    expect(lintPack(doc).map((w) => w.message)).toEqual([])
    expect(doc.isNew).toBe(true)
    expect(doc.dirty).toBe(true)
  })

  it('renames the sides everywhere and still validates', () => {
    const doc = createStarterPack({
      id: 'rome',
      displayName: 'Rome',
      sides: [
        { id: 'rome', displayName: 'Rome' },
        { id: 'carthage', displayName: 'Carthage' }
      ]
    })
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
    expect(lintPack(doc).map((w) => w.message)).toEqual([])
    const rules = doc.value('rules.json') as { by_faction: Record<string, unknown> }[]
    expect(Object.keys(rules[0].by_faction).sort()).toEqual(['carthage', 'rome'])
  })

  it('exports a zip the game would import', async () => {
    const doc = createStarterPack({ id: 'my-pack', displayName: 'My Pack' })
    const r = await buildPackZip(doc.allFiles(), { id: 'my-pack', title: 'My Pack', exporter: 'test', artSetHashes: null })
    expect(r.ok).toBe(true)
    expect(Object.keys(r.manifest!.files)).toContain('map.png')
    expect(await checkImportable(r.bytes!)).toBe('')
  })
})

const suite = haveGameRepo ? describe : describe.skip
suite('rename with references on the shipped packs', () => {
  it('ww2: renaming a faction id updates every reference and the pack stays valid', () => {
    const doc = loadShipped('ww2')
    const n = findUsages(doc, 'faction', 'axis').length
    expect(n).toBeGreaterThan(200)
    doc.edit('rename', (e) => {
      renameUsages(doc, e, 'faction', 'axis', 'central_powers')
      e.set('factions.json', ['factions', 0, 'id'], 'central_powers')
    })
    expect(findUsages(doc, 'faction', 'axis')).toEqual([])
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
  })

  for (const [kind, id, index] of [
    ['planet', 'germany', null],
    ['unit', 'commandos', null],
    ['weapon', 'torpedoes', null],
    ['facility', 'refinery', null],
    ['character', 'churchill', null],
    ['logistics', 'axis_fleet', null]
  ] as const) {
    it(`ww2: renaming ${kind} '${id}' leaves no dangling reference`, () => {
      const doc = loadShipped('ww2')
      expect(findUsages(doc, kind, id).length, 'has usages').toBeGreaterThan(0)
      doc.edit('rename', (e) => renameUsages(doc, e, kind, id, `${id}_renamed`))
      // Rename the record itself (the page does this) where it is a list row.
      doc.edit('record', (e) => {
        const where: Record<string, [string, string]> = {
          planet: ['map.json', 'planets'],
          unit: ['units.json', 'units'],
          weapon: ['weapons.json', 'weapons'],
          facility: ['facilities.json', 'facilities'],
          character: ['characters.json', 'characters']
        }
        if (kind === 'logistics') {
          e.renameKey('setup.json', ['logistics'], id, `${id}_renamed`)
          return
        }
        const [file, list] = where[kind]
        const rows = doc.get(file as 'units.json', [list]) as { id: string }[]
        const i = rows.findIndex((r) => r.id === id)
        e.set(file as 'units.json', [list, i, 'id'], `${id}_renamed`)
      })
      void index
      expect(validatePack(doc).map((e) => e.message)).toEqual([])
    })
  }

  it('clonePack gives a new id and keeps everything else', () => {
    const src = loadShipped('ww2')
    const copy = clonePack(src, 'ww2-copy', 'WW2 Copy')
    expect(copy.packId).toBe('ww2-copy')
    expect(copy.isNew).toBe(true)
    expect(copy.otherFiles()).toEqual(src.otherFiles())
    expect(validatePack(copy).map((e) => e.message)).toEqual([])
  })
})
