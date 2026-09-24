// The galaxy map: the pack's picture at map_image_rect, sectors and planets on
// top. Drag a planet to move it; drag a sector label to move the sector and all
// its planets together. Coordinates are travel time, so the readout shows days.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ci, isDict } from '../../../core/model'
import { RULE_SPACE_TRAVEL_DISTANCE_DIV } from '../../../core/vocab'
import { FieldGroup } from '../forms/fields'
import { planetsPage, sectorsPage } from '../forms/pages'
import type { Ctx } from '../forms/types'
import { store, useStore } from '../store'
import { promptDialog } from '../ui/Modal'
import { useImage } from '../ui/useImage'

interface Drag {
  kind: 'planet' | 'sector' | 'pan'
  index: number
  startX: number
  startY: number
  dx: number
  dy: number
  moved: boolean
  view?: View
}
interface View {
  x: number
  y: number
  w: number
  h: number
}

function ruleValue(rules: unknown[], id: number, faction: string | undefined): number {
  const row = rules.find((r) => isDict(r) && Number(ci(r, 'EntryId')) === id)
  if (!isDict(row)) return 0
  const bf = ci(row, 'by_faction')
  const cell = faction ? ci(ci(bf, faction), 'medium') : undefined
  return typeof cell === 'number' ? cell : Number(ci(row, 'Development') ?? 0)
}

export function MapPage(): ReactNode {
  const s = useStore()
  const doc = s.doc!
  const pack = s.pack!
  const c: Ctx = { doc, pack }
  const m = pack.manifest
  const { image, missing } = useImage(m.mapImage, doc.version)
  const svg = useRef<SVGSVGElement | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [compare, setCompare] = useState<number | null>(null)
  const selPlanet = typeof s.selection.map === 'number' ? s.selection.map : null
  const selSector = typeof s.selection.mapSector === 'number' ? s.selection.mapSector : null

  // Map space: the picture's rect (or its own pixels), stretched to cover every world.
  const bounds = useMemo(() => {
    const r = m.mapImageRect && m.mapImageRect.some((v) => v !== 0) ? m.mapImageRect : image ? [0, 0, image.width, image.height] : null
    let minX = r ? r[0] : Infinity
    let minY = r ? r[1] : Infinity
    let maxX = r ? r[0] + r[2] : -Infinity
    let maxY = r ? r[1] + r[3] : -Infinity
    for (const p of [...pack.planets, ...pack.sectors]) {
      minX = Math.min(minX, p.mapX)
      minY = Math.min(minY, p.mapY)
      maxX = Math.max(maxX, p.mapX)
      maxY = Math.max(maxY, p.mapY)
    }
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 700, h: 420, rect: r }
    const pad = Math.max(maxX - minX, maxY - minY) * 0.04 + 10
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2, rect: r }
  }, [m.mapImageRect, image, pack.planets, pack.sectors])

  const [view, setView] = useState<View | null>(null)
  const v = view ?? bounds
  useEffect(() => setView(null), [doc])

  const unit = v.w / 900 // one screen-ish pixel in map units
  const toMap = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }

  // Owner at day zero, for the dot colour.
  const owner = new Map<string, string>()
  for (const f of pack.factions) {
    for (const sp of f.startingPlanets) owner.set(sp.planet, f.color)
    if (f.hq?.kind === 'fixed' && f.hq.planet) owner.set(f.hq.planet, f.color)
  }
  const neutral = m.neutral?.color || '#9a9a9a'

  const pos = (i: number, kind: 'planet' | 'sector') => {
    const p = kind === 'planet' ? pack.planets[i] : pack.sectors[i]
    let x = p.mapX
    let y = p.mapY
    if (drag && drag.moved) {
      if (drag.kind === kind && drag.index === i) {
        x += drag.dx
        y += drag.dy
      } else if (drag.kind === 'sector' && kind === 'planet' && pack.planets[i].sector === pack.sectors[drag.index].id) {
        x += drag.dx
        y += drag.dy
      }
    }
    return { x: Math.round(x), y: Math.round(y) }
  }

  const onDown = (e: React.PointerEvent, kind: Drag['kind'], index: number) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toMap(e)
    setDrag({ kind, index, startX: p.x, startY: p.y, dx: 0, dy: 0, moved: false, view: v })
  }
  const onMove = (e: React.PointerEvent) => {
    const p = toMap(e)
    setCursor({ x: Math.round(p.x), y: Math.round(p.y) })
    if (!drag) return
    if (drag.kind === 'pan') {
      const el = svg.current!.getBoundingClientRect()
      const sx = drag.view!.w / el.width
      const sy = drag.view!.h / el.height
      const dx = (e.clientX - drag.startX) * sx
      const dy = (e.clientY - drag.startY) * sy
      setView({ ...drag.view!, x: drag.view!.x - dx, y: drag.view!.y - dy })
      return
    }
    const dx = p.x - drag.startX
    const dy = p.y - drag.startY
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.hypot(dx, dy) > unit * 3 })
  }
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (d.kind === 'pan') return
    if (!d.moved) {
      if (d.kind === 'planet') {
        if (e.shiftKey && selPlanet !== null && selPlanet !== d.index) setCompare(d.index)
        else {
          setCompare(null)
          store.selection.mapSector = undefined
          store.select('map', d.index)
        }
      } else {
        store.selection.map = undefined
        store.select('mapSector', d.index)
      }
      return
    }
    const dx = Math.round(d.dx)
    const dy = Math.round(d.dy)
    if (dx === 0 && dy === 0) return
    if (d.kind === 'planet') {
      const p = pack.planets[d.index]
      doc.edit(`Move ${p.id}`, (ed) => {
        ed.set('map.json', ['planets', p.index, 'map', 'x'], p.mapX + dx)
        ed.set('map.json', ['planets', p.index, 'map', 'y'], p.mapY + dy)
      })
    } else {
      const sec = pack.sectors[d.index]
      doc.edit(`Move sector ${sec.id}`, (ed) => {
        ed.set('map.json', ['sectors', sec.index, 'map', 'x'], sec.mapX + dx)
        ed.set('map.json', ['sectors', sec.index, 'map', 'y'], sec.mapY + dy)
        for (const p of pack.planets)
          if (p.sector === sec.id) {
            ed.set('map.json', ['planets', p.index, 'map', 'x'], p.mapX + dx)
            ed.set('map.json', ['planets', p.index, 'map', 'y'], p.mapY + dy)
          }
      })
    }
  }
  const onWheel = (e: React.WheelEvent) => {
    const p = toMap(e)
    const f = e.deltaY > 0 ? 1.15 : 1 / 1.15
    setView({ x: p.x - (p.x - v.x) * f, y: p.y - (p.y - v.y) * f, w: v.w * f, h: v.h * f })
  }
  const addPlanetAt = async (e: React.MouseEvent) => {
    if ((e.target as Element).closest('.planet, .sector')) return
    const p = toMap(e)
    const nearest = [...pack.sectors].sort((a, b) => Math.hypot(a.mapX - p.x, a.mapY - p.y) - Math.hypot(b.mapX - p.x, b.mapY - p.y))[0]
    const taken = pack.planets.map((x) => x.id)
    const id = await promptDialog('New planet here', 'Planet id', 'new_planet', (t) =>
      !/^[a-z0-9]+(_[a-z0-9]+)*$/.test(t) ? 'lower_snake_case' : taken.includes(t) ? 'That id is taken.' : null
    )
    if (!id) return
    doc.edit(`Add planet ${id}`, (ed) =>
      ed.insert('map.json', ['planets'], pack.planets.length, {
        id,
        display_name: id.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        sector: nearest?.id ?? '',
        starts_inhabited: true,
        map: { x: Math.round(p.x), y: Math.round(p.y) }
      })
    )
    store.select('map', pack.planets.length)
  }

  // Travel readout between the selected planet and a shift-clicked one.
  let travel: ReactNode = null
  if (selPlanet !== null && compare !== null && pack.planets[selPlanet] && pack.planets[compare]) {
    const a = pack.planets[selPlanet]
    const b = pack.planets[compare]
    const dist = Math.floor(Math.hypot(b.mapX - a.mapX, b.mapY - a.mapY))
    const f0 = pack.factions[0]?.id
    const div = ruleValue(pack.rules, RULE_SPACE_TRAVEL_DISTANCE_DIV, f0)
    const speed = ruleValue(pack.rules, 1, f0) || 100
    const days = div > 0 ? Math.max(1, Math.floor((Math.floor(dist / div) * speed) / 100)) : 1
    travel = (
      <span>
        {a.displayName} → {b.displayName}: distance <b>{dist}</b>, about <b>{days}</b> day{days === 1 ? '' : 's'} at standard speed
        <small className="muted"> (rule 74 divisor {div}, rule 1 speed {speed}% for {f0}, medium)</small>
      </span>
    )
  }

  const planet = selPlanet !== null ? pack.planets[selPlanet] : null
  const sector = selSector !== null ? pack.sectors[selSector] : null
  const planetRec = planet ? doc.get('map.json', ['planets', planet.index]) : null
  const sectorRec = sector ? doc.get('map.json', ['sectors', sector.index]) : null
  const r = bounds.rect

  return (
    <div className="map-page">
      <div className="map-toolbar">
        <button onClick={() => setView(null)}>Fit</button>
        <button onClick={() => setView({ x: v.x + v.w * 0.1, y: v.y + v.h * 0.1, w: v.w * 0.8, h: v.h * 0.8 })}>Zoom in</button>
        <button onClick={() => setView({ x: v.x - v.w * 0.125, y: v.y - v.h * 0.125, w: v.w * 1.25, h: v.h * 1.25 })}>Zoom out</button>
        <label className="inline">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Labels
        </label>
        <span className="muted">
          Coordinates are travel time. Drag a planet or a sector label; shift-click a second planet for travel days; double-click empty space to add a planet.
        </span>
        <span className="spacer" />
        {cursor && <code className="muted">x {cursor.x}, y {cursor.y}</code>}
      </div>
      {missing && (
        <div className="banner">
          {m.mapImage
            ? `The map picture '${m.mapImage}' ${m.mapImage.includes(':') ? 'is in an art set that was not found (export it with the Faction Wars Exporter, or choose it on the Pack page)' : 'is not in the pack'}.`
            : 'No map picture yet - set one on the Pack page.'}
        </div>
      )}
      <div className="map-body">
        <svg
          ref={svg}
          className="map-canvas"
          viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(e) => {
            ;(e.target as Element).setPointerCapture?.(e.pointerId)
            setDrag({ kind: 'pan', index: -1, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false, view: v })
          }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => setCursor(null)}
          onWheel={onWheel}
          onDoubleClick={(e) => void addPlanetAt(e)}
          role="application"
          aria-label="Galaxy map"
        >
          {image && r && <image href={image.url} x={r[0]} y={r[1]} width={r[2]} height={r[3]} preserveAspectRatio="none" />}
          {r && <rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} className="map-frame" strokeWidth={unit} />}
          {pack.planets.map((p, i) => {
            const q = pos(i, 'planet')
            const on = i === selPlanet || i === compare || (sector && p.sector === sector.id)
            return (
              <g key={`p${i}`} className={`planet ${on ? 'on' : ''}`} onPointerDown={(e) => onDown(e, 'planet', i)}>
                <circle cx={q.x} cy={q.y} r={unit * (on ? 6 : 4)} fill={owner.get(p.id) ?? (p.startsInhabited ? neutral : 'transparent')} stroke={owner.get(p.id) ?? neutral} strokeWidth={unit * 1.5}>
                  <title>
                    {p.displayName} ({p.id}) · {p.sector} · x {q.x}, y {q.y}
                  </title>
                </circle>
                {showLabels && (
                  <text x={q.x + unit * 7} y={q.y + unit * 4} fontSize={unit * 11} className="planet-label">
                    {p.displayName || p.id}
                  </text>
                )}
              </g>
            )
          })}
          {compare !== null && selPlanet !== null && pack.planets[compare] && pack.planets[selPlanet] && (
            <line
              x1={pos(selPlanet, 'planet').x}
              y1={pos(selPlanet, 'planet').y}
              x2={pos(compare, 'planet').x}
              y2={pos(compare, 'planet').y}
              className="travel-line"
              strokeWidth={unit * 1.5}
            />
          )}
          {pack.sectors.map((sec, i) => {
            const q = pos(i, 'sector')
            return (
              <g key={`s${i}`} className={`sector ${i === selSector ? 'on' : ''}`} onPointerDown={(e) => onDown(e, 'sector', i)}>
                <rect x={q.x - unit * 3} y={q.y - unit * 3} width={unit * 6} height={unit * 6} strokeWidth={unit} />
                <text x={q.x} y={q.y - unit * 6} fontSize={unit * 13} textAnchor="middle" className="sector-label">
                  {sec.displayName || sec.id}
                </text>
              </g>
            )
          })}
        </svg>
        <aside className="map-side">
          {travel && <div className="card">{travel}</div>}
          {planet && isDict(planetRec) ? (
            <div className="card">
              <h3>{planet.displayName || planet.id}</h3>
              <FieldGroup c={c} file="map.json" path={['planets', planet.index]} rec={planetRec} fields={planetsPage.fields.filter((f) => !['source_id', 'string_id'].includes(f.key))} />
              <button className="link" onClick={() => store.go('planets', planet.index)}>
                Open on the Planets page
              </button>
            </div>
          ) : sector && isDict(sectorRec) ? (
            <div className="card">
              <h3>{sector.displayName || sector.id}</h3>
              <FieldGroup c={c} file="map.json" path={['sectors', sector.index]} rec={sectorRec} fields={sectorsPage.fields.filter((f) => !['source_id', 'string_id'].includes(f.key))} />
              <p className="muted">{pack.planets.filter((p) => p.sector === sector.id).length} planets</p>
            </div>
          ) : (
            <div className="card muted">
              Click a planet or a sector to edit it. {pack.planets.length} planets in {pack.sectors.length} sectors.
            </div>
          )}
          <div className="card legend">
            {pack.factions.map((f) => (
              <div key={f.id}>
                <span className="swatch" style={{ background: f.color }} /> {f.displayName || f.id} (day zero)
              </div>
            ))}
            <div>
              <span className="swatch" style={{ background: neutral }} /> neutral, inhabited
            </div>
            <div>
              <span className="swatch hollow" style={{ borderColor: neutral }} /> uninhabited
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
