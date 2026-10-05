import { describe, expect, it } from 'vitest'
import { PackDocument } from '../src/core/document'
import { hydrate, placesLabel } from '../src/core/model'
import { alias, DESCRIPTIONS, pictureSlots, pngSize, readDescription, writeDescription } from '../src/core/pictures'
import { starfieldPng } from '../src/core/png'
import { clonePack, createStarterPack } from '../src/core/starter'
import { validatePack } from '../src/core/validate'
import { oldArtPath } from '../src/core/vocab'
import { haveGameRepo, loadShipped } from './helpers'

describe('picture slots (the game artwork.gd lookup)', () => {
  const doc = createStarterPack({ id: 'p', displayName: 'P' })
  const { pack } = hydrate(doc)

  it('a character: Encyclopedia, 80x80 portrait, 61x25 miniature, under the pack art/', () => {
    const slots = pictureSlots(pack, 'characters', 'a_leader')
    expect(slots.map((s) => [s.key, s.own, s.size])).toEqual([
      ['encyclopedia', 'art/characters/a_leader.png', undefined],
      ['portrait', 'art/portraits/characters/a_leader.png', [80, 80]],
      ['miniature', 'art/miniatures/characters/a_leader.png', [61, 25]]
    ])
    // No art sets declared: nothing to borrow.
    expect(slots.every((s) => s.set.length === 0)).toBe(true)
  })

  it('a mission: a big picture and a card per side (skin, else faction id), plus the side-less fallback', () => {
    const slots = pictureSlots(pack, 'missions', 'espionage')
    expect(slots.map((s) => s.own)).toEqual([
      'art/missions/espionage.faction_a.png',
      'art/missions/espionage.faction_a.small.png',
      'art/missions/espionage.faction_b.png',
      'art/missions/espionage.faction_b.small.png',
      'art/missions/espionage.png'
    ])
  })

  it('a planet: its Encyclopedia picture and, with an artwork_id, the shared sprite (locations/, location_sprites/)', () => {
    expect(pictureSlots(pack, 'locations', 'alpha_prime', '', 0).map((s) => s.own)).toEqual(['art/locations/alpha_prime.png'])
    expect(pictureSlots(pack, 'locations', 'alpha_prime', '', 7).map((s) => s.own)).toEqual(['art/locations/alpha_prime.png', 'art/location_sprites/7.png'])
  })

  it('the folders\' old names, which the game still reads (planets/, planet_sprites/)', () => {
    expect(oldArtPath('art/locations/alpha_prime.png')).toBe('art/planets/alpha_prime.png')
    expect(oldArtPath('art/location_sprites/7.png')).toBe('art/planet_sprites/7.png')
    expect(oldArtPath('locations/yavin.png')).toBe('planets/yavin.png')
    expect(oldArtPath('location_sprites/3.png')).toBe('planet_sprites/3.png')
    expect(oldArtPath('art/characters/a_leader.png')).toBeNull()
    expect(oldArtPath('portraits/characters/a_leader.png')).toBeNull()
  })

  it('an art reference by the old kind name reads as locations', () => {
    expect(alias(pack, 'locations', 'alpha_prime', 'planets/beta')).toEqual(['', 'locations', 'beta'])
    expect(alias(pack, 'locations', 'alpha_prime', 'locations/beta')).toEqual(['', 'locations', 'beta'])
  })

  const suite = haveGameRepo ? describe : describe.skip
  suite('with an art set', () => {
    it('SWR: the own path uses the row id; the art set uses the same row, keyed by skin for missions', () => {
      const { pack: swr } = hydrate(loadShipped('star-wars-rebellion'))
      const [portrait] = pictureSlots(swr, 'characters', 'mon_mothma').filter((s) => s.key === 'portrait')
      expect(portrait.own).toBe('art/portraits/characters/mon_mothma.png')
      expect(portrait.set).toEqual(['swr-original:portraits/characters/mon_mothma.png'])
      const mission = pictureSlots(swr, 'missions', 'diplomacy').map((s) => s.set[0])
      expect(mission).toContain('swr-original:missions/diplomacy.alliance.png')
      expect(mission).toContain('swr-original:missions/diplomacy.empire.small.png')
    })
    it('the page of the map\'s places takes the pack\'s own word (display.json terms systems)', () => {
      expect(placesLabel(hydrate(loadShipped('ww2')).pack)).toBe('Territories')
      expect(placesLabel(hydrate(loadShipped('star-wars-rebellion')).pack)).toBe('Planets')
    })
    it('an art reference redirects only the art-set lookup', () => {
      const { pack: swr } = hydrate(loadShipped('star-wars-rebellion'))
      const [enc] = pictureSlots(swr, 'units', 'my_ship', 'swr-original:units/star_destroyer')
      expect(enc.own).toBe('art/units/my_ship.png')
      expect(enc.set).toEqual(['swr-original:units/star_destroyer.png'])
    })
  })
})

describe('Encyclopedia text (art/descriptions.json)', () => {
  it('writes, reads, edits in place and removes', () => {
    const doc = createStarterPack({ id: 'p', displayName: 'P' })
    expect(readDescription(doc, 'characters', 'a_leader')).toBe('')
    doc.edit('d', (e) => writeDescription(doc, e, 'characters', 'a_leader', 'A born leader.'))
    doc.edit('d', (e) => writeDescription(doc, e, 'units', 'a_fighter', 'Fast.'))
    expect(readDescription(doc, 'characters', 'a_leader')).toBe('A born leader.')
    expect(JSON.parse(new TextDecoder().decode(doc.fileBytes(DESCRIPTIONS)))).toEqual({
      characters: { a_leader: 'A born leader.' },
      units: { a_fighter: 'Fast.' }
    })
    doc.edit('d', (e) => writeDescription(doc, e, 'characters', 'a_leader', ''))
    expect(readDescription(doc, 'characters', 'a_leader')).toBe('')
    expect(readDescription(doc, 'units', 'a_fighter')).toBe('Fast.')
    // Pictures and text are extra files: the pack still validates.
    expect(validatePack(doc).map((i) => i.message)).toEqual([])
  })

  it('a system\'s text: the old "planets" section is read, and an edit moves it to "locations"', () => {
    const doc = createStarterPack({ id: 'p', displayName: 'P' })
    doc.edit('d', (e) => e.setFile(DESCRIPTIONS, new TextEncoder().encode(JSON.stringify({ planets: { alpha_prime: 'Old words.' } }))))
    expect(readDescription(doc, 'locations', 'alpha_prime')).toBe('Old words.')
    doc.edit('d', (e) => writeDescription(doc, e, 'locations', 'alpha_prime', 'New words.'))
    const all = JSON.parse(new TextDecoder().decode(doc.fileBytes(DESCRIPTIONS)))
    expect(all.locations).toEqual({ alpha_prime: 'New words.' })
    expect(all.planets?.alpha_prime).toBeUndefined()
    expect(readDescription(doc, 'locations', 'alpha_prime')).toBe('New words.')
  })
})

describe('pngSize', () => {
  it('reads the header', () => {
    expect(pngSize(starfieldPng(80, 80))).toEqual([80, 80])
    expect(pngSize(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})

describe('Make my own copy', () => {
  it('leaves original/ out, so the copy can always be exported', () => {
    const files = new Map<string, Uint8Array>()
    const src = createStarterPack({ id: 'base', displayName: 'Base' })
    for (const f of src.allFiles()) files.set(f.path, f.bytes)
    files.set('original/import.log', new Uint8Array([1]))
    files.set('Original/x.png', new Uint8Array([2]))
    files.set('art/portraits/characters/a_leader.png', starfieldPng(80, 80))
    const doc = new PackDocument(files, 'base')
    const copy = clonePack(doc, 'base-mod', 'Base (modded)')
    expect(copy.otherFiles()).toEqual(['art/portraits/characters/a_leader.png', 'map.png'])
    expect(copy.packId).toBe('base-mod')
  })
})
