// The starting presets load in the game (rule 31) and meet the game's own
// contrast test; borrowing another pack's look keeps only what this pack can use.

import { describe, expect, it } from 'vitest'
import { PRESETS, lookFromOther, lookFromPreset } from '../../src/core/look/presets'
import { LookFile } from '../../src/core/look/lookfile'
import { validateLook } from '../../src/core/look/validate'
import { contrastPairs } from '../../src/core/look/contrast'
import { haveLook, ww2Look } from './game'

const swr = [
  { id: 'alliance', name: 'Alliance', color: '#ff0000' },
  { id: 'empire', name: 'Empire', color: '#00ff00' }
]
const ctx = { packDir: 'D:/packs/star-wars-rebellion', factionIds: swr.map((f) => f.id), hasFile: () => false }

describe('presets', () => {
  for (const p of PRESETS)
    it(`${p.name}: loads in the game, and every contrast pair the game checks passes`, () => {
      const look = lookFromPreset(p)
      expect(validateLook(look, ctx)).toEqual([])
      const pairs = contrastPairs(LookFile.fromValue(look), [])
      expect(pairs.filter((x) => x.ok !== true).map((x) => `${x.fg} on ${x.bg} ${x.ratio?.toFixed(2)}`)).toEqual([])
    })

  it.runIf(haveLook)('the Map room preset is exactly the WWII look', () => {
    const w = ww2Look() as Record<string, any>
    const p = PRESETS.find((x) => x.id === 'map-room')!
    expect(p.colors).toEqual(Object.fromEntries(Object.entries(w.colors).filter(([k]) => !k.startsWith('_'))))
    expect(p.sizes).toEqual(w.sizes)
    expect(p.metrics).toEqual(w.metrics)
    expect(p.overlay_alpha).toBe(w.overlay_alpha)
    const { _comment, ...messages } = w.messages
    void _comment
    expect({ ...messages, stamps: Object.fromEntries(Object.entries(messages.stamps).filter(([k]) => !k.startsWith('_'))) }).toEqual(p.messages)
  })
})

describe("borrowing another pack's look", () => {
  it.runIf(haveLook)("WWII's look for Star Wars: colours and sizes come, WWII's sides, faces and textures stay behind", () => {
    const b = lookFromOther(ww2Look(), swr, () => false)
    expect(b.filled).toEqual([])
    expect(b.look.sides).toBeUndefined()
    expect(b.look.fonts).toBeUndefined()
    expect(b.look.textures).toBeUndefined()
    expect(b.dropped).toEqual(expect.arrayContaining(['side allies', 'side axis', 'face display (look/fonts/Oswald-Variable.ttf)', 'texture paper (look/paper.png)']))
    expect(validateLook(b.look, ctx)).toEqual([])
    expect(b.look).not.toHaveProperty('dossier')
    // The dispatch words are words: they come too.
    expect((b.look.messages as Record<string, unknown>).header).toBe('Dispatch')
    expect((b.look.messages as Record<string, unknown>).urgent).toEqual(['Conflict'])
  })

  it('dispatch words the game would refuse are left behind, and named', () => {
    const b = lookFromOther({ colors: {}, messages: { header: 'Cable', stamps: { Fleets: 'Signal', Weather: 'Storm', Chat: ' ' }, urgent: ['Conflict', 'Storms'] } }, swr, () => false)
    expect(b.look.messages).toEqual({ header: 'Cable', stamps: { Fleets: 'Signal' }, urgent: ['Conflict'] })
    expect(b.dropped).toEqual(expect.arrayContaining(['stamp Weather', 'stamp Chat']))
    expect(validateLook(b.look, ctx)).toEqual([])
  })

  it.runIf(haveLook)('faces and textures the pack does ship are kept', () => {
    const b = lookFromOther(ww2Look(), swr, (rel) => rel === 'look/fonts/Oswald-Variable.ttf')
    expect(Object.keys(b.look.fonts as object)).toEqual(['display', 'display_bold'])
  })

  it('missing or broken colours are filled from the Map room preset, and named', () => {
    const b = lookFromOther({ colors: { chassis: '#000000', ink: 'black' } }, swr, () => false)
    expect((b.look.colors as Record<string, string>).chassis).toBe('#000000')
    expect((b.look.colors as Record<string, string>).ink).toBe('#2a2620')
    expect(b.filled).toHaveLength(22)
    expect(validateLook(b.look, ctx)).toEqual([])
  })

  it('side colours for factions this pack has are kept', () => {
    const b = lookFromOther({ colors: {}, sides: { alliance: '#ff8080', rebels: '#123456' } }, swr, () => false)
    expect(b.look.sides).toEqual({ alliance: '#ff8080' })
    expect(b.dropped).toContain('side rebels')
  })
})
