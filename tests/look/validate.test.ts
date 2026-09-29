// Rule 31, against the cases the game's own tests/pack_validation.gd runs
// (_look_passes and every _look_case), each with the game's full message, on
// the game's own WWII look (tests/look/game.ts).

import { describe, expect, it } from 'vitest'
import { gamePackDir, readLook, validateLook } from '../../src/core/look/validate'
import { gdStr } from '../../src/core/look/godot'
import { haveLook, ww2Ctx, ww2Look } from './game'

const withLook = haveLook ? describe : describe.skip

type Look = Record<string, any>

function broken(change: (l: Look) => void): string[] {
  const l = ww2Look() as Look
  change(l)
  return validateLook(l, ww2Ctx())
}

const COLORS =
  'chassis, chassis_deep, chassis_raised, chassis_hover, edge, brass, brass_dim, text, text_muted, text_disabled, heading, paper, paper_edge, ink, ink_muted, khaki, olive, olive_deep, signal, signal_text, note, note_ink, overlay'

withLook("rule 31: the game's own cases", () => {
  it("the WWII pack's look validates unchanged", () => {
    expect(validateLook(ww2Look(), ww2Ctx())).toEqual([])
  })

  const cases: [string, (l: Look) => void, string][] = [
    ['a look missing a colour', (l) => delete l.colors.brass, "look.json colors: 'brass' is missing."],
    ['a look colour that is not #rrggbb', (l) => (l.colors.ink = 'black'), "look.json colors.ink: 'black' is not a #rrggbb color."],
    [
      'a colour the engine does not know',
      (l) => (l.colors.mauve = '#aa00aa'),
      `look.json colors: 'mauve' is not a known colour. Known: ${COLORS}.`
    ],
    [
      'a side colour for a faction the pack lacks',
      (l) => (l.sides.empire = '#00ff00'),
      "look.json sides: 'empire' is not a faction in factions.json."
    ],
    [
      'a face in a role the engine does not know',
      (l) => (l.fonts.headline = { file: 'look/fonts/Oswald-Variable.ttf' }),
      'look.json fonts.headline: not a known role. Known: display, display_bold, body, body_bold, typed, typed_bold.'
    ],
    [
      'a face the pack does not ship',
      (l) => (l.fonts.display = { file: 'look/fonts/Missing.ttf' }),
      "look.json fonts.display: 'look/fonts/Missing.ttf' is not in res://packs/ww2."
    ],
    [
      'a face that is not a font file',
      (l) => (l.fonts.display = { file: 'look/paper.png' }),
      "look.json fonts.display: file 'look/paper.png' is not a .ttf or .otf."
    ],
    [
      'a face at an impossible weight',
      (l) => (l.fonts.display = { file: 'look/fonts/Oswald-Variable.ttf', weight: 1200 }),
      'look.json fonts.display: weight must be a number from 100 to 900.'
    ],
    ['a size that is not a whole number', (l) => (l.sizes.body = 15.5), 'look.json sizes.body: must be a positive whole number.'],
    [
      'a size the engine does not know',
      (l) => (l.sizes.huge = 40),
      "look.json sizes: 'huge' is not known. Known: body, small, label, title, heading, display."
    ],
    ['a negative metric', (l) => (l.metrics.radius = -1), 'look.json metrics.radius: must be a number, 0 or more.'],
    ['an overlay alpha above 1', (l) => (l.overlay_alpha = 1.5), 'look.json overlay_alpha: must be a number from 0 to 1.'],
    [
      'a texture the engine does not know',
      (l) => (l.textures.wallpaper = 'look/paper.png'),
      'look.json textures.wallpaper: not a known texture. Known: paper, paper_frame, desk, grain, rule.'
    ],
    [
      'a texture the pack does not ship',
      (l) => (l.textures.paper = 'look/missing.png'),
      "look.json textures.paper: 'look/missing.png' is not in res://packs/ww2."
    ],
    [
      'a dossier map plate that is not [x, y, w, h]',
      (l) => (l.dossier.map_rect = [10, 10, 0]),
      "look.json dossier.map_rect: must be [x, y, w, h] in map_image's pixels, w and h above 0."
    ],
    [
      'a dossier field the engine does not know',
      (l) => (l.dossier.banner = 'x'),
      "look.json dossier: 'banner' is not known. Known: subtitle, map_rect, map_caption."
    ]
  ]
  for (const [what, change, message] of cases)
    it(what, () => {
      expect(broken(change)).toEqual([message])
    })
})

withLook('rule 31: the rest of the checks', () => {
  it('an empty look is no look', () => {
    expect(validateLook({}, ww2Ctx())).toEqual([])
  })

  it('colours missing entirely', () => {
    expect(broken((l) => delete l.colors)).toEqual(["look.json: `colors` must be an object of the look's colours."])
  })

  it('every missing colour, in the game order, then the unknown ones in file order', () => {
    const errors = broken((l) => {
      l.colors = { zzz: '#000000', chassis: '#000000' }
    })
    expect(errors[0]).toBe("look.json colors: 'chassis_deep' is missing.")
    expect(errors).toHaveLength(23)
    expect(errors[22]).toMatch(/^look\.json colors: 'zzz' is not a known colour/)
  })

  it('a comment key is never data', () => {
    expect(broken((l) => (l.colors._note = 'x'))).toEqual([])
  })

  it('a blank colour is missing; a short one is not #rrggbb', () => {
    expect(broken((l) => (l.colors.ink = '  '))).toEqual(['look.json colors.ink: missing.'])
    expect(broken((l) => (l.colors.ink = '#12345'))).toEqual(["look.json colors.ink: '#12345' is not a #rrggbb color."])
    expect(broken((l) => (l.colors.ink = '#12345g'))).toEqual(["look.json colors.ink: '#12345g' is not a #rrggbb color."])
  })

  it('non-text values print the way Godot prints them', () => {
    expect(broken((l) => (l.colors.ink = 5))).toEqual(["look.json colors.ink: '5.0' is not a #rrggbb color."])
    expect(broken((l) => (l.colors.ink = null))).toEqual(["look.json colors.ink: '<null>' is not a #rrggbb color."])
    expect(broken((l) => (l.colors.ink = true))).toEqual(["look.json colors.ink: 'true' is not a #rrggbb color."])
    expect(gdStr([1, 'a', null])).toBe('[1.0, "a", <null>]')
    expect(gdStr({ a: 1.5 })).toBe('{ "a": 1.5 }')
  })

  it('shapes that are not objects', () => {
    expect(broken((l) => (l.sides = 'x'))).toEqual(['look.json: `sides` must be an object of faction id -> colour.'])
    expect(broken((l) => (l.fonts = 3))).toEqual(['look.json: `fonts` must be an object of role -> face.'])
    expect(broken((l) => (l.sizes = null))).toEqual(['look.json: `sizes` must be an object.'])
    expect(broken((l) => (l.metrics = []))).toEqual(['look.json: `metrics` must be an object.'])
    expect(broken((l) => (l.dossier = 'x'))).toEqual(['look.json: `dossier` must be an object.'])
    expect(broken((l) => (l.textures = false))).toEqual(['look.json: `textures` must be an object of name -> picture.'])
    expect(broken((l) => (l.fonts.body = 'x'))).toEqual(['look.json fonts.body: must be an object with a `file`.'])
  })

  it('font details', () => {
    expect(broken((l) => (l.fonts.body.tabular = 'yes'))).toEqual(['look.json fonts.body: tabular must be true or false.'])
    expect(broken((l) => (l.fonts.body.weight = 'bold'))).toEqual(['look.json fonts.body: weight must be a number from 100 to 900.'])
    expect(broken((l) => (l.fonts.body = { weight: 400 }))).toEqual(["look.json fonts.body: file '' is not a .ttf or .otf."])
    expect(broken((l) => (l.fonts.body = { file: '../escape.ttf' }))).toEqual(["look.json fonts.body: '../escape.ttf' is not in res://packs/ww2."])
  })

  it('sizes, metrics and textures', () => {
    expect(broken((l) => (l.sizes.small = 0))).toEqual(['look.json sizes.small: must be a positive whole number.'])
    expect(broken((l) => (l.metrics.pad = 'x'))).toEqual(['look.json metrics.pad: must be a number, 0 or more.'])
    expect(broken((l) => (l.metrics.oops = 1))).toEqual(["look.json metrics: 'oops' is not known. Known: radius, border, focus, pad."])
    expect(broken((l) => (l.textures.paper_frame.margin = -2))).toEqual(['look.json textures.paper_frame: margin must be a number, 0 or more.'])
    expect(broken((l) => (l.textures.desk = null))).toEqual(["look.json textures.desk: '<null>' is not a .png."])
  })

  it('dossier text', () => {
    expect(broken((l) => (l.dossier.subtitle = 4))).toEqual(['look.json dossier.subtitle: must be text.'])
  })

  it('keys the game does not check are left alone', () => {
    expect(broken((l) => (l.notes = { anything: 'goes' }))).toEqual([])
  })

  const CATS = 'Loyalty, Fleets, Missions, Resources, Manufacturing, Defense, Conflict, Chat, Advice'
  it('messages (the Message Index as dispatches): its keys, shapes, categories and words', () => {
    expect(broken((l) => (l.messages = { header: 'Dispatch' }))).toEqual([])
    expect(broken((l) => (l.messages = 'x'))).toEqual(['look.json: `messages` must be an object.'])
    expect(broken((l) => (l.messages.banner = 'x'))).toEqual(["look.json messages: 'banner' is not known. Known: header, stamps, urgent."])
    expect(broken((l) => Object.assign(l.messages, { header: 5, stamps: [], urgent: 'Conflict' }))).toEqual([
      'look.json messages.header: must be text.',
      'look.json messages.stamps: must be an object of category -> word.',
      'look.json messages.urgent: must be a list of message categories.'
    ])
    expect(broken((l) => Object.assign(l.messages, { stamps: { Loyalty: 'Intel', Weather: 'x', Fleets: '  ', Chat: 3, _note: 'n' }, urgent: ['Conflict', 'Storms', 2] }))).toEqual([
      `look.json messages.stamps: 'Weather' is not a message category. Known: ${CATS}.`,
      'look.json messages.stamps.Fleets: must be a word.',
      'look.json messages.stamps.Chat: must be a word.',
      "look.json messages.urgent: 'Storms' is not a message category.",
      "look.json messages.urgent: '2.0' is not a message category."
    ])
  })
})

describe('reading look.json', () => {
  const ctx = ww2Ctx('D:/packs/ww2')
  it('a blank file is no look', () => {
    expect(readLook('  \n', ctx)).toEqual({ look: null, errors: [] })
    expect(readLook(null, ctx)).toEqual({ look: null, errors: [] })
  })
  it('a list is not a look', () => {
    expect(readLook('[]', ctx).errors).toEqual(['look.json: must be an object.'])
  })
  it('malformed JSON names the file', () => {
    expect(readLook('{', ctx).errors[0]).toMatch(/^D:\/packs\/ww2\/look\.json: malformed JSON - /)
  })
  it('the game names a folder with forward slashes', () => {
    expect(gamePackDir('D:\\Games\\packs\\ww2\\')).toBe('D:/Games/packs/ww2')
  })
})
