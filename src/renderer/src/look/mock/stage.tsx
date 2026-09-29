// The window gallery: the list of the game's windows, the selected one drawn
// in the look, and what a clicked part is painted with. Hovering a colour in
// the colour column outlines every part it paints (the `highlight` prop).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EnvContext, type Env } from './kit'
import { WINDOWS, type Status, type WindowEntry } from './windows'
import { Chip } from '../colors'
import type { ColorToken } from '@core/look/vocab'

export interface Highlight {
  token?: ColorToken
  side?: string
}

export interface Picked {
  name: string
  tokens: ColorToken[]
  src: string[]
  fixed: string | null
  side: string | null
  tex: string | null
}

const STATUS_TITLE: Record<Status, string> = {
  now: 'Follow the look now',
  partly: 'Follow it in part',
  'not-yet': 'Not in the game yet',
  never: 'A look never reaches these'
}

export function WindowList({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const groups: Status[] = ['now', 'partly', 'not-yet', 'never']
  return (
    <nav className="window-list" aria-label="The game's windows">
      {groups.map((g) => {
        const list = WINDOWS.filter((w) => w.status === g)
        if (!list.length) return null
        return (
          <section key={g}>
            <h3>
              <span className={`dot ${g}`} aria-hidden="true" />
              {STATUS_TITLE[g]} <span className="muted">{list.length}</span>
            </h3>
            <ul>
              {list.map((w) => (
                <li key={w.id}>
                  <button type="button" className={`window-item${w.id === selected ? ' on' : ''}`} aria-current={w.id === selected} onClick={() => onSelect(w.id)}>
                    {w.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </nav>
  )
}

function readPart(el: HTMLElement): Picked {
  return {
    name: el.dataset.part ?? '',
    tokens: (el.dataset.tokens ?? '').split(' ').filter(Boolean) as ColorToken[],
    src: (el.dataset.src ?? '').split(' ').filter(Boolean),
    fixed: el.dataset.fixed ?? null,
    side: el.dataset.side ?? null,
    tex: el.dataset.tex ?? null
  }
}

export function Stage({ entry, env, highlight, revision, onPickToken, onPickSide }: {
  entry: WindowEntry
  env: Env
  highlight: Highlight | null
  revision: number
  onPickToken: (t: ColorToken) => void
  onPickSide: (id: string) => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [picked, setPicked] = useState<{ el: HTMLElement; info: Picked } | null>(null)

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => setPicked(null), [entry.id])

  // Outline the parts the hovered colour paints, and the clicked part.
  useLayoutEffect(() => {
    const root = canvas.current
    if (!root) return
    root.querySelectorAll('.hl, .picked').forEach((e) => e.classList.remove('hl', 'picked'))
    if (highlight?.token) root.querySelectorAll(`[data-tokens~="${highlight.token}"]`).forEach((e) => e.classList.add('hl'))
    if (highlight?.side) root.querySelectorAll(`[data-side="${CSS.escape(highlight.side)}"]`).forEach((e) => e.classList.add('hl'))
    if (picked && root.contains(picked.el)) picked.el.classList.add('picked')
  })

  const [w, h] = entry.size ?? [800, 500]
  const scale = Math.min(1, Math.max(0.2, (width - 2) / w))
  return (
    <div className="look-stage">
      <div className={`band ${entry.status}`}>
        <b>{entry.name}</b> <span className="band-status">{STATUS_TITLE[entry.status]}</span>
        {entry.note && <p>{entry.note}</p>}
        {entry.why && <p>{entry.why}</p>}
      </div>
      {entry.Mock ? (
        <div className="stage-frame" ref={frame}>
          <div style={{ width: w * scale, height: h * scale, position: 'relative', overflow: 'hidden' }}>
            <div
              ref={canvas}
              className="canvas"
              data-window={entry.id}
              data-revision={revision}
              style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}
              onClick={(e) => {
                const el = (e.target as HTMLElement).closest('[data-part]') as HTMLElement | null
                setPicked(el ? { el, info: readPart(el) } : null)
              }}
            >
              <EnvContext.Provider value={env}>
                <entry.Mock />
              </EnvContext.Provider>
            </div>
          </div>
          <p className="muted small stage-hint">
            Drawn at {Math.round(scale * 100)}% of the game's size. Click any part to see which colours paint it; hover a colour on the right to outline every part it paints.
          </p>
        </div>
      ) : (
        <div className="stage-frame never" ref={frame} />
      )}
      {picked && <Inspector info={picked.info} env={env} onPickToken={onPickToken} onPickSide={onPickSide} onClose={() => setPicked(null)} />}
    </div>
  )
}

function Inspector({ info, env, onPickToken, onPickSide, onClose }: { info: Picked; env: Env; onPickToken: (t: ColorToken) => void; onPickSide: (id: string) => void; onClose: () => void }) {
  const side = info.side ? env.pack.factions.find((f) => f.id === info.side) : null
  return (
    <aside className="inspector" aria-label="The clicked part">
      <div className="inspector-head">
        <b>{info.name}</b>
        <button type="button" className="link dismiss" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {info.tokens.length > 0 && (
        <div className="inspector-row">
          <span className="muted small">Painted with</span>
          {info.tokens.map((t) => (
            <button key={t} type="button" className="token-chip" onClick={() => onPickToken(t)} title={`Go to ${t}`}>
              <Chip hex={env.c(t)} small /> <code>{t}</code>
            </button>
          ))}
        </div>
      )}
      {side && (
        <div className="inspector-row">
          <span className="muted small">Painted with the side colour of</span>
          <button type="button" className="token-chip" onClick={() => onPickSide(side.id)}>
            <Chip hex={env.side(side.id)} small /> {side.name || side.id}
          </button>
        </div>
      )}
      {info.tex && (
        <p className="small">
          Drawn with the look's <code>{info.tex}</code> texture (look.json <code>textures</code>).
        </p>
      )}
      {info.fixed && <p className="small fixed-note">{info.fixed}</p>}
      {info.src.length > 0 && (
        <p className="muted small">
          From the game's <code>{info.src.map((s) => s.split(':')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}</code>
        </p>
      )}
      {!info.tokens.length && !side && !info.fixed && !info.tex && <p className="muted small">This part has no colour of its own.</p>}
    </aside>
  )
}
