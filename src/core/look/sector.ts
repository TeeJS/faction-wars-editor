// THE SECTOR WINDOW AS A THEATRE PLATE (the game's WWII look, phase 8:
// TeeJS/faction-wars main 4ad04bf, src/ui/look_sector.gd and
// src/ui/sector_window.gd). What the Look page's Sector window mock-up needs,
// ported from the game's own code wherever the game decides something:
//   - the theatres: map.json's sectors in file order, each with its systems
//     in file order (the Huge galaxy: every one), and who holds each at the
//     start (factions.json starting_planets);
//   - the window's layout (Populate): its size from the theatre's spread,
//     each system's place, and the parts of its entry (disc, GID star, corner
//     icons, bars, name), then SeparateEntries, which keeps entries apart;
//   - the plate (PlateCut, _cut, MapRect): the theatre cut from the sharpest
//     picture that holds it - an inset, else map_detail, else the map - and
//     the plotting sheet where none is sharp enough;
//   - a held system's name colour (OnPaper).
// Every number is read out of the game's lines (theme.ts SECTOR).

import { contrastRgb, parseHex } from './contrast'
import { ci, dataKeys, gdStr, isDict } from './godot'
import { sectorNumber as n } from './theme'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface System {
  id: string
  name: string
  /** map.json `map` x and y: map units (map_image_rect's space). */
  x: number
  y: number
  /** The side that holds it at the start, or null. */
  holder: string | null
}

export interface Theatre {
  id: string
  name: string
  systems: System[]
}

export interface SectorData {
  theatres: Theatre[]
  /** The side the mock-up looks from: the first playable side, as the game's own tests play. */
  viewer: string | null
  /** The system that carries the viewer's hidden headquarters (brass ring), or null. */
  hiddenHq: string | null
  /** pack.json neutral.color: an unheld system's colour (Planet.GetFactionColor). */
  neutral: string
  /** pack.json map_image_rect, when it gives one with a size. */
  mapRect: Rect | null
  /** display.json icons: glyph -> the pack's own picture for it. */
  icons: Record<string, string>
  /** display.json loyalty_bar, else factions.json order: the loyalty bar's sides, left to right. */
  loyaltyOrder: string[]
  /** factions.json colours: the plate keeps them, as the strategic map does. */
  colors: Record<string, string>
}

/** JsonUtil.int_or: the value as a whole number (Godot's int() truncates), else 0. */
function intOr(d: unknown, key: string): number {
  const v = ci(d, key)
  if (typeof v === 'number') return Math.trunc(v)
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Math.trunc(Number(v))
  return 0
}

const text = (v: unknown): string => (v === undefined || v === null ? '' : gdStr(v))
const list = (d: unknown, key: string): unknown[] => {
  const v = ci(d, key)
  return Array.isArray(v) ? v : []
}

/** The sector window's data from the pack's own files (parsed values; undefined when a file is missing). */
export function readSector(files: { pack: unknown; map: unknown; factions: unknown; display: unknown }): SectorData {
  const factions = list(files.factions, 'factions')
  const holders = new Map<string, string>()
  const colors: Record<string, string> = {}
  for (const f of factions) {
    const id = text(ci(f, 'id'))
    colors[id] = text(ci(f, 'color'))
    for (const s of list(f, 'starting_planets')) {
      const p = text(ci(s, 'planet'))
      if (p && !holders.has(p)) holders.set(p, id)
    }
  }
  const viewerRow = factions[0]
  const viewer = viewerRow === undefined ? null : text(ci(viewerRow, 'id'))
  const hq = ci(viewerRow, 'hq')
  const hiddenHq = text(ci(hq, 'kind')) === 'hidden' ? text(ci(hq, 'placement')) || null : null

  const bySector = new Map<string, System[]>()
  for (const p of list(files.map, 'planets')) {
    const sector = text(ci(p, 'sector'))
    const m = ci(p, 'map')
    const id = text(ci(p, 'id'))
    const sys: System = { id, name: text(ci(p, 'display_name')), x: isDict(m) ? intOr(m, 'x') : 0, y: isDict(m) ? intOr(m, 'y') : 0, holder: holders.get(id) ?? null }
    if (!bySector.has(sector)) bySector.set(sector, [])
    bySector.get(sector)!.push(sys)
  }
  const theatres: Theatre[] = []
  for (const s of list(files.map, 'sectors')) {
    const id = text(ci(s, 'id'))
    const systems = bySector.get(id) ?? []
    if (systems.length) theatres.push({ id, name: text(ci(s, 'display_name')) || id, systems })
  }

  const r = ci(files.pack, 'map_image_rect')
  const rect = Array.isArray(r) && r.length === 4 ? r.map((v) => Number(v)) : null
  const icons: Record<string, string> = {}
  const ic = ci(files.display, 'icons')
  if (isDict(ic)) for (const k of dataKeys(ic)) icons[k] = text(ic[k])
  const bar = list(files.display, 'loyalty_bar').map(text)
  return {
    theatres,
    viewer,
    hiddenHq,
    neutral: text(ci(ci(files.pack, 'neutral'), 'color')),
    mapRect: rect && rect[2] > 0 && rect[3] > 0 ? { x: rect[0], y: rect[1], w: rect[2], h: rect[3] } : null,
    icons,
    loyaltyOrder: bar.length ? bar : Object.keys(colors),
    colors
  }
}

// ---------------------------------------------------------------------------
// The layout (sector_window.gd Populate)
// ---------------------------------------------------------------------------

export interface Layout {
  /** The sector map's size (mapSize). */
  w: number
  h: number
  padding: number
  paddingBottom: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  /** Each system's centre in the window, in the theatre's order. */
  places: { x: number; y: number }[]
}

export function layoutTheatre(t: Theatre): Layout {
  const xs = t.systems.map((s) => s.x)
  const ys = t.systems.map((s) => s.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  let sectorWidth = maxX - minX
  let sectorHeight = maxY - minY
  if (sectorWidth === 0) sectorWidth = 1
  if (sectorHeight === 0) sectorHeight = 1
  const maxDimension = n('MAX_DIMENSION')
  const aspectRatio = sectorWidth / sectorHeight
  let w = aspectRatio >= 1 ? maxDimension : maxDimension * aspectRatio
  let h = aspectRatio >= 1 ? maxDimension / aspectRatio : maxDimension
  const padding = n('PADDING')
  const paddingBottom = n('PADDING_BOTTOM')
  w = Math.max(w, padding * 2 + n('MIN_PLACING'))
  h = Math.max(h, padding + paddingBottom + n('MIN_PLACING'))
  const usableWidth = w - padding * 2
  const usableHeight = h - padding - paddingBottom
  const places = t.systems.map((s) => ({
    x: padding + ((s.x - minX) / sectorWidth) * usableWidth,
    y: padding + ((s.y - minY) / sectorHeight) * usableHeight
  }))
  return { w, h, padding, paddingBottom, minX, maxX, minY, maxY, places }
}

// ---------------------------------------------------------------------------
// The plate (look_sector.gd PlateCut, _cut, MapRect)
// ---------------------------------------------------------------------------

export interface Picture {
  width: number
  height: number
}

export interface PlatePictures {
  /** look.json textures.map_detail, when it loads. */
  detail: Picture | null
  /** pack.json map_image, when it loads. */
  map: Picture | null
  mapRect: Rect | null
  /** look.json map_insets whose picture loads and whose `at` has four numbers (Look.MapInsets). */
  insets: { picture: Picture; at: Rect }[]
}

export interface Cut {
  /** The picture it is cut from: the detail copy, the map, or an inset (its index in `insets`). */
  from: 'detail' | 'map' | number
  /** The part of the picture, in its pixels. */
  region: Rect
  /** Where that part lands in the window. */
  at: Rect
  /** Window pixels per picture pixel. */
  zoom: number
}

export interface Plate {
  kind: 'map' | 'sheet'
  cut: Cut | null
  /** The chosen picture's magnification (the window's `look_zoom`); null without a picture. */
  zoom: number | null
}

const encloses = (a: Rect, b: Rect) => b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h

/** Rect2.intersection: the overlap, or an empty rect when they do not overlap. */
function intersection(a: Rect, b: Rect): Rect {
  if (a.x >= b.x + b.w || a.x + a.w <= b.x || a.y >= b.y + b.h || a.y + a.h <= b.y) return { x: 0, y: 0, w: 0, h: 0 }
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y }
}

/** One picture's cut (_cut): `tex` covers `rect` in map units; `cover` is the window's area in map units. */
function cutOf(from: Cut['from'], tex: Picture, rect: Rect, cover: Rect, layout: Layout, sx: number, sy: number): { cut: Cut | null; zoom: number } {
  const kx = tex.width / rect.w
  const ky = tex.height / rect.h
  const zoom = Math.max(1 / (sx * kx), 1 / (sy * ky))
  const full = { x: (cover.x - rect.x) * kx, y: (cover.y - rect.y) * ky, w: cover.w * kx, h: cover.h * ky }
  const px = intersection(full, { x: 0, y: 0, w: tex.width, h: tex.height })
  if (px.w < 2 || px.h < 2) return { cut: null, zoom }
  const scaleX = layout.w / full.w
  const scaleY = layout.h / full.h
  return {
    cut: { from, region: px, at: { x: (px.x - full.x) * scaleX, y: (px.y - full.y) * scaleY, w: px.w * scaleX, h: px.h * scaleY }, zoom },
    zoom
  }
}

/** The plate under a theatre: the sharpest picture that holds it, when it stays sharp enough; else the sheet. */
export function plateOf(layout: Layout, pics: PlatePictures): Plate {
  const tex = pics.detail ?? pics.map
  if (!tex || !tex.width || !tex.height) return { kind: 'sheet', cut: null, zoom: null }
  const from = pics.detail ? 'detail' : 'map'
  // MapRect: map_image_rect, else the picture's own pixels.
  const rect = pics.mapRect ?? { x: 0, y: 0, w: tex.width, h: tex.height }
  const span = { x: Math.max(layout.maxX - layout.minX, 1), y: Math.max(layout.maxY - layout.minY, 1) }
  const usable = { x: Math.max(layout.w - layout.padding * 2, 1), y: Math.max(layout.h - layout.padding - layout.paddingBottom, 1) }
  let sx = span.x / usable.x
  let sy = span.y / usable.y
  if (layout.maxX - layout.minX < 1) sx = sy
  if (layout.maxY - layout.minY < 1) sy = sx
  const cover = { x: layout.minX - layout.padding * sx, y: layout.minY - layout.padding * sy, w: layout.w * sx, h: layout.h * sy }
  let best = cutOf(from, tex, rect, cover, layout, sx, sy)
  pics.insets.forEach((inset, i) => {
    if (!inset.picture.width || !inset.picture.height || !encloses(inset.at, cover)) return
    const c = cutOf(i, inset.picture, inset.at, cover, layout, sx, sy)
    if (c.zoom < best.zoom) best = c
  })
  const on = best.cut !== null && best.zoom <= n('SHARP_ZOOM')
  return { kind: on ? 'map' : 'sheet', cut: on ? best.cut : null, zoom: best.zoom }
}

// ---------------------------------------------------------------------------
// A system's entry (Populate, AddGidStar, _PlaceCorner, AddResourceBars)
// ---------------------------------------------------------------------------

export type Glyph = 'manufacturing' | 'fleet' | 'defenses' | 'mission' | 'uprising'

/** What the mock-up shows at a system: the game state it has none of. */
export interface EntryState {
  /** The four corners: top left, top right, bottom left, bottom right; null for none. */
  corners: [Glyph | null, Glyph | null, Glyph | null, Glyph | null]
  energy: { total: number; used: number } | null
  materials: { total: number; built: number } | null
  /** Side -> percent of the population. */
  support: Record<string, number> | null
  /** The GID tier's flare size (gid.gd FlareBig/Mid/Low); 0 for no star. */
  flare: number
}

export interface Parts {
  disc: Rect
  star: { rect: Rect; size: number } | null
  corners: { glyph: Glyph; slot: number; rect: Rect }[]
  rows: { kind: 'energy' | 'materials'; rect: Rect; total: number; filled: number }[]
  loyalty: { rect: Rect; segs: { side: string; x: number; w: number; first: boolean; last: boolean }[] } | null
  name: Rect
}

const rowWidth = (total: number) => Math.max(0, total * n('SQUARE') + (total - 1) * n('SQUARE_GAP'))

/** Every part of one system's entry, where Populate puts it. `nameSize` is the name's own size in the window's face. */
export function entryParts(place: { x: number; y: number }, state: EntryState, nameSize: { w: number; h: number }, loyaltyOrder: string[]): Parts {
  const { x, y } = place
  const disc = n('DISC')
  const parts: Parts = { disc: { x: x - disc / 2, y: y - disc / 2, w: disc, h: disc }, star: null, corners: [], rows: [], loyalty: null, name: { x: 0, y: 0, w: 0, h: 0 } }

  if (state.flare > 0) {
    const scaled = Math.max(n('FLARE_MIN'), Math.round(state.flare * n('FLARE_SCALE')))
    parts.star = { rect: { x: x - n('STAR_X') - scaled, y: y + n('STAR_Y') - scaled, w: scaled * 2, h: scaled * 2 }, size: scaled }
  }

  // Our own 16 px glyphs, anchored by their inner corner (_PlaceCorner).
  const icon = n('CORNER')
  state.corners.forEach((glyph, slot) => {
    if (!glyph) return
    const left = slot === 0 || slot === 2
    const top = slot === 0 || slot === 1
    const ax = left ? x - n('GLYPH_INNER_X') : x + n('GLYPH_INNER_X')
    const ay = top ? y - n('GLYPH_INNER_Y') : y + n('GLYPH_INNER_Y')
    parts.corners.push({ glyph, slot, rect: { x: left ? ax - icon : ax, y: top ? ay - icon : ay, w: icon, h: icon } })
  })

  const barsTop = y + n('BARS_TOP')
  let rowY = barsTop
  let widest = n('BAR_MIN_WIDTH')
  const square = n('SQUARE')
  const addRow = (kind: 'energy' | 'materials', total: number, filled: number) => {
    parts.rows.push({ kind, rect: { x: x - n('BARS_LEFT'), y: rowY, w: Math.max(rowWidth(total), 1), h: square }, total, filled })
    rowY += square + n('ROW_GAP')
    widest = Math.max(widest, rowWidth(total))
  }
  if (state.energy) addRow('energy', state.energy.total, state.energy.used)
  if (state.materials) addRow('materials', state.materials.total, state.materials.built)
  if (state.support) {
    const height = n('LOYALTY_HEIGHT')
    const drawn = loyaltyOrder.filter((s) => (state.support![s] ?? 0) > 0)
    const segs: NonNullable<Parts['loyalty']>['segs'] = []
    let sx = 0
    for (const side of loyaltyOrder) {
      const w = (widest * (state.support[side] ?? 0)) / 100
      if (w <= 0) continue
      segs.push({ side, x: sx, w, first: segs.length === 0, last: segs.length === drawn.length - 1 })
      sx += w
    }
    parts.loyalty = { rect: { x: x - n('BARS_LEFT'), y: rowY, w: widest, h: height }, segs }
    rowY += height + n('ROW_GAP')
  }
  // Explored: the name under the bars (nameY = barsTop + their height).
  const [boxW, boxH] = [n('NAME_BOX', 0), n('NAME_BOX', 1)]
  parts.name = { x: x - boxW / 2, y: rowY, w: Math.max(boxW, nameSize.w), h: Math.max(boxH, nameSize.h) }
  return parts
}

export function entryRects(p: Parts): Rect[] {
  return [p.disc, ...(p.star ? [p.star.rect] : []), ...p.corners.map((c) => c.rect), ...p.rows.map((r) => r.rect), ...(p.loyalty ? [p.loyalty.rect] : []), p.name]
}

// ---------------------------------------------------------------------------
// No entry over another (sector_window.gd SeparateEntries, all_inside)
// ---------------------------------------------------------------------------

function merge(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 })
const crosses = (a: Rect, b: Rect) => !(a.x >= b.x + b.w || a.x + a.w <= b.x || a.y >= b.y + b.h || a.y + a.h <= b.y)
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
/** Godot rounds halves away from zero. */
const gdRound = (v: number) => Math.sign(v) * Math.round(Math.abs(v))

/** How far each entry moves (whole pixels) so none crosses another and all stay inside `room`. */
export function separateEntries(entries: Rect[][], room: Rect): { x: number; y: number }[] {
  const boxes = entries.map((rects) => rects.reduce(merge))
  const moves = boxes.map(() => ({ x: 0, y: 0 }))
  if (boxes.length < 1) return moves
  const shift = (i: number, by: { x: number; y: number }) => {
    const box = boxes[i]
    const to = {
      x: clamp(box.x + by.x, room.x, Math.max(room.x, room.x + room.w - box.w)),
      y: clamp(box.y + by.y, room.y, Math.max(room.y, room.y + room.h - box.h))
    }
    moves[i] = { x: moves[i].x + (to.x - box.x), y: moves[i].y + (to.y - box.y) }
    boxes[i] = { ...box, x: to.x, y: to.y }
  }
  for (let i = 0; i < boxes.length; i++) shift(i, { x: 0, y: 0 })
  const gap = n('ENTRY_GAP') / 2
  for (let pass = 0; pass < n('SEPARATE_PASSES'); pass++) {
    let moved = false
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = grow(boxes[i], gap)
        const b = grow(boxes[j], gap)
        if (!crosses(a, b)) continue
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        const push = { x: 0, y: 0 }
        if (ox < oy) push.x = (ox / 2 + 0.5) * (a.x + a.w / 2 <= b.x + b.w / 2 ? 1 : -1)
        else push.y = (oy / 2 + 0.5) * (a.y + a.h / 2 <= b.y + b.h / 2 ? 1 : -1)
        shift(i, { x: -push.x, y: -push.y })
        shift(j, push)
        moved = true
      }
    if (!moved) break
  }
  // Whole pixels that still keep each entry inside.
  return moves.map((m, i) => {
    const d = { x: gdRound(m.x), y: gdRound(m.y) }
    const box = boxes[i]
    const start = { x: box.x - m.x, y: box.y - m.y }
    const lo = { x: Math.ceil(room.x - start.x), y: Math.ceil(room.y - start.y) }
    const hi = { x: Math.floor(room.x + room.w - box.w - start.x), y: Math.floor(room.y + room.h - box.h - start.y) }
    if (lo.x <= hi.x) d.x = clamp(d.x, lo.x, hi.x)
    if (lo.y <= hi.y) d.y = clamp(d.y, lo.y, hi.y)
    return d
  })
}

/** The room the plain window keeps its entries in: EdgeGap inside its edge. */
export function roomOf(layout: Layout): Rect {
  const g = n('EDGE_GAP')
  return { x: g, y: g, w: layout.w - g * 2, h: layout.h - g * 2 }
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** OnPaper: a side's colour darkened step by step until it reads at 4.5:1 on the paper. */
export function onPaper(color: string, paper: string): string {
  const c = parseHex(color)
  const p = parseHex(paper)
  if (!c || !p) return color
  let out = c
  const [ratio, tries] = [n('ON_PAPER_TRIES', 0), n('ON_PAPER_TRIES', 1)]
  const step = n('ON_PAPER_STEP')
  for (let guard = 0; contrastRgb(out, p) < ratio && guard < tries; guard++) out = out.map((v) => v * (1 - step)) as [number, number, number]
  const h = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
  return `#${h(out[0])}${h(out[1])}${h(out[2])}`
}

// ---------------------------------------------------------------------------
// The mock-up's sample state
// ---------------------------------------------------------------------------

/**
 * A fixed sample for system `i` of a theatre (the mock-up has no game): a held
 * system has its factories and defences, every other one a fleet in orbit, the
 * second a mission of ours running, the last (in a theatre of two or more) in
 * uprising; bars from a small table; the star for a held one.
 */
export function sampleEntry(t: Theatre, i: number, data: SectorData): EntryState {
  const s = t.systems[i]
  const held = s.holder !== null
  const last = t.systems.length > 1 && i === t.systems.length - 1
  const energy = 4 + ((i * 3) % 5)
  const materials = 3 + ((i * 2) % 4)
  const sides = data.loyaltyOrder
  const support: Record<string, number> = {}
  if (held) {
    support[s.holder!] = 70
    const other = sides.find((x) => x !== s.holder)
    if (other) support[other] = 30
    else support[s.holder!] = 100
  } else {
    const two = sides.slice(0, 2)
    for (const x of two) support[x] = 100 / two.length
  }
  return {
    corners: [held ? 'manufacturing' : null, i % 2 === 0 ? 'fleet' : null, held ? 'defenses' : null, last ? 'uprising' : i === 1 ? 'mission' : null],
    energy: { total: energy, used: held ? Math.min(energy, 2 + (i % 3)) : 0 },
    materials: { total: materials, built: held ? 1 + (i % 2) : 0 },
    support,
    flare: held ? n('FLARE_LOW') : 0
  }
}
