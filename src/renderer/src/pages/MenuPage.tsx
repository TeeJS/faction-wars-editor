// The Cockpit menu: the pack's own picture with a clickable region per menu
// function. Drag a region to move it, drag its corner to resize. A region with
// screen corners (quad) shows them as an outline; select it to drag each corner.

import { useRef, useState, type ReactNode } from 'react'
import type { JSONPath } from '../../../core/jsontext'
import { ci, isDict } from '../../../core/model'
import { KNOWN_DIFFICULTIES } from '../../../core/vocab'
import { FieldGroup } from '../forms/fields'
import { menuFields } from '../forms/pages'
import type { Ctx, Dict } from '../forms/types'
import { useStore } from '../store'
import { useImage } from '../ui/useImage'

interface Drag {
  index: number // -1 = readout
  mode: 'move' | 'resize'
  sx: number
  sy: number
  rect: number[]
  now: number[]
}

/** Dragging one of a region's four screen corners. */
interface CornerDrag {
  index: number
  corner: number
  sx: number
  sy: number
  quad: number[][]
  now: number[][]
}

export function MenuPage(): ReactNode {
  const s = useStore()
  const doc = s.doc!
  const pack = s.pack!
  const c: Ctx = { doc, pack }
  const menuRec = doc.get('pack.json', ['menu'])
  const menu = pack.manifest.menu
  const { image } = useImage(menu?.image, doc.version)
  const svg = useRef<SVGSVGElement | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [cdrag, setCdrag] = useState<CornerDrag | null>(null)
  const [sel, setSel] = useState<number | null>(null)

  if (!isDict(menuRec) || !menu) {
    return (
      <div className="page-pad">
        <h2>Cockpit menu</h2>
        <p>
          This pack uses the engine's labelled-button menu. A Cockpit menu replaces it with the pack's own picture, with a clickable region for every
          menu function: each difficulty, each galaxy size, each faction's start, load game, credits, HQ-only victory, multiplayer and exit.
        </p>
        <button
          className="primary"
          onClick={() =>
            doc.edit('Add Cockpit menu', (e) =>
              e.set('pack.json', ['menu'], {
                image: '',
                selected_color: '#ffd23c',
                readout: { rect: [10, 10, 200, 20], standard: 'Standard Game', hq_only: 'Headquarters Only Victory', color: '#40ff40' },
                regions: requiredRegions(c, []),
                credits: []
              })
            )
          }
        >
          Add a Cockpit menu
        </button>
      </div>
    )
  }

  const toPic = (e: { clientX: number; clientY: number }) => {
    const el = svg.current!
    const pt = el.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(el.getScreenCTM()!.inverse())
    return { x: p.x, y: p.y }
  }
  const W = image?.width ?? 640
  const H = image?.height ?? 480
  const rectOf = (i: number): number[] => (drag && drag.index === i ? drag.now : i === -1 ? menu.readout?.rect ?? [] : menu.regions[i]?.rect ?? [])
  const pathOf = (i: number): JSONPath => (i === -1 ? ['menu', 'readout', 'rect'] : ['menu', 'regions', i, 'rect'])
  /** A region's corners as drawn now: mid-drag, moved with its rect, or as saved. */
  const quadOf = (i: number): number[][] | null => {
    if (cdrag && cdrag.index === i) return cdrag.now
    const q = i >= 0 ? menu.regions[i]?.quad ?? null : null
    if (q && drag && drag.index === i && drag.mode === 'move') {
      const dx = drag.now[0] - drag.rect[0]
      const dy = drag.now[1] - drag.rect[1]
      return q.map(([x, y]) => [x + dx, y + dy])
    }
    return q
  }

  const down = (e: React.PointerEvent, index: number, mode: Drag['mode']) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toPic(e)
    const rect = [...rectOf(index)]
    setSel(index)
    setDrag({ index, mode, sx: p.x, sy: p.y, rect, now: rect })
  }
  const downCorner = (e: React.PointerEvent, index: number, corner: number) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toPic(e)
    const quad = (quadOf(index) ?? []).map((pt) => [...pt])
    setCdrag({ index, corner, sx: p.x, sy: p.y, quad, now: quad })
  }
  const move = (e: React.PointerEvent) => {
    if (cdrag) {
      const p = toPic(e)
      const dx = Math.round(p.x - cdrag.sx)
      const dy = Math.round(p.y - cdrag.sy)
      setCdrag({ ...cdrag, now: cdrag.quad.map(([x, y], k) => (k === cdrag.corner ? [x + dx, y + dy] : [x, y])) })
      return
    }
    if (!drag) return
    const p = toPic(e)
    const dx = Math.round(p.x - drag.sx)
    const dy = Math.round(p.y - drag.sy)
    const [x, y, w, h] = drag.rect
    setDrag({ ...drag, now: drag.mode === 'move' ? [x + dx, y + dy, w, h] : [x, y, Math.max(1, w + dx), Math.max(1, h + dy)] })
  }
  const up = () => {
    if (cdrag) {
      const d = cdrag
      setCdrag(null)
      if (d.now.every((pt, k) => pt[0] === d.quad[k][0] && pt[1] === d.quad[k][1])) return
      doc.edit('Move screen corner', (e) => e.set('pack.json', ['menu', 'regions', d.index, 'quad'], d.now))
      return
    }
    if (!drag) return
    const d = drag
    setDrag(null)
    if (d.now.every((v, i) => v === d.rect[i])) return
    // Moving a region moves its screen corners with it; resizing leaves them.
    const quad = d.mode === 'move' ? quadOf(d.index) : null
    doc.edit('Move menu region', (e) => {
      e.set('pack.json', pathOf(d.index), d.now.map(Math.round))
      if (quad) e.set('pack.json', ['menu', 'regions', d.index, 'quad'], quad)
    })
  }

  const missing = requiredRegions(c, menu.regions.map((r) => ({ action: r.action, value: r.value })))
  const label = (i: number) => {
    const r = menu.regions[i]
    return r.value ? `${r.action}:${r.value}` : r.action
  }

  return (
    <div className="menu-page">
      <div className="menu-canvas-wrap">
        {!image && <div className="banner">The Cockpit picture '{menu.image || '(none)'}' was not found; regions are drawn on a blank 640×480.</div>}
        <svg ref={svg} className="menu-canvas" viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={up} role="application" aria-label="Cockpit menu regions">
          {image ? <image href={image.url} x={0} y={0} width={W} height={H} /> : <rect x={0} y={0} width={W} height={H} className="blank" />}
          {[-1, ...menu.regions.map((_, i) => i)].map((i) => {
            const r = rectOf(i)
            if (r.length !== 4) return null
            return (
              <g key={i} className={`region ${i === -1 ? 'readout' : ''} ${sel === i ? 'on' : ''}`}>
                <rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} onPointerDown={(e) => down(e, i, 'move')}>
                  <title>{i === -1 ? 'victory readout' : label(i)}</title>
                </rect>
                <text x={r[0] + 2} y={r[1] + 10} fontSize={9}>
                  {i === -1 ? 'readout' : label(i)}
                </text>
                <rect className="handle" x={r[0] + r[2] - 4} y={r[1] + r[3] - 4} width={8} height={8} onPointerDown={(e) => down(e, i, 'resize')} />
              </g>
            )
          })}
          {menu.regions.map((_, i) => {
            const q = quadOf(i)
            if (!q) return null
            return (
              <g key={`q${i}`} className={`quad-outline ${sel === i ? 'on' : ''}`}>
                <polygon points={q.map((pt) => pt.join(',')).join(' ')}>
                  <title>{`${label(i)} screen corners`}</title>
                </polygon>
                {sel === i &&
                  q.map((pt, k) => (
                    <circle key={k} className="corner" cx={pt[0]} cy={pt[1]} r={4} onPointerDown={(e) => downCorner(e, i, k)}>
                      <title>{['top-left', 'top-right', 'bottom-right', 'bottom-left'][k]}</title>
                    </circle>
                  ))}
              </g>
            )
          })}
        </svg>
        {missing.length > 0 && (
          <div className="banner">
            No region yet for: {missing.map((m) => (m.value ? `${m.action}:${m.value}` : m.action)).join(', ')}.{' '}
            <button
              className="link"
              onClick={() =>
                doc.edit('Add missing regions', (e) => {
                  missing.forEach((m, k) => e.insert('pack.json', ['menu', 'regions'], menu.regions.length + k, m))
                })
              }
            >
              Add them
            </button>
          </div>
        )}
      </div>
      <div className="menu-form">
        <FieldGroup c={c} file="pack.json" path={['menu']} rec={menuRec as Dict} fields={menuFields} />
        <div className="row-actions">
          <button className="danger" onClick={() => doc.edit('Remove Cockpit menu', (e) => e.remove('pack.json', ['menu']))}>
            Remove the Cockpit menu (use the button menu)
          </button>
        </div>
      </div>
    </div>
  )
}

/** The regions rule 11 requires that `have` lacks, with a default layout. */
function requiredRegions(c: Ctx, have: { action: string; value?: string }[]): Dict[] {
  const want: { action: string; value?: string }[] = [
    ...KNOWN_DIFFICULTIES.map((d) => ({ action: 'difficulty', value: d })),
    ...(c.pack.manifest.setup?.galaxySizes ?? []).map((g) => ({ action: 'galaxy_size', value: g })),
    ...c.pack.factions.map((f) => ({ action: 'start', value: f.id })),
    { action: 'load_game' },
    { action: 'credits' },
    { action: 'hq_only_victory' },
    { action: 'multiplayer' },
    { action: 'exit' }
  ]
  const missing = want.filter((w) => !have.some((h) => h.action === w.action && (w.value === undefined || h.value === w.value)))
  return missing.map((m, i) => ({
    action: m.action,
    ...(m.value !== undefined ? { value: m.value } : {}),
    rect: [20 + (i % 4) * 150, 40 + Math.floor(i / 4) * 40, 140, 30]
  }))
}

export function menuRegionCount(v: unknown): number {
  const r = ci(v, 'regions')
  return Array.isArray(r) ? r.length : 0
}
