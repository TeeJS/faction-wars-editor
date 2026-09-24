// The Cockpit menu: the pack's own picture with a clickable region per menu
// function. Drag a region to move it, drag its corner to resize.

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

  const down = (e: React.PointerEvent, index: number, mode: Drag['mode']) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    const p = toPic(e)
    const rect = [...rectOf(index)]
    setSel(index)
    setDrag({ index, mode, sx: p.x, sy: p.y, rect, now: rect })
  }
  const move = (e: React.PointerEvent) => {
    if (!drag) return
    const p = toPic(e)
    const dx = Math.round(p.x - drag.sx)
    const dy = Math.round(p.y - drag.sy)
    const [x, y, w, h] = drag.rect
    setDrag({ ...drag, now: drag.mode === 'move' ? [x + dx, y + dy, w, h] : [x, y, Math.max(1, w + dx), Math.max(1, h + dy)] })
  }
  const up = () => {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (d.now.every((v, i) => v === d.rect[i])) return
    doc.edit('Move menu region', (e) => e.set('pack.json', pathOf(d.index), d.now.map(Math.round)))
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
