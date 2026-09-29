// Faces, sizes, corners and the dim. A face is a font file the pack carries, or
// one chosen from disk, which comes into the pack's look/fonts/ with the change
// that names it. A size or corner left empty takes the game's default. The
// mock-ups follow every change.

import { useEffect, useState } from 'react'
import type { LookPack } from '@core/look/pack'
import type { LookFile } from '@core/look/lookfile'
import { isDict } from '@core/look/godot'
import {
  DEFAULT_METRICS,
  DEFAULT_OVERLAY_ALPHA,
  DEFAULT_SIZES,
  KNOWN_LOOK_FONTS,
  KNOWN_LOOK_METRICS,
  KNOWN_LOOK_SIZES,
  KNOWN_LOOK_TEXTURES,
  KNOWN_MESSAGE_CATEGORIES
} from '@core/look/vocab'
import { store } from '../store'
import type { LookEdit } from './LookPage'
import type { Env } from './mock/kit'

const ROLE_USE: Record<string, string> = {
  display: 'Labels, headings, title bars, console keys',
  display_bold: 'Launch plates, the campaign name, map names, unread counts',
  body: 'All other text, and figures',
  body_bold: 'Bold text',
  typed: 'Typed captions',
  typed_bold: 'Typed dispatch headings'
}
const ROLE_SIZE: Record<string, string> = { display: 'heading', display_bold: 'heading', body: 'body', body_bold: 'body', typed: 'label', typed_bold: 'label' }

const SIZE_USE: Record<string, string> = {
  body: 'The default size. Keep it at 16 unless every screen is checked for clipping (SCHEMA.md).',
  small: 'Tooltips, the speed readout, small keys',
  label: 'Console keys, rail items, typed headings',
  title: 'Window titles',
  heading: 'Headings, launch plates, the day',
  display: 'The campaign name'
}
const METRIC_USE: Record<string, string> = {
  radius: 'Corner rounding',
  border: 'Border width',
  focus: "The keyboard focus ring's width",
  pad: 'Space inside a box'
}

/** A number field that writes once it reads as a number; empty removes the value. */
function NumField(props: { label: string; value: number | undefined; placeholder: string; min: number; max?: number; step?: number; onChange: (v: number | undefined) => void; disabled?: boolean }) {
  const { label, value, placeholder, min, max, step = 1, onChange, disabled } = props
  const [text, setText] = useState(value === undefined ? '' : String(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value === undefined ? '' : String(value))
  }, [value, focused])
  return (
    <input
      type="number"
      className="num-input"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={text}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.currentTarget.value
        setText(t)
        if (t.trim() === '') onChange(undefined)
        else if (Number.isFinite(Number(t))) onChange(Number(t))
      }}
    />
  )
}

export function Settings(props: { look: LookFile; pack: LookPack; env: Env | null; edit: LookEdit }) {
  const { look, pack, env, edit } = props
  const v = look.value ?? {}
  const fonts = isDict(v.fonts) ? v.fonts : {}
  const sizes = isDict(v.sizes) ? v.sizes : {}
  const metrics = isDict(v.metrics) ? v.metrics : {}
  const textures = isDict(v.textures) ? v.textures : {}
  const fontFiles = pack.files.filter((f) => /\.(ttf|otf)$/i.test(f))
  const alpha = typeof v.overlay_alpha === 'number' ? v.overlay_alpha : undefined
  const num = (x: unknown) => (typeof x === 'number' ? x : undefined)

  const chooseFile = async (role: string) => {
    const [picked] = await window.api.pickFiles(`Choose a font file for ${role}`, ['ttf', 'otf'])
    if (!picked) return
    const rel = `look/fonts/${picked.name}`
    const replaces = pack.files.includes(rel)
    edit(`Face ${role}`, (l) => (isDict(l.get(['fonts', role])) ? l.set(['fonts', role, 'file'], rel) : l.set(['fonts', role], { file: rel })), [[rel, picked.bytes]])
    store.notify(
      'info',
      `${picked.name} is now in the pack at ${rel}${replaces ? `, in place of the one it had` : ''}. It goes to disk with the next save; Undo takes it back.`
    )
  }

  return (
    <>
      <div className="section-head">
        <h2>Faces</h2>
        <span className="muted small">A role without a face uses body's; body without one uses the engine's own face.</span>
      </div>
      <div className="faces">
        {KNOWN_LOOK_FONTS.map((role) => {
          const f = fonts[role]
          const face = isDict(f) ? f : null
          const file = face ? String(face.file ?? '') : ''
          return (
            <section key={role} className="group face" data-role={role}>
              <div className="face-head">
                <code className="token-name">{role}</code>
                <span className="muted small">{ROLE_USE[role]}</span>
              </div>
              <div className="face-controls">
                <select
                  aria-label={`${role} face file`}
                  value={file}
                  onChange={(e) => {
                    const next = e.currentTarget.value
                    edit(`Face ${role}`, (l) => (!next ? l.set(['fonts', role], undefined) : face ? l.set(['fonts', role, 'file'], next) : l.set(['fonts', role], { file: next })))
                  }}
                >
                  <option value="">{role === 'body' ? "The engine's own face" : "Body's face"}</option>
                  {fontFiles.map((ff) => (
                    <option key={ff} value={ff}>
                      {ff}
                    </option>
                  ))}
                  {file && !fontFiles.includes(file) && <option value={file}>{file} (not in the pack)</option>}
                </select>
                <button type="button" onClick={() => void chooseFile(role)}>
                  Choose a font file…
                </button>
                <label className="inline">
                  Weight
                  <NumField
                    label={`${role} weight`}
                    value={face ? num(face.weight) : undefined}
                    placeholder="—"
                    min={100}
                    max={900}
                    disabled={!face}
                    onChange={(w) => edit(`Face ${role} weight`, (l) => l.set(['fonts', role, 'weight'], w))}
                  />
                </label>
                <label className="inline">
                  <input
                    type="checkbox"
                    aria-label={`${role} tabular figures`}
                    checked={face?.tabular === true}
                    disabled={!face}
                    onChange={(e) => {
                      const on = e.currentTarget.checked
                      edit(`Face ${role} tabular figures`, (l) => l.set(['fonts', role, 'tabular'], on ? true : undefined))
                    }}
                  />
                  Tabular figures
                </label>
              </div>
              {env && (
                <div className="specimen-line" style={{ ...env.face(role), fontSize: env.size(ROLE_SIZE[role]) }}>
                  Theatre report 1,240 · Day 118
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="section-head">
        <h2>Sizes, corners and the dim</h2>
        <span className="muted small">Pixels. Empty means the game's default.</span>
      </div>
      <div className="settings">
        <section className="group">
          <h3>Sizes</h3>
          <table>
            <tbody>
              {KNOWN_LOOK_SIZES.map((k) => (
                <tr key={k}>
                  <th scope="row">
                    <code>{k}</code>
                    <div className="muted small">{SIZE_USE[k]}</div>
                  </th>
                  <td>
                    <NumField label={`${k} size`} value={num(sizes[k])} placeholder={String(DEFAULT_SIZES[k])} min={1} onChange={(n) => edit(`Size ${k}`, (l) => l.set(['sizes', k], n))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="group">
          <h3>Corners and borders</h3>
          <table>
            <tbody>
              {KNOWN_LOOK_METRICS.map((k) => (
                <tr key={k}>
                  <th scope="row">
                    <code>{k}</code>
                    <div className="muted small">{METRIC_USE[k]}</div>
                  </th>
                  <td>
                    <NumField label={`${k} metric`} value={num(metrics[k])} placeholder={String(DEFAULT_METRICS[k])} min={0} onChange={(n) => edit(`Corners ${k}`, (l) => l.set(['metrics', k], n))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>The dim behind a dialog</h3>
          <div className="dim-row">
            <input
              type="range"
              aria-label="Dim strength"
              min={0}
              max={1}
              step={0.01}
              value={alpha ?? DEFAULT_OVERLAY_ALPHA}
              onChange={(e) => {
                const n = Number(e.currentTarget.value)
                edit('Dim strength', (l) => l.set(['overlay_alpha'], n))
              }}
            />
            <NumField label="Dim strength value" value={alpha} placeholder={String(DEFAULT_OVERLAY_ALPHA)} min={0} max={1} step={0.01} onChange={(n) => edit('Dim strength', (l) => l.set(['overlay_alpha'], n))} />
            {env && (
              <span className="dim-swatch" aria-hidden="true">
                <span style={{ background: env.c('overlay'), opacity: alpha ?? DEFAULT_OVERLAY_ALPHA }} />
              </span>
            )}
          </div>
          <p className="muted small">In the overlay colour, from 0 (none) to 1 (solid).</p>
        </section>
        <section className="group">
          <h3>Textures</h3>
          <p className="muted small">Kept as they are: the Look page does not change a look's textures.</p>
          <table>
            <tbody>
              {KNOWN_LOOK_TEXTURES.map((k) => {
                const t = textures[k]
                return (
                  <tr key={k}>
                    <th scope="row">
                      <code>{k}</code>
                    </th>
                    <td>{t === undefined ? <span className="muted">none</span> : <code>{isDict(t) ? String(t.file) : String(t)}</code>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>

      <div className="section-head">
        <h2>Dispatches</h2>
        <span className="muted small">
          The Message Index in the look: the word typed over every dispatch, each category's stamp, and which categories carry the red band. An empty
          category shows the pack's <code>no_messages</code> term (Display Settings).
        </span>
      </div>
      <Dispatches look={look} edit={edit} />
    </>
  )
}

/** A text field that writes as it is typed; empty removes the value. */
function TextField(props: { label: string; value: string | undefined; placeholder: string; onChange: (v: string | undefined) => void }) {
  const { label, value, placeholder, onChange } = props
  const [text, setText] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value ?? '')
  }, [value, focused])
  return (
    <input
      type="text"
      className="text-input"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      spellCheck={false}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.currentTarget.value
        setText(t)
        onChange(t === '' ? undefined : t)
      }}
    />
  )
}

/** look.json `messages`: header, stamps (category -> word), urgent (categories). */
function Dispatches({ look, edit }: { look: LookFile; edit: LookEdit }) {
  const v = look.value ?? {}
  const m = v.messages
  if (m !== undefined && !isDict(m))
    return <p className="small below-text">look.json's `messages` is not an object; fix it in the file (the Problems panel names it).</p>
  const messages = isDict(m) ? m : {}
  const stamps = isDict(messages.stamps) ? messages.stamps : {}
  const urgent = Array.isArray(messages.urgent) ? messages.urgent.filter((c): c is string => typeof c === 'string') : []
  const str = (x: unknown) => (typeof x === 'string' ? x : undefined)
  return (
    <div className="settings">
      <section className="group">
        <h3>The word over a dispatch</h3>
        <TextField label="Dispatch header word" value={str(messages.header)} placeholder="none" onChange={(t) => edit('Dispatch word', (l) => l.set(['messages', 'header'], t))} />
        <p className="muted small">Typed in capitals above the subject, e.g. Dispatch. Empty: none.</p>
      </section>
      <section className="group">
        <h3>Each category's stamp</h3>
        <table>
          <tbody>
            {KNOWN_MESSAGE_CATEGORIES.map((c) => (
              <tr key={c}>
                <th scope="row">{c}</th>
                <td>
                  <span className="stamp-row">
                    <TextField label={`${c} stamp`} value={str(stamps[c])} placeholder="no stamp" onChange={(t) => edit(`Stamp ${c}`, (l) => l.set(['messages', 'stamps', c], t))} />
                    <label className="inline">
                      <input
                        type="checkbox"
                        aria-label={`${c} is urgent`}
                        checked={urgent.includes(c)}
                        onChange={(e) => {
                          const on = e.currentTarget.checked
                          const next = on ? [...urgent, c] : urgent.filter((x) => x !== c)
                          edit(`Urgent ${c}`, (l) => l.set(['messages', 'urgent'], next.length ? next : undefined))
                        }}
                      />
                      Red band
                    </label>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">A category with no stamp shows none. The red band marks a row and its dispatch as urgent.</p>
      </section>
    </div>
  )
}
