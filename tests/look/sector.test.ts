// The Sector window's theatre plate (src/core/look/sector.ts), against the
// game's own check of it (tests/look_sector.gd, main 4ad04bf): with the WWII
// pack's pictures, every one of its theatres is a map, the five small European
// ones cut from the Europe inset and the rest from the detail map. Then the
// layout, the entries kept apart, the sheet, and OnPaper.

import { describe, expect, it } from 'vitest'
import { contrast } from '../../src/core/look/contrast'
import {
  entryParts,
  entryRects,
  layoutTheatre,
  onPaper,
  plateOf,
  readSector,
  roomOf,
  sampleEntry,
  separateEntries,
  type Picture,
  type PlatePictures,
  type Rect,
  type Theatre
} from '../../src/core/look/sector'
import { gameBytes, gamePack } from './game'

/** A JPEG's size, from its frame header. */
function jpegSize(b: Uint8Array): Picture {
  let i = 2
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error('not a JPEG marker')
    const m = b[i + 1]
    const len = (b[i + 2] << 8) | b[i + 3]
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] }
    i += 2 + len
  }
  throw new Error('no frame header')
}

const json = (files: Map<string, Uint8Array>, rel: string): unknown => JSON.parse(new TextDecoder().decode(files.get(rel)!).replace(/^﻿/, ''))

/** The game's tests/look_sector.gd EUROPE: the theatres too small for the detail map, which the Europe inset holds. */
const EUROPE = ['British Isles', 'Western Europe', 'Central Europe', 'Iberia', 'Italian Peninsula']

const haveInsets = gameBytes('packs/ww2/look/europe_1941.jpg') !== null

describe.runIf(haveInsets)("the WWII pack's theatres, as the game's own test checks them", () => {
  const files = gamePack('ww2')
  const data = readSector({ pack: json(files, 'pack.json'), map: json(files, 'map.json'), factions: json(files, 'factions.json'), display: json(files, 'display.json') })
  const look = json(files, 'look.json') as { textures: { map_detail: string }; map_insets: { image: string; at: number[] }[] }
  const pics: PlatePictures = {
    detail: jpegSize(files.get(look.textures.map_detail)!),
    map: jpegSize(files.get('world_1941.jpg')!),
    mapRect: data.mapRect,
    insets: look.map_insets.map((m) => ({ picture: jpegSize(files.get(m.image)!), at: { x: m.at[0], y: m.at[1], w: m.at[2], h: m.at[3] } }))
  }

  it('twenty theatres, each with its systems, and who holds them at the start', () => {
    expect(data.theatres).toHaveLength(20)
    expect(data.theatres.every((t) => t.systems.length > 0)).toBe(true)
    expect(data.theatres.flatMap((t) => t.systems).some((s) => s.holder !== null)).toBe(true)
    expect(data.mapRect).not.toBeNull()
  })

  it('every theatre is a map: the five small European ones from the inset, the rest from the detail map', () => {
    for (const t of data.theatres) {
      const plate = plateOf(layoutTheatre(t), pics)
      expect(plate.kind, t.name).toBe('map')
      expect(plate.cut!.from, t.name).toBe(EUROPE.includes(t.name) ? 0 : 'detail')
    }
    expect(data.theatres.filter((t) => EUROPE.includes(t.name)).map((t) => t.name).sort()).toEqual([...EUROPE].sort())
  })

  // What the game itself makes of each theatre's window at 4ad04bf (printed by a
  // probe run on a copy of the game: the sector map's size, its look_plate and
  // look_zoom, and the LookPlate's atlas region and rect).
  const GAME: [string, number, number, number, 'detail' | 'inset', number[], number[]][] = [
    ['British Isles', 600, 192, 1.904762, 'inset', [52.5, 63, 315, 201.6], [0, 0, 600, 192]],
    ['Western Europe', 471.429, 600, 1.52381, 'inset', [422.561, 128.625, 309.878, 393.75], [0, 0, 471.429, 600]],
    ['Central Europe', 600, 450, 1.428571, 'inset', [714, 159.262, 420, 380.537], [0, 0, 600, 450]],
    ['Scandinavia', 600, 407.143, 2.929688, 'detail', [2091.886, 553.237, 204.8, 177.439], [0, 0, 600, 407.143]],
    ['Iberia', 600, 450, 2.857143, 'inset', [63, 793.631, 210, 190.268], [0, 0, 600, 450]],
    ['Italian Peninsula', 490.909, 600, 1.962482, 'inset', [704.427, 662.062, 250.147, 309.375], [0, 0, 490.909, 600]],
    ['Balkans', 286.957, 600, 3.328263, 'detail', [2206.263, 830.568, 110.629, 180.274], [0, 0, 286.957, 600]],
    ['Eastern Front', 600, 434.483, 2.828664, 'detail', [2208.183, 646.92, 212.114, 189.031], [0, 0, 600, 434.483]],
    ['Caucasus and Urals', 600, 504.348, 1.188859, 'detail', [2436.388, 492.322, 504.686, 485.869], [0, 0, 600, 504.348]],
    ['North Africa', 600, 192, 1.242898, 'detail', [1917.806, 819.333, 482.743, 505.646], [0, 0, 600, 192]],
    ['Middle East', 600, 272.727, 2.485795, 'detail', [2369.097, 892.753, 241.371, 198.311], [0, 0, 600, 272.727]],
    ['North Atlantic', 512, 600, 1.046753, 'detail', [1405.537, 450.372, 489.132, 587.851], [0, 0, 512, 600]],
    ['North America', 359.184, 600, 0.520749, 'detail', [537.892, 300.3, 773.267, 1152.188], [0, 0, 359.184, 600]],
    ['East Asia', 523.404, 600, 1.681492, 'detail', [3159.198, 770.79, 311.274, 368.386], [0, 0, 523.404, 600]],
    ['Southeast Asia', 600, 536.17, 1.745346, 'detail', [3025.92, 1096.973, 343.771, 343.053], [0, 0, 600, 536.17]],
    ['South Asia', 388.235, 600, 1.500981, 'detail', [2677.721, 943.226, 279.483, 399.738], [0, 0, 388.235, 600]],
    ['Central Pacific', 600, 425.581, 0.953852, 'detail', [3500.617, 899.054, 595.383, 555.339], [0, 0, 567.907, 425.581]],
    ['South Pacific', 496.552, 600, 0.893779, 'detail', [3408.618, 1353.938, 555.564, 681.907], [0, 0, 496.552, 600]],
    ['South America', 270.732, 600, 0.933537, 'detail', [1224.539, 1223.252, 388.864, 642.717], [0, 0, 270.732, 600]],
    ['Sub-Saharan Africa', 600, 442.424, 0.828598, 'detail', [1911.223, 1181.705, 724.114, 650.821], [0, 0, 600, 442.424]]
  ]
  const r4 = (r: Rect) => [r.x, r.y, r.w, r.h]

  it("every theatre's window, plate, zoom and cut are the game's own, to the thousandth of a pixel", () => {
    expect(data.theatres.map((t) => t.name)).toEqual(GAME.map((g) => g[0]))
    for (const [name, w, h, zoom, from, region, rect] of GAME) {
      const l = layoutTheatre(data.theatres.find((t) => t.name === name)!)
      const plate = plateOf(l, pics)
      expect(l.w, name).toBeCloseTo(w, 3)
      expect(l.h, name).toBeCloseTo(h, 3)
      expect(plate.zoom!, name).toBeCloseTo(zoom, 5)
      expect(plate.cut!.from === 'detail' ? 'detail' : 'inset', name).toBe(from)
      r4(plate.cut!.region).forEach((v, k) => expect(v, `${name} region[${k}]`).toBeCloseTo(region[k], 2))
      r4(plate.cut!.at).forEach((v, k) => expect(v, `${name} at[${k}]`).toBeCloseTo(rect[k], 2))
    }
  })

  it('without the inset the small European theatres go to the sheet (5.1-8.8 times the detail map)', () => {
    for (const name of EUROPE) {
      const plate = plateOf(layoutTheatre(data.theatres.find((t) => t.name === name)!), { ...pics, insets: [] })
      expect(plate.kind, name).toBe('sheet')
      expect(plate.zoom!, name).toBeGreaterThan(5)
    }
  })

  it('every entry is kept inside the window, where it fits', () => {
    for (const t of data.theatres) {
      const layout = layoutTheatre(t)
      const room = roomOf(layout)
      const parts = t.systems.map((s, i) => entryParts(layout.places[i], sampleEntry(t, i, data), { w: s.name.length * 8, h: 20 }, data.loyaltyOrder))
      const moves = separateEntries(parts.map(entryRects), room)
      parts.forEach((p, i) => {
        const b = box(entryRects(p))
        const x = b.x + moves[i].x
        const y = b.y + moves[i].y
        if (b.w <= room.w) expect(x >= room.x && x + b.w <= room.x + room.w, `${t.name}: ${t.systems[i].name}`).toBe(true)
        if (b.h <= room.h) expect(y >= room.y && y + b.h <= room.y + room.h, `${t.name}: ${t.systems[i].name}`).toBe(true)
      })
    }
  })
})

const box = (rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x))
  const y = Math.min(...rs.map((r) => r.y))
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y }
}
const overlap = (a: Rect, b: Rect) => !(a.x >= b.x + b.w || a.x + a.w <= b.x || a.y >= b.y + b.h || a.y + a.h <= b.y)

describe('no entry over another (SeparateEntries)', () => {
  it('two entries that cross are pushed apart the shorter way, half each, in whole pixels', () => {
    const room = { x: 4, y: 4, w: 592, h: 592 }
    const a = [{ x: 100, y: 100, w: 100, h: 40 }]
    const b = [{ x: 180, y: 110, w: 100, h: 40 }]
    const moves = separateEntries([a, b], room)
    expect(moves.every((m) => Number.isInteger(m.x) && Number.isInteger(m.y))).toBe(true)
    const [ma, mb] = moves
    expect(overlap({ ...a[0], x: a[0].x + ma.x, y: a[0].y + ma.y }, { ...b[0], x: b[0].x + mb.x, y: b[0].y + mb.y })).toBe(false)
    // 22 px across (with the 2 px gap) against 32 down: apart across, 11.5 each.
    expect([ma.y, mb.y]).toEqual([0, 0])
    expect(ma.x).toBe(-12)
    expect(mb.x).toBe(12)
  })
})

const theatre = (points: [number, number][]): Theatre => ({ id: 't', name: 'T', systems: points.map(([x, y], i) => ({ id: `s${i}`, name: `S${i}`, x, y, holder: null })) })

describe("the window's layout (Populate)", () => {
  it('the long side is 600; systems spread inside 60 px of padding, 92 below', () => {
    const l = layoutTheatre(theatre([[0, 0], [200, 100]]))
    expect([l.w, l.h]).toEqual([600, 300])
    expect(l.places).toEqual([{ x: 60, y: 60 }, { x: 540, y: 208 }])
  })
  it('a flat theatre gets the floor: never less than the padding plus 40', () => {
    const l = layoutTheatre(theatre([[0, 0], [300, 5]]))
    expect([l.w, l.h]).toEqual([600, 192])
  })
  it('one system: a square window, the system in the padding corner', () => {
    const l = layoutTheatre(theatre([[50, 50]]))
    expect([l.w, l.h, l.places[0].x, l.places[0].y]).toEqual([600, 600, 60, 60])
  })
})

describe('the plate', () => {
  const l = layoutTheatre(theatre([[100, 100], [140, 130]]))
  it('no picture at all: the sheet', () => {
    expect(plateOf(l, { detail: null, map: null, mapRect: null, insets: [] })).toEqual({ kind: 'sheet', cut: null, zoom: null })
  })
  it('the map picture when there is no detail copy, placed by map_image_rect', () => {
    const p = plateOf(l, { detail: null, map: { width: 4000, height: 2000 }, mapRect: { x: 0, y: 0, w: 1000, h: 500 }, insets: [] })
    expect(p.kind).toBe('map')
    expect(p.cut!.from).toBe('map')
    // 40 map units over 480 window pixels, 4 picture pixels a unit: 3 window pixels a picture pixel.
    expect(p.zoom).toBeCloseTo(3, 5)
  })
  it('too soft (above 4 times): the sheet, with the zoom it would have needed', () => {
    const p = plateOf(l, { detail: null, map: { width: 2000, height: 1000 }, mapRect: { x: 0, y: 0, w: 1000, h: 500 }, insets: [] })
    expect(p.kind).toBe('sheet')
    expect(p.zoom).toBeCloseTo(6, 5)
  })
  it('an inset wins only where it holds the whole theatre and is sharper', () => {
    const base = { detail: { width: 4000, height: 2000 }, map: null, mapRect: { x: 0, y: 0, w: 1000, h: 500 } }
    const holds = { picture: { width: 3000, height: 3000 }, at: { x: 0, y: 0, w: 300, h: 300 } }
    const short = { picture: { width: 3000, height: 3000 }, at: { x: 100, y: 100, w: 300, h: 300 } }
    expect(plateOf(l, { ...base, insets: [short, holds] }).cut!.from).toBe(1)
    expect(plateOf(l, { ...base, insets: [short] }).cut!.from).toBe('detail')
  })
})

describe('OnPaper', () => {
  it('a light side colour is darkened until it reads at 4.5:1 on the paper; a dark one is kept', () => {
    const paper = '#e8dcc0'
    const out = onPaper('#9fc5ff', paper)
    expect(contrast(out, paper)!).toBeGreaterThanOrEqual(4.45)
    expect(onPaper('#1a1a1a', paper)).toBe('#1a1a1a')
  })
})
