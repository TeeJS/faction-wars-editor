// The colour editing: each of the 23 colours in its group, the sides' chrome
// colours, and the contrast the game's own test measures. Every change goes
// into the pack as one undoable change (`edit`, with a label for Undo).

import { useEffect, useState } from 'react'
import { COLOR_GROUPS } from '@core/look/groups'
import { contrastPairs, formatRatio, parseHex, type PairResult, type SideInfo } from '@core/look/contrast'
import { normalizeHex } from '@core/look/hex'
import type { LookFile } from '@core/look/lookfile'
import type { ColorToken } from '@core/look/vocab'
import type { Faction } from '@core/look/pack'
import type { LookEdit } from './LookPage'

export function Chip({ hex, small }: { hex: string | undefined; small?: boolean }) {
  const ok = parseHex(hex) !== null
  return (
    <span
      className={`swatch${small ? ' small' : ''}${ok ? '' : ' invalid'}`}
      style={ok ? { background: hex } : undefined}
      title={ok ? hex : 'Not a #rrggbb colour'}
      aria-hidden="true"
    />
  )
}

interface FieldProps {
  label: string
  value: string | undefined
  onChange: (hex: string) => void
}

/** The swatch: the system colour picker. */
export function ColorPicker({ label, value, onChange }: FieldProps) {
  const valid = parseHex(value) !== null
  return (
    <input
      type="color"
      className={`picker${valid ? '' : ' invalid'}`}
      aria-label={`${label} colour picker`}
      value={valid ? value!.toLowerCase() : '#000000'}
      onChange={(e) => onChange(e.currentTarget.value.toLowerCase())}
    />
  )
}

/** The hex field. A hex is written once it is a colour ("#abc" and "abc" are
 * read as "#aabbcc"); while it is not, the field says so and the look keeps
 * its last colour. Esc or leaving the field shows the look's colour again. */
export function HexInput({ label, value, onChange }: FieldProps) {
  const [text, setText] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value ?? '')
  }, [value, focused])
  const bad = focused ? text.trim().length > 0 && normalizeHex(text) === null : parseHex(value) === null
  return (
    <span className="hex-wrap">
      <input
        type="text"
        className="hex-input"
        aria-label={`${label} hex`}
        aria-invalid={bad}
        spellCheck={false}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          setText(value ?? '')
        }}
        onChange={(e) => {
          setText(e.currentTarget.value)
          const hex = normalizeHex(e.currentTarget.value)
          if (hex && hex !== value) onChange(hex)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setText(value ?? '')
            e.currentTarget.blur()
          }
        }}
      />
      {bad && <span className="hex-hint">{focused ? 'Type #rrggbb' : 'Not #rrggbb'}</span>}
    </span>
  )
}

const pairName = (p: PairResult) => `${p.fgLabel} on ${p.bg}`

function ContrastLine({ pairs }: { pairs: PairResult[] }) {
  if (pairs.length === 0) return null
  const below = pairs.filter((p) => p.ok === false)
  if (below.length === 0)
    return (
      <div className="contrast-line ok">
        {pairs.length} contrast pair{pairs.length === 1 ? '' : 's'} pass{pairs.length === 1 ? 'es' : ''}
      </div>
    )
  return (
    <div className="contrast-line below">
      {below.length} of {pairs.length} below the game's test:{' '}
      {below.map((p, i) => (
        <span key={i}>
          {i > 0 && ', '}
          {pairName(p)} {formatRatio(p.ratio)} (needs {p.need})
        </span>
      ))}
    </div>
  )
}

function sideInfo(factions: Faction[]): SideInfo[] {
  return factions.map((f) => ({ id: f.id, name: f.name, mapColor: f.color }))
}

/** What the pointer is over in the colour list: a token or a side. */
export interface Hover {
  token?: ColorToken
  side?: string
}

export function ColorsPanel(props: {
  look: LookFile
  factions: Faction[]
  edit: LookEdit
  /** One column, no contrast panel: beside the window mock-ups. */
  compact?: boolean
  onHover?: (h: Hover | null) => void
  /** A row to draw the eye to (a token, or "side:<id>"). */
  flash?: string | null
}) {
  const { look, factions, edit, compact, onHover, flash } = props
  const pairs = contrastPairs(look, sideInfo(factions))
  const pairsOf = (token: string) => pairs.filter((p) => p.fg === token || p.bg === token)
  return (
    <>
      <div className={compact ? 'groups compact' : 'groups'}>
        {COLOR_GROUPS.map((g) => (
          <section key={g.title} className="group">
            <h3>{g.title}</h3>
            <ul>
              {g.tokens.map(({ token, paints }) => (
                <ColorRow
                  key={token}
                  token={token}
                  paints={paints}
                  value={look.color(token)}
                  saved={look.savedColor(token)}
                  isNew={look.saved === null}
                  pairs={pairsOf(token)}
                  flash={flash === token}
                  onHover={onHover}
                  onChange={(hex) => edit(`Colour ${token}`, (l) => l.setColor(token, hex))}
                />
              ))}
            </ul>
          </section>
        ))}
        <SidesGroup look={look} factions={factions} pairs={pairs} edit={edit} onHover={onHover} flash={flash} />
      </div>
      {!compact && <ContrastPanel pairs={pairs} />}
    </>
  )
}

function ColorRow(props: {
  token: ColorToken
  paints: string
  value: string | undefined
  saved: string | undefined
  isNew: boolean
  pairs: PairResult[]
  flash: boolean
  onHover?: (h: Hover | null) => void
  onChange: (hex: string) => void
}) {
  const { token, paints, value, saved, isNew, pairs, flash, onHover, onChange } = props
  const changed = !isNew && value !== saved
  return (
    <li
      className={`token${changed ? ' changed' : ''}${flash ? ' flash' : ''}`}
      data-token={token}
      id={`color-${token}`}
      onMouseEnter={onHover ? () => onHover({ token }) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      <ColorPicker label={token} value={value} onChange={onChange} />
      <div className="token-text">
        <div className="token-line">
          <code className="token-name">{token}</code>
          <HexInput label={token} value={value} onChange={onChange} />
        </div>
        <div className="muted small">{paints}</div>
        {changed && (
          <div className="was small" title="The colour in the saved file">
            Changed; the file has <Chip hex={saved} small /> <code>{saved ?? 'missing'}</code>
          </div>
        )}
        <ContrastLine pairs={pairs} />
      </div>
    </li>
  )
}

function SidesGroup(props: {
  look: LookFile
  factions: Faction[]
  pairs: PairResult[]
  edit: LookEdit
  onHover?: (h: Hover | null) => void
  flash?: string | null
}) {
  const { look, factions, pairs, edit, onHover, flash } = props
  const label = (f: Faction) => `${f.name || f.id} side colour`
  return (
    <section className="group sides-group">
      <h3>Sides in the chrome</h3>
      <p className="muted small">
        A side's colour on the launch plates and the map mode's name. The map itself keeps each side's colour from <code>factions.json</code>.
      </p>
      {factions.length === 0 && <p className="muted small">factions.json names no factions.</p>}
      <ul>
        {factions.map((f) => {
          const own = look.side(f.id)
          const saved = look.savedSide(f.id)
          const changed = look.saved !== null && own !== saved
          const sidePairs = pairs.filter((p) => p.fg === `side:${f.id}`)
          return (
            <li
              key={f.id}
              className={`token${changed ? ' changed' : ''}${flash === `side:${f.id}` ? ' flash' : ''}`}
              data-side={f.id}
              id={`side-${f.id}`}
              onMouseEnter={onHover ? () => onHover({ side: f.id }) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
            >
              {own !== undefined ? (
                <ColorPicker label={`${f.name || f.id} side`} value={own} onChange={(hex) => edit(label(f), (l) => l.setSide(f.id, hex))} />
              ) : (
                <Chip hex={f.color} />
              )}
              <div className="token-text">
                <div className="token-line">
                  <span className="side-name">{f.name || f.id}</span>
                  {own !== undefined ? (
                    <HexInput label={`${f.name || f.id} side`} value={own} onChange={(hex) => edit(label(f), (l) => l.setSide(f.id, hex))} />
                  ) : (
                    <span className="muted small">uses the map colour</span>
                  )}
                </div>
                <div className="muted small">
                  Map colour <Chip hex={f.color} small /> <code>{f.color}</code> ·{' '}
                  {own === undefined ? (
                    <button type="button" className="link" onClick={() => edit(label(f), (l) => l.setSide(f.id, parseHex(f.color) ? f.color.toLowerCase() : '#ffffff'))}>
                      Give it its own colour
                    </button>
                  ) : (
                    <button type="button" className="link" onClick={() => edit(label(f), (l) => l.setSide(f.id, undefined))}>
                      Use the map colour
                    </button>
                  )}
                </div>
                <ContrastLine pairs={sidePairs} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ContrastPanel({ pairs }: { pairs: PairResult[] }) {
  const below = pairs.filter((p) => p.ok === false)
  const ordered = [...below, ...pairs.filter((p) => p.ok !== false)]
  return (
    <>
      <div className="section-head">
        <h2>Contrast</h2>
        <span className={`small ${below.length ? 'below-text' : 'muted'}`}>
          {pairs.length - below.length} of {pairs.length} pairs meet the game's own test (4.5:1 for text, 3:1 for edges and disabled text). The game loads the
          look either way.
        </span>
      </div>
      <ul className="pairs">
        {ordered.map((p) => (
          <li key={`${p.fg}|${p.bg}`} className={`pair${p.ok === false ? ' below' : ''}`}>
            <span className="specimen" style={{ background: parseHex(p.bgHex) ? p.bgHex : undefined, color: parseHex(p.fgHex) ? p.fgHex : undefined }}>
              Aa
            </span>
            <span className="pair-text">
              <span className="pair-name">{pairName(p)}</span>
              <span className="small">
                <b>{formatRatio(p.ratio)}</b> <span className="muted">needs {p.need}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}
