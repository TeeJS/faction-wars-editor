// Editors for the shapes a plain field cannot express: the rule and side-lottery
// matrices, logistics entries (with the carrier slot), and fixed_range.

import type { ReactNode } from 'react'
import type { JSONPath } from '../../../core/jsontext'
import { ci, isDict } from '../../../core/model'
import { KNOWN_DIFFICULTIES } from '../../../core/vocab'
import { CommitInput, RowButtons } from './fields'
import type { Dict, FieldProps } from './types'

const intProblem = (v: string) => (v.trim() === '' || /^-?\d+$/.test(v.trim()) ? null : `'${v}' is not a whole number.`)
const n = (v: unknown) => (typeof v === 'number' ? String(v) : v === undefined || v === null ? '' : String(v))

/** rules.json by_faction: { faction: { easy, medium, hard } } */
export function RuleMatrix(p: FieldProps): ReactNode {
  const { c, file, path, rec } = p
  const bf = ci(rec, 'by_faction')
  const obj = isDict(bf) ? bf : {}
  const factions = c.pack.factions.map((f) => f.id)
  const extra = Object.keys(obj).filter((k) => !factions.includes(k))
  const set = (f: string, d: string, t: string) =>
    c.doc.edit(`Edit ${f} ${d}`, (e) => (t.trim() === '' ? e.remove(file, [...path, 'by_faction', f, d]) : e.set(file, [...path, 'by_faction', f, d], parseInt(t, 10))))
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>side</th>
          {KNOWN_DIFFICULTIES.map((d) => (
            <th key={d}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...factions, ...extra].map((f) => {
          const row = ci(obj, f)
          return (
            <tr key={f} className={factions.includes(f) ? '' : 'bad'} title={factions.includes(f) ? '' : 'Not a faction id'}>
              <td className="mono">{f}</td>
              {KNOWN_DIFFICULTIES.map((d) => (
                <td key={d}>
                  <CommitInput className={`num ${isDict(row) && typeof ci(row, d) === 'number' ? '' : 'missing'}`} value={isDict(row) ? n(ci(row, d)) : ''} placeholder="missing" invalid={intProblem} ariaLabel={`${f} ${d}`} onCommit={(t) => set(f, d, t)} />
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** setup.json side_lottery by_faction: { perspective: { difficulty: { faction: n } } } */
export function LotteryMatrix(p: FieldProps): ReactNode {
  const { c, file, path, rec } = p
  const bf = ci(rec, 'by_faction')
  const obj = isDict(bf) ? bf : {}
  const factions = c.pack.factions.map((f) => f.id)
  const set = (persp: string, d: string, f: string, t: string) =>
    c.doc.edit(`Edit ${persp}/${d}/${f}`, (e) =>
      t.trim() === '' ? e.remove(file, [...path, 'by_faction', persp, d, f]) : e.set(file, [...path, 'by_faction', persp, d, f], parseInt(t, 10))
    )
  return (
    <div className="matrix-stack">
      {factions.map((persp) => (
        <table key={persp} className="grid">
          <caption>
            as seen by <code>{persp}</code>
          </caption>
          <thead>
            <tr>
              <th>difficulty</th>
              {factions.map((f) => (
                <th key={f} className="mono">
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KNOWN_DIFFICULTIES.map((d) => {
              const cells = ci(ci(obj, persp), d)
              return (
                <tr key={d}>
                  <td>{d}</td>
                  {factions.map((f) => (
                    <td key={f}>
                      <CommitInput
                        className={`num ${isDict(cells) && typeof ci(cells, f) === 'number' ? '' : 'missing'}`}
                        value={isDict(cells) ? n(ci(cells, f)) : ''}
                        placeholder="missing"
                        invalid={intProblem}
                        ariaLabel={`${persp} ${d} ${f}`}
                        onCommit={(t) => set(persp, d, f, t)}
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      ))}
    </div>
  )
}

export function FixedRange(p: FieldProps): ReactNode {
  const { c, file, path, rec } = p
  const v = ci(rec, 'fixed_range')
  const arr = Array.isArray(v) ? v : null
  const rules = c.pack.rules.map((r) => ({ id: Number(ci(r, 'EntryId')), name: String(ci(r, 'Name') ?? '') }))
  const name = (id: unknown) => rules.find((r) => r.id === Number(id))?.name
  if (!arr)
    return (
      <span>
        <span className="muted">Random band (no fixed range). </span>
        <button className="link" onClick={() => c.doc.edit('Add fixed range', (e) => e.set(file, [...path, 'fixed_range'], [84, 85]))}>
          Use a fixed range
        </button>
      </span>
    )
  return (
    <span className="pair">
      {[0, 1].map((i) => (
        <label key={i} title={name(arr[i]) ?? 'No such rule'}>
          {i === 0 ? 'first' : 'max'}{' '}
          <CommitInput className="num" value={n(arr[i])} invalid={intProblem} ariaLabel={i === 0 ? 'first rule' : 'max rule'} onCommit={(t) => c.doc.edit('Edit fixed range', (e) => e.set(file, [...path, 'fixed_range', i], parseInt(t || '0', 10)))} />
          <small className="muted"> {name(arr[i]) ?? '(no such rule)'}</small>
        </label>
      ))}
      <button className="link" onClick={() => c.doc.edit('Remove fixed range', (e) => e.remove(file, [...path, 'fixed_range']))}>
        use a random band
      </button>
    </span>
  )
}

type Asset = Dict | null

function assetValue(a: Asset): string {
  if (a === null || !isDict(a)) return ''
  const u = ci(a, 'unit')
  const f = ci(a, 'facility')
  return u !== undefined ? `unit:${String(u)}` : f !== undefined ? `facility:${String(f)}` : '?'
}

function AssetSelect(props: { value: Asset; onChange: (a: Asset) => void; label: string; p: FieldProps }): ReactNode {
  const { c } = props.p
  const cur = assetValue(props.value)
  const known = [...c.pack.units.map((u) => `unit:${u.id}`), ...c.pack.facilities.map((f) => `facility:${f.id}`)]
  return (
    <select
      aria-label={props.label}
      value={cur}
      onChange={(e) => {
        const v = e.target.value
        if (v === '') props.onChange(null)
        else {
          const [kind, id] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)]
          props.onChange({ [kind]: id })
        }
      }}
    >
      <option value="">— empty slot</option>
      {cur !== '' && !known.includes(cur) && <option value={cur}>{cur} (not declared)</option>}
      <optgroup label="Units">
        {c.pack.units.map((u) => (
          <option key={u.id} value={`unit:${u.id}`}>
            {u.displayName || u.id} ({u.kind})
          </option>
        ))}
      </optgroup>
      <optgroup label="Facilities (places tier 1 of the family)">
        {c.pack.facilities.map((f) => (
          <option key={f.id} value={`facility:${f.id}`}>
            {f.displayName || f.id}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

/** logistics[table].Entries: flat rows (Asset) or hierarchical rows (Assets: carrier slot + payload). */
export function LogisticsEntries(p: FieldProps): ReactNode {
  const { c, file, path, rec } = p
  const flat = String(ci(rec, 'Type') ?? '').includes('SYFC')
  const raw = ci(rec, 'Entries')
  const entries = Array.isArray(raw) ? raw : []
  const base: JSONPath = [...path, 'Entries']
  const edit = (label: string, fn: Parameters<typeof c.doc.edit>[1]) => c.doc.edit(label, fn)
  const num = (i: number, key: string, label: string, e: Dict) => (
    <label>
      {label}{' '}
      <CommitInput
        className="num"
        value={n(ci(e, key))}
        invalid={intProblem}
        ariaLabel={`${label} ${i + 1}`}
        onCommit={(t) => edit(`Edit ${label}`, (ed) => (t.trim() === '' ? ed.remove(file, [...base, i, key]) : ed.set(file, [...base, i, key], parseInt(t, 10))))}
      />
    </label>
  )
  return (
    <div className="list-field">
      <p className="muted">
        {flat
          ? 'Flat: each row may place one facility in a system (SpawnChancePercent).'
          : 'Hierarchical: Assets[0] is the carrier slot (keep an empty slot where there is no carrier - positions matter), then its payload.'}
      </p>
      {entries.map((e, i) => {
        if (!isDict(e)) return <div key={i} className="bad">Entry {i + 1} is not an object.</div>
        const assets = ci(e, 'Assets')
        const list: Asset[] = Array.isArray(assets) ? (assets as Asset[]) : []
        return (
          <div key={i} className="list-item">
            <div className="list-item-head">
              <strong>Entry {i + 1}</strong>
              <RowButtons
                index={i}
                count={entries.length}
                onMove={(to) => edit('Move entry', (ed) => ed.move(file, base, i, to))}
                onDuplicate={() => edit('Duplicate entry', (ed) => ed.insert(file, base, i + 1, e))}
                onRemove={() => edit('Remove entry', (ed) => ed.remove(file, [...base, i]))}
              />
            </div>
            <div className="entry-row">
              {num(i, 'ParentId', 'ParentId', e)}
              {num(i, 'ProbabilityThreshold', 'Threshold', e)}
              {flat ? num(i, 'SpawnChancePercent', 'Spawn %', e) : num(i, 'Multiplier', 'Multiplier', e)}
              {!flat && num(i, 'ChildrenCount', 'ChildrenCount', e)}
            </div>
            {flat ? (
              <div className="entry-row">
                <AssetSelect label={`Asset ${i + 1}`} p={p} value={(ci(e, 'Asset') as Asset) ?? null} onChange={(a) => edit('Edit asset', (ed) => ed.set(file, [...base, i, 'Asset'], a))} />
              </div>
            ) : (
              <div className="assets">
                {list.map((a, j) => (
                  <div key={j} className="entry-row">
                    <span className="ordinal">{j === 0 ? 'carrier' : j}</span>
                    <AssetSelect label={`Entry ${i + 1} asset ${j}`} p={p} value={a} onChange={(v) => edit('Edit asset', (ed) => ed.set(file, [...base, i, 'Assets', j], v))} />
                    <RowButtons
                      index={j}
                      count={list.length}
                      onMove={(to) => edit('Move asset', (ed) => ed.move(file, [...base, i, 'Assets'], j, to))}
                      onRemove={() => edit('Remove asset', (ed) => ed.remove(file, [...base, i, 'Assets', j]))}
                    />
                  </div>
                ))}
                <button
                  onClick={() =>
                    edit('Add asset', (ed) =>
                      ed.insert(file, [...base, i, 'Assets'], list.length, list.length === 0 ? null : c.pack.units[0] ? { unit: c.pack.units[0].id } : null)
                    )
                  }
                >
                  + Asset
                </button>
              </div>
            )}
          </div>
        )
      })}
      <div className="row-actions">
        <button
          onClick={() =>
            edit('Add entry', (ed) =>
              ed.insert(
                file,
                base,
                entries.length,
                flat
                  ? { ParentId: entries.length + 1, ProbabilityThreshold: 0, SpawnChancePercent: 0, Asset: null }
                  : { ParentId: entries.length + 1, ProbabilityThreshold: 0, Multiplier: 1, ChildrenCount: 1, Assets: [null] }
              )
            )
          }
        >
          + Entry
        </button>
      </div>
    </div>
  )
}
