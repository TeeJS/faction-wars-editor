// Renders one FieldDef against the JSON object at `path` and writes changes as
// minimal edits. Text-like inputs commit on blur or Enter (Esc reverts), so one
// typing session is one undo step.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { JSONPath } from '../../../core/jsontext'
import { ci, gdInt, isDict } from '../../../core/model'
import { findUsages, renameUsages } from '../../../core/refs'
import { parseArtRef, splitArtRef } from '../../../core/validate'
import { ARC_KEYS, RATING_KEYS, type PackJsonFile } from '../../../core/vocab'
import { store } from '../store'
import { confirmDialog } from '../ui/Modal'
import { useImage } from '../ui/useImage'
import type { Ctx, Dict, FieldDef, FieldProps, Opt, OptSource } from './types'

// ---- helpers ----

export function opts(src: OptSource, c: Ctx, rec: Dict): Opt[] {
  const list = typeof src === 'function' ? src(c, rec) : src
  return list.map((o) => (typeof o === 'string' ? { value: o } : o))
}

const has = (rec: unknown, key: string) => ci(rec, key) !== undefined

function write(c: Ctx, file: PackJsonFile, path: JSONPath, value: unknown, label: string): void {
  c.doc.edit(label, (e) => (value === undefined ? e.remove(file, path) : e.set(file, path, value)))
}

/** Sets a field, or removes an optional one when cleared. */
function commit(p: FieldProps, value: unknown, empty: boolean): void {
  const { c, file, path, rec, def } = p
  if (empty && !def.required) {
    if (has(rec, def.key)) write(c, file, [...path, def.key], undefined, `Clear ${def.label}`)
    return
  }
  write(c, file, [...path, def.key], value, `Edit ${def.label}`)
}

/** An input that keeps its own text while focused and commits on blur/Enter. */
export function CommitInput(props: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  multiline?: boolean
  list?: string
  className?: string
  invalid?: (v: string) => string | null
  ariaLabel?: string
  mono?: boolean
}): ReactNode {
  const [text, setText] = useState(props.value)
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(props.value)
  }, [props.value])
  const problem = props.invalid ? props.invalid(text) : null
  const done = () => {
    focused.current = false
    if (text === props.value) return
    if (problem) {
      store.notify('error', problem)
      setText(props.value)
      return
    }
    props.onCommit(text)
  }
  const common = {
    value: text,
    placeholder: props.placeholder,
    'aria-label': props.ariaLabel,
    'aria-invalid': !!problem,
    className: [props.className, props.mono ? 'mono' : ''].filter(Boolean).join(' ') || undefined,
    onFocus: () => (focused.current = true),
    onBlur: done,
    onChange: (e: { target: { value: string } }) => setText(e.target.value)
  }
  if (props.multiline)
    return (
      <textarea
        {...common}
        rows={Math.min(8, Math.max(2, text.split('\n').length))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setText(props.value)
        }}
      />
    )
  return (
    <input
      {...common}
      list={props.list}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setText(props.value)
          focused.current = false
        }
      }}
    />
  )
}

const intProblem = (v: string) => (v.trim() === '' || /^-?\d+$/.test(v.trim()) ? null : `'${v}' is not a whole number.`)
const floatProblem = (v: string) => (v.trim() === '' || Number.isFinite(Number(v)) ? null : `'${v}' is not a number.`)
const colorProblem = (v: string) => (v === '' || /^#[0-9a-fA-F]{6}$/.test(v) ? null : `'${v}' is not a #rrggbb colour.`)

function str(v: unknown): string {
  return v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v)
}

// ---- the field switch ----

export function FieldView(p: FieldProps): ReactNode {
  const { def, rec, c } = p
  if (def.showIf && !def.showIf(rec, c)) return null
  const control = renderControl(p)
  const block = def.kind === 'object' || def.kind === 'list' || def.kind === 'ratings' || def.kind === 'unitWeapons' || def.kind === 'kv'
  return (
    <div className={`field ${block ? 'field-block' : ''} ${def.wide ? 'field-wide' : ''}`}>
      <div className="field-label">
        <span>{def.label}</span>
        <code title="JSON key">{def.key}</code>
      </div>
      <div className="field-control">{control}</div>
      {def.help && <div className="field-help">{def.help}</div>}
    </div>
  )
}

function renderControl(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  const v = ci(rec, def.key)
  switch (def.kind) {
    case 'text':
      return (
        <CommitInput
          value={str(v)}
          multiline={def.multiline}
          placeholder={def.placeholder}
          ariaLabel={def.label}
          onCommit={(t) => commit(p, t, t === '')}
        />
      )
    case 'int':
    case 'float':
      return (
        <CommitInput
          className="num"
          value={v === undefined || v === null ? '' : String(v)}
          placeholder={def.placeholder}
          ariaLabel={def.label}
          invalid={def.kind === 'int' ? intProblem : floatProblem}
          onCommit={(t) => commit(p, def.kind === 'int' ? parseInt(t, 10) : Number(t), t.trim() === '')}
        />
      )
    case 'bool':
      return (
        <input
          type="checkbox"
          aria-label={def.label}
          checked={v === true || (typeof v === 'number' && v !== 0)}
          onChange={(e) => write(c, file, [...path, def.key], e.target.checked, `Edit ${def.label}`)}
        />
      )
    case 'color':
      return (
        <span className="color-field">
          <input
            type="color"
            aria-label={`${def.label} picker`}
            value={typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000'}
            onChange={(e) => write(c, file, [...path, def.key], e.target.value, `Edit ${def.label}`)}
          />
          <CommitInput className="mono short" value={str(v)} invalid={colorProblem} ariaLabel={def.label} onCommit={(t) => commit(p, t, t === '')} />
        </span>
      )
    case 'select': {
      const options = opts(def.options, c, rec)
      const cur = str(v)
      if (def.free) {
        const listId = `dl-${path.join('-')}-${def.key}`
        return (
          <>
            <CommitInput value={cur} list={listId} ariaLabel={def.label} onCommit={(t) => commit(p, t, t === '')} />
            <datalist id={listId}>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </datalist>
          </>
        )
      }
      const known = options.some((o) => o.value === cur)
      return (
        <select aria-label={def.label} value={cur} onChange={(e) => commit(p, e.target.value, e.target.value === '')}>
          {(def.allowEmpty || cur === '') && <option value="">{def.emptyLabel ?? '—'}</option>}
          {!known && cur !== '' && <option value={cur}>{cur} (not declared)</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label ? `${o.label} (${o.value})` : o.value}
            </option>
          ))}
        </select>
      )
    }
    case 'multi':
      return <MultiField {...p} />
    case 'orderedRefs':
      return <OrderedRefs {...p} />
    case 'strings':
      return <StringList {...p} />
    case 'ints': {
      const arr = Array.isArray(v) ? v : []
      return (
        <CommitInput
          value={arr.join(', ')}
          ariaLabel={def.label}
          placeholder="e.g. 35, 40, 60"
          invalid={(t) => (t.split(',').every((x) => x.trim() === '' || /^-?\d+$/.test(x.trim())) ? null : 'Whole numbers separated by commas.')}
          onCommit={(t) => {
            const list = t.split(',').map((x) => x.trim()).filter(Boolean).map((x) => parseInt(x, 10))
            commit(p, list, list.length === 0)
          }}
        />
      )
    }
    case 'object':
      return <ObjectField {...p} />
    case 'list':
      return <ListField {...p} />
    case 'kv':
      return <KvField {...p} />
    case 'baseVar':
      return <BaseVar {...p} />
    case 'ratings':
      return <Ratings {...p} />
    case 'unitWeapons':
      return <UnitWeapons {...p} />
    case 'rect':
      return <RectField {...p} />
    case 'quad':
      return <QuadField {...p} />
    case 'point':
      return <PointField {...p} />
    case 'art':
      return <ArtField {...p} />
    case 'file':
      return <FileField {...p} />
    case 'id':
      return <IdField {...p} />
    case 'custom':
      return def.render(p)
  }
}

// ---- compound fields ----

function MultiField(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'multi') return null
  const cur = Array.isArray(ci(rec, def.key)) ? (ci(rec, def.key) as unknown[]).map(String) : []
  const options = opts(def.options, c, rec)
  const set = (next: string[]) => write(c, file, [...path, def.key], next, `Edit ${def.label}`)
  const unknown = cur.filter((x) => !options.some((o) => o.value === x))
  return (
    <div className="chips">
      {options.map((o) => {
        const on = cur.includes(o.value)
        return (
          <label key={o.value} className={`chip ${on ? 'on' : ''}`} title={o.label ? o.value : undefined}>
            <input
              type="checkbox"
              checked={on}
              onChange={() => set(on ? cur.filter((x) => x !== o.value) : [...cur, o.value])}
            />
            {o.label ?? o.value}
          </label>
        )
      })}
      {unknown.map((x) => (
        <span key={x} className="chip bad" title="Not declared - the validator will flag it">
          {x}
          <button className="link" aria-label={`Remove ${x}`} onClick={() => set(cur.filter((y) => y !== x))}>
            ×
          </button>
        </span>
      ))}
      {options.length === 0 && unknown.length === 0 && <span className="muted">Nothing to choose from yet.</span>}
    </div>
  )
}

function OrderedRefs(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'orderedRefs') return null
  const raw = ci(rec, def.key)
  const cur = Array.isArray(raw) ? raw.map(String) : []
  const options = opts(def.options, c, rec)
  const set = (next: string[] | undefined) => write(c, file, [...path, def.key], next, `Edit ${def.label}`)
  const remaining = options.filter((o) => !def.unique || !cur.includes(o.value))
  return (
    <div className="ordered">
      {cur.map((x, i) => (
        <div key={i} className="ordered-row">
          <span className="ordinal">{i + 1}</span>
          <select
            value={x}
            aria-label={`${def.label} ${i + 1}`}
            onChange={(e) => set(cur.map((y, j) => (j === i ? e.target.value : y)))}
          >
            {!options.some((o) => o.value === x) && <option value={x}>{x} (not declared)</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label ? `${o.label} (${o.value})` : o.value}
              </option>
            ))}
          </select>
          <RowButtons
            index={i}
            count={cur.length}
            onMove={(to) => {
              const next = [...cur]
              const [m] = next.splice(i, 1)
              next.splice(to, 0, m)
              set(next)
            }}
            onRemove={() => set(cur.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <div className="row-actions">
        {remaining.length > 0 && (
          <button onClick={() => set([...cur, remaining[0].value])}>+ Add</button>
        )}
        {raw !== undefined && !def.required && cur.length === 0 && (
          <button className="link" onClick={() => set(undefined)}>
            Remove the key
          </button>
        )}
      </div>
    </div>
  )
}

function StringList(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'strings') return null
  const raw = ci(rec, def.key)
  const cur = Array.isArray(raw) ? raw.map((x) => str(x)) : []
  const set = (next: string[]) => write(c, file, [...path, def.key], next, `Edit ${def.label}`)
  return (
    <div className="ordered">
      {cur.map((x, i) => (
        <div key={i} className="ordered-row">
          <CommitInput value={x} ariaLabel={`${def.label} ${i + 1}`} placeholder={def.placeholder} onCommit={(t) => set(cur.map((y, j) => (j === i ? t : y)))} />
          <RowButtons
            index={i}
            count={cur.length}
            onMove={(to) => {
              const next = [...cur]
              const [m] = next.splice(i, 1)
              next.splice(to, 0, m)
              set(next)
            }}
            onRemove={() => set(cur.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <div className="row-actions">
        <button onClick={() => set([...cur, ''])}>+ Add</button>
      </div>
    </div>
  )
}

export function RowButtons(props: { index: number; count: number; onMove: (to: number) => void; onRemove?: () => void; onDuplicate?: () => void }): ReactNode {
  const { index, count } = props
  return (
    <span className="row-buttons">
      <button className="icon" title="Move up" aria-label="Move up" disabled={index === 0} onClick={() => props.onMove(index - 1)}>
        ↑
      </button>
      <button className="icon" title="Move down" aria-label="Move down" disabled={index >= count - 1} onClick={() => props.onMove(index + 1)}>
        ↓
      </button>
      {props.onDuplicate && (
        <button className="icon" title="Duplicate" aria-label="Duplicate" onClick={props.onDuplicate}>
          ⧉
        </button>
      )}
      {props.onRemove && (
        <button className="icon danger" title="Remove" aria-label="Remove" onClick={props.onRemove}>
          ✕
        </button>
      )}
    </span>
  )
}

function ObjectField(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'object') return null
  const v = ci(rec, def.key)
  if (!isDict(v)) {
    if (v !== undefined && v !== null) return <span className="bad">Not an object: {str(v)} — fix it in Raw JSON.</span>
    return (
      <button onClick={() => write(c, file, [...path, def.key], def.addValue ? def.addValue(c) : {}, `Add ${def.label}`)}>
        + Add {def.label}
      </button>
    )
  }
  return (
    <fieldset className="subform">
      {def.fields.map((f) => (
        <FieldView key={f.key} c={c} file={file} path={[...path, def.key]} rec={v} def={f} />
      ))}
      {def.optional && (
        <div className="row-actions">
          <button className="link danger" onClick={() => write(c, file, [...path, def.key], undefined, `Remove ${def.label}`)}>
            Remove {def.label}
          </button>
        </div>
      )}
    </fieldset>
  )
}

function ListField(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'list') return null
  const raw = ci(rec, def.key)
  const items = Array.isArray(raw) ? raw : []
  const base: JSONPath = [...path, def.key]
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const move = (from: number, to: number) => {
    if (def.orderNote) store.notify('info', def.orderNote)
    c.doc.edit(`Move in ${def.label}`, (e) => e.move(file, base, from, to))
  }
  return (
    <div className="list-field">
      {items.map((item, i) => {
        const title = isDict(item) ? (def.itemTitle ? def.itemTitle(item, i) : `#${i + 1}`) : item === null ? `#${i + 1} (empty slot)` : `#${i + 1}`
        const expanded = open[i] ?? items.length <= 4
        return (
          <div key={i} className="list-item">
            <div className="list-item-head">
              <button className="link" aria-expanded={expanded} onClick={() => setOpen({ ...open, [i]: !expanded })}>
                {expanded ? '▾' : '▸'} {title}
              </button>
              <RowButtons
                index={i}
                count={items.length}
                onMove={(to) => move(i, to)}
                onDuplicate={() => c.doc.edit(`Duplicate in ${def.label}`, (e) => e.insert(file, base, i + 1, item))}
                onRemove={() => c.doc.edit(`Remove from ${def.label}`, (e) => e.remove(file, [...base, i]))}
              />
            </div>
            {expanded &&
              (isDict(item) ? (
                <div className="subform">
                  {def.fields.map((f) => (
                    <FieldView key={f.key} c={c} file={file} path={[...base, i]} rec={item} def={f} />
                  ))}
                </div>
              ) : item === null && def.allowNull ? (
                <div className="muted">
                  An empty slot (kept on purpose - its position matters).{' '}
                  <button className="link" onClick={() => c.doc.edit('Fill slot', (e) => e.set(file, [...base, i], def.newItem(c, rec)))}>
                    Fill it
                  </button>
                </div>
              ) : (
                <div className="bad">Not an object: {str(item)} — fix it in Raw JSON.</div>
              ))}
          </div>
        )
      })}
      <div className="row-actions">
        <button onClick={() => c.doc.edit(`Add to ${def.label}`, (e) => e.insert(file, base, items.length, def.newItem(c, rec)))}>+ Add</button>
        {def.allowNull && (
          <button onClick={() => c.doc.edit(`Add empty slot to ${def.label}`, (e) => e.insert(file, base, items.length, null))}>+ Empty slot</button>
        )}
      </div>
    </div>
  )
}

function KvField(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'kv') return null
  const raw = ci(rec, def.key)
  const obj = isDict(raw) ? raw : {}
  const base: JSONPath = [...path, def.key]
  const keys = Object.keys(obj)
  const suggestions = (def.suggest?.(c, rec) ?? []).filter((k) => !keys.includes(k))
  const keyOptions = def.keyOptions?.(c, rec)
  const listId = useId()
  const parse = (t: string): unknown => (def.valueKind === 'text' ? t : Number(t))
  const valueProblem = def.valueKind === 'int' ? intProblem : def.valueKind === 'number' ? floatProblem : () => null
  const [newKey, setNewKey] = useState('')
  const addKey = (k: string) => {
    if (!k || k in obj) return
    c.doc.edit(`Add ${k}`, (e) => e.set(file, [...base, k], def.valueKind === 'text' ? '' : 0))
    setNewKey('')
  }
  return (
    <div className="kv">
      {keys.length > 0 && (
        <table>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td>
                  <CommitInput
                    value={k}
                    mono
                    ariaLabel="key"
                    invalid={(t) => (t === '' ? 'A key cannot be empty.' : t !== k && t in obj ? `'${t}' is already here.` : null)}
                    onCommit={(t) => c.doc.edit(`Rename ${k}`, (e) => e.renameKey(file, base, k, t))}
                  />
                </td>
                <td>
                  <CommitInput
                    className={def.valueKind === 'text' ? '' : 'num'}
                    value={str(obj[k])}
                    ariaLabel={`${k} value`}
                    invalid={valueProblem}
                    onCommit={(t) => c.doc.edit(`Edit ${k}`, (e) => e.set(file, [...base, k], parse(t)))}
                  />
                </td>
                <td>
                  <button className="icon danger" aria-label={`Remove ${k}`} title="Remove" onClick={() => c.doc.edit(`Remove ${k}`, (e) => e.remove(file, [...base, k]))}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row-actions">
        {keyOptions ? (
          <select aria-label="Add key" value="" onChange={(e) => addKey(e.target.value)}>
            <option value="">+ Add…</option>
            {keyOptions
              .filter((k) => !(k in obj))
              .map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </select>
        ) : (
          <>
            <input list={listId} value={newKey} placeholder="new key" aria-label="New key" onChange={(e) => setNewKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addKey(newKey.trim())} />
            <datalist id={listId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button onClick={() => addKey(newKey.trim())} disabled={!newKey.trim()}>
              + Add
            </button>
          </>
        )}
        {suggestions.length > 0 && !keyOptions && <span className="muted">The engine reads: {suggestions.join(', ')}</span>}
      </div>
    </div>
  )
}

function BaseVar(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  const v = ci(rec, def.key)
  const o = isDict(v) ? v : {}
  const set = (k: 'base' | 'var', t: string) => c.doc.edit(`Edit ${def.label}`, (e) => e.set(file, [...path, def.key, k], t === '' ? 0 : parseInt(t, 10)))
  return (
    <span className="pair">
      <label>
        base <CommitInput className="num" value={str(ci(o, 'base'))} invalid={intProblem} ariaLabel={`${def.label} base`} onCommit={(t) => set('base', t)} />
      </label>
      <label>
        ± var <CommitInput className="num" value={str(ci(o, 'var'))} invalid={intProblem} ariaLabel={`${def.label} var`} onCommit={(t) => set('var', t)} />
      </label>
    </span>
  )
}

function Ratings(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  const v = ci(rec, def.key)
  const o = isDict(v) ? v : {}
  const keys = [...RATING_KEYS, ...Object.keys(o).filter((k) => !RATING_KEYS.includes(k))]
  const set = (k: string, part: 'base' | 'var', t: string) =>
    c.doc.edit(`Edit ${k} ${part}`, (e) => {
      const cur = ci(o, k)
      if (!isDict(cur)) e.set(file, [...path, def.key, k], { base: part === 'base' ? parseInt(t || '0', 10) : 0, var: part === 'var' ? parseInt(t || '0', 10) : 0 })
      else e.set(file, [...path, def.key, k, part], parseInt(t || '0', 10))
    })
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>rating</th>
          <th>base</th>
          <th>± var</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const r = ci(o, k)
          return (
            <tr key={k} className={RATING_KEYS.includes(k) ? '' : 'bad'}>
              <td className="mono">{k}</td>
              <td>
                <CommitInput className="num" value={isDict(r) ? str(ci(r, 'base')) : ''} placeholder="0" invalid={intProblem} ariaLabel={`${k} base`} onCommit={(t) => set(k, 'base', t)} />
              </td>
              <td>
                <CommitInput className="num" value={isDict(r) ? str(ci(r, 'var')) : ''} placeholder="0" invalid={intProblem} ariaLabel={`${k} var`} onCommit={(t) => set(k, 'var', t)} />
              </td>
              <td>
                {r !== undefined && (
                  <button className="icon danger" aria-label={`Remove ${k}`} onClick={() => c.doc.edit(`Remove ${k}`, (e) => e.remove(file, [...path, def.key, k]))}>
                    ✕
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function UnitWeapons(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  const raw = ci(rec, def.key)
  const obj = isDict(raw) ? raw : {}
  const base: JSONPath = [...path, def.key]
  const weapons = c.pack.weapons
  const keys = Object.keys(obj)
  const unused = weapons.filter((w) => !keys.includes(w.id))
  const num = (v: unknown) => (v === undefined || v === null ? '' : String(v))
  const setNum = (wk: string, sub: JSONPath, t: string) =>
    c.doc.edit(`Edit ${wk}`, (e) => (t.trim() === '' ? e.remove(file, [...base, wk, ...sub]) : e.set(file, [...base, wk, ...sub], parseInt(t, 10))))
  return (
    <div>
      {keys.length > 0 && (
        <table className="grid">
          <thead>
            <tr>
              <th>weapon</th>
              {ARC_KEYS.map((a) => (
                <th key={a}>{a}</th>
              ))}
              <th title="For a weapon without firing arcs (torpedoes, bombs): the whole payload">amount</th>
              <th title="Reach, per unit; fighters leave it out">range</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((wk) => {
              const w = weapons.find((x) => x.id === wk)
              const entry = isDict(obj[wk]) ? (obj[wk] as Dict) : {}
              const arcs = isDict(ci(entry, 'arcs')) ? (ci(entry, 'arcs') as Dict) : {}
              return (
                <tr key={wk} className={w ? '' : 'bad'}>
                  <td className="mono" title={w ? w.displayName : 'Not declared in weapons.json'}>
                    {wk}
                    {w && !w.arcs && <small className="muted"> (no arcs)</small>}
                  </td>
                  {ARC_KEYS.map((a) => (
                    <td key={a}>
                      <CommitInput className="num" value={num(ci(arcs, a))} invalid={intProblem} ariaLabel={`${wk} ${a}`} onCommit={(t) => setNum(wk, ['arcs', a], t)} />
                    </td>
                  ))}
                  <td>
                    <CommitInput className="num" value={num(ci(entry, 'amount'))} invalid={intProblem} ariaLabel={`${wk} amount`} onCommit={(t) => setNum(wk, ['amount'], t)} />
                  </td>
                  <td>
                    <CommitInput className="num" value={num(ci(entry, 'range'))} invalid={intProblem} ariaLabel={`${wk} range`} onCommit={(t) => setNum(wk, ['range'], t)} />
                  </td>
                  <td>
                    <button className="icon danger" aria-label={`Remove ${wk}`} onClick={() => c.doc.edit(`Remove ${wk}`, (e) => e.remove(file, [...base, wk]))}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="row-actions">
        <select
          aria-label="Fit a weapon"
          value=""
          onChange={(e) => {
            const w = weapons.find((x) => x.id === e.target.value)
            if (!w) return
            c.doc.edit(`Fit ${w.id}`, (ed) => ed.set(file, [...base, w.id], w.arcs ? { arcs: { fore: 0, aft: 0, starboard: 0, port: 0 } } : { amount: 0 }))
          }}
        >
          <option value="">+ Fit a weapon…</option>
          {unused.map((w) => (
            <option key={w.id} value={w.id}>
              {w.displayName || w.id} ({w.id})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function RectField(p: FieldProps): ReactNode {
  const { def, rec } = p
  if (def.kind !== 'rect') return null
  const raw = ci(rec, def.key)
  const arr = Array.isArray(raw) ? raw : []
  const labels = ['x', 'y', 'w', 'h']
  const problem = def.float ? floatProblem : intProblem
  const set = (i: number, t: string) => {
    const next = [0, 1, 2, 3].map((j) => (j === i ? Number(t || '0') : Number(arr[j] ?? 0)))
    commit(p, next, false)
  }
  return (
    <span className="rect">
      {labels.map((l, i) => (
        <label key={l}>
          {l} <CommitInput className="num" value={arr[i] === undefined ? '' : String(arr[i])} invalid={problem} ariaLabel={`${def.label} ${l}`} onCommit={(t) => set(i, t)} />
        </label>
      ))}
      {raw !== undefined && !def.required && (
        <button className="link" onClick={() => commit(p, undefined, true)}>
          clear
        </button>
      )}
    </span>
  )
}

function PointField(p: FieldProps): ReactNode {
  const { def, rec } = p
  const raw = ci(rec, def.key)
  const arr = Array.isArray(raw) ? raw : []
  const set = (i: number, t: string) => commit(p, [0, 1].map((j) => (j === i ? parseInt(t || '0', 10) : Number(arr[j] ?? 0))), false)
  return (
    <span className="rect">
      {['x', 'y'].map((l, i) => (
        <label key={l}>
          {l} <CommitInput className="num" value={arr[i] === undefined ? '' : String(arr[i])} invalid={intProblem} ariaLabel={`${def.label} ${l}`} onCommit={(t) => set(i, t)} />
        </label>
      ))}
    </span>
  )
}

const CORNERS = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

/** A rect's four corners, in quad order. */
export function quadFromRect(rect: unknown): number[][] {
  const r = Array.isArray(rect) && rect.length === 4 ? rect.map((v) => Number(v) || 0) : [0, 0, 0, 0]
  const [x, y, w, h] = r
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h]
  ]
}

/** The corners a quad value holds, falling back to the rect's for any it lacks. */
export function quadPoints(raw: unknown, rect: unknown): number[][] {
  const base = quadFromRect(rect)
  return base.map((b, i) => {
    const pt = Array.isArray(raw) ? raw[i] : undefined
    return Array.isArray(pt) && pt.length === 2 ? [Number(pt[0]) || 0, Number(pt[1]) || 0] : b
  })
}

function QuadField(p: FieldProps): ReactNode {
  const { def, rec } = p
  const raw = ci(rec, def.key)
  if (raw === undefined || raw === null)
    return (
      <button className="link" onClick={() => commit(p, quadFromRect(ci(rec, 'rect')), false)}>
        Add corners (start from the rect)
      </button>
    )
  const pts = quadPoints(raw, ci(rec, 'rect'))
  const set = (i: number, axis: 0 | 1, t: string) => {
    const next = pts.map((pt) => [...pt])
    next[i][axis] = Number(t || '0')
    commit(p, next, false)
  }
  return (
    <div className="quad">
      {CORNERS.map((name, i) => (
        <span key={name} className="rect">
          <span className="muted quad-corner">{name}</span>
          <label>
            x <CommitInput className="num" value={String(pts[i][0])} invalid={floatProblem} ariaLabel={`${name} x`} onCommit={(t) => set(i, 0, t)} />
          </label>
          <label>
            y <CommitInput className="num" value={String(pts[i][1])} invalid={floatProblem} ariaLabel={`${name} y`} onCommit={(t) => set(i, 1, t)} />
          </label>
        </span>
      ))}
      <button className="link" onClick={() => commit(p, undefined, true)}>
        clear
      </button>
    </div>
  )
}

function ArtField(p: FieldProps): ReactNode {
  const { def, rec, c } = p
  if (def.kind !== 'art') return null
  const v = str(ci(rec, def.key))
  const sets = c.pack.manifest.artSets
  const problem = (t: string) => {
    if (t === '') return null
    if (sets.length === 0) return 'An art reference needs pack.json art_sets.'
    return parseArtRef(t, sets) ? null : `Use [<art set>:]<kind>/<id>, e.g. ${sets[0]}:${def.artKind}/some_id`
  }
  return (
    <>
      <CommitInput value={v} mono placeholder={sets.length ? `${sets[0]}:${def.artKind}/<id>` : '(needs art_sets)'} invalid={problem} ariaLabel={def.label} onCommit={(t) => commit(p, t, t === '')} />
      {v === '' && <small className="muted"> Blank: pictures are looked up by this row's own id.</small>}
    </>
  )
}

function FileField(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'file') return null
  const v = str(ci(rec, def.key))
  const [set] = splitArtRef(v)
  const files = c.doc.otherFiles().filter((f) => def.extensions.some((ext) => f.toLowerCase().endsWith('.' + ext)))
  const importFile = async () => {
    const picked = await window.api.pickFiles(`Add a picture for ${def.label}`, def.extensions)
    if (!picked.length) return
    const f = picked[0]
    const target = f.name
    c.doc.edit(`Add ${target}`, (e) => {
      e.setFile(target, f.bytes)
      e.set(file, [...path, def.key], target)
    })
  }
  const artSets = c.pack.manifest.artSets
  const listId = `files-${path.join('-')}-${def.key}`
  return (
    <span className="file-field">
      {def.allowArtSet && artSets.length > 0 ? (
        <>
          <CommitInput value={v} list={listId} mono ariaLabel={def.label} onCommit={(t) => commit(p, t, t === '')} />
          <datalist id={listId}>
            {files.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </>
      ) : (
        <select aria-label={def.label} value={v} onChange={(e) => commit(p, e.target.value, e.target.value === '')}>
          <option value="">—</option>
          {v !== '' && !files.includes(v) && <option value={v}>{v} {set ? '(art set)' : '(missing)'}</option>}
          {files.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      )}
      <button onClick={() => void importFile()}>Add picture…</button>
      {def.preview && v !== '' && (
        <Thumb src={v} version={c.doc.version} alt={def.label} frames={def.preview === 'strip' ? gdInt(ci(rec, 'frames') ?? 1) : 1} />
      )}
    </span>
  )
}

/** A small preview of a pack picture or an art-set one; for a strip of frames, its first frame. */
function Thumb(props: { src: string; version: number; alt: string; frames?: number }): ReactNode {
  const { image, missing } = useImage(props.src, props.version)
  if (!image) return missing ? <span className="muted">not found</span> : null
  const n = Math.max(1, props.frames ?? 1)
  if (n === 1) return <img className="file-thumb" src={image.url} alt={props.alt} title={`${image.width}×${image.height}`} />
  const w = image.width / n
  return (
    <span
      className="file-thumb strip"
      role="img"
      aria-label={props.alt}
      title={`${n} frames of ${Math.round(w)}×${image.height}`}
      style={{ backgroundImage: `url(${image.url})`, backgroundSize: `${n * 100}% 100%`, aspectRatio: `${w} / ${image.height}` }}
    />
  )
}

/** A record's own id: renaming it rewrites every reference (the "Used by" list). */
function IdField(p: FieldProps): ReactNode {
  const { def, rec, c, file, path } = p
  if (def.kind !== 'id') return null
  const cur = str(ci(rec, def.key))
  if (def.readonly) return <code className="mono">{cur}</code>
  const onCommit = async (t: string) => {
    const next: unknown = def.numeric ? parseInt(t, 10) : t
    if (def.refKind) {
      const n = findUsages(c.doc, def.refKind, cur).length
      if (n > 0) {
        const ok = await confirmDialog('Rename everywhere?', `'${cur}' is used in ${n} place${n === 1 ? '' : 's'}. Rename it to '${t}' in all of them?`, 'Rename')
        if (!ok) return
      }
    }
    c.doc.edit(`Rename ${cur} → ${t}`, (e) => {
      if (def.refKind) renameUsages(c.doc, e, def.refKind, cur, t)
      e.set(file, [...path, def.key], next)
    })
  }
  return (
    <CommitInput
      value={cur}
      mono
      ariaLabel={def.label}
      invalid={(t) =>
        t.trim() === '' ? 'An id cannot be empty.' : def.numeric ? intProblem(t) : /[:.\s]/.test(t) ? "Ids may not contain ':', '.' or spaces." : null
      }
      onCommit={(t) => void onCommit(t)}
    />
  )
}

export function FieldGroup(props: { c: Ctx; file: PackJsonFile; path: JSONPath; rec: Dict; fields: FieldDef[] }): ReactNode {
  return (
    <div className="form-grid">
      {props.fields.map((f) => (
        <FieldView key={f.key} c={props.c} file={props.file} path={props.path} rec={props.rec} def={f} />
      ))}
    </div>
  )
}
