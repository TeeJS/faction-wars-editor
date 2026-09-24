// A list of records (a JSON array, or an object keyed by id) with the selected
// record's form, its "used by" list and a raw JSON tab.

import { useMemo, useState, type ReactNode } from 'react'
import type { JSONPath } from '../../../core/jsontext'
import { ci, isDict } from '../../../core/model'
import { findUsages, renameUsages } from '../../../core/refs'
import { FieldGroup, CommitInput } from '../forms/fields'
import type { Ctx, Dict, ListPageDef } from '../forms/types'
import { store, useStore } from '../store'
import { confirmDialog, promptDialog } from '../ui/Modal'
import { PicturesPanel } from './Pictures'
import { RawJson } from './RawJson'

interface Row {
  key: number | string
  rec: unknown
  id: string
  name: string
}

export function ListPage({ def }: { def: ListPageDef }): ReactNode {
  const s = useStore()
  const doc = s.doc!
  const pack = s.pack!
  const c: Ctx = { doc, pack }
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'form' | 'raw'>('form')

  const container = doc.get(def.file, def.listPath)
  const rows: Row[] = useMemo(() => {
    if (def.mode === 'array') {
      const arr = Array.isArray(container) ? container : []
      return arr.map((rec, i) => ({
        key: i,
        rec,
        id: String(ci(rec, def.idKey) ?? ''),
        name: def.nameKey ? String(ci(rec, def.nameKey) ?? '') : ''
      }))
    }
    const obj = isDict(container) ? container : {}
    // Keyed tables are known by their id (descriptions repeat across tables).
    return Object.keys(obj).map((k) => ({ key: k, rec: obj[k], id: k, name: '' }))
  }, [container, def])

  const selected = s.selection[def.page]
  const current = rows.find((r) => r.key === selected) ?? rows[0]
  const recPath: JSONPath | null = current ? [...def.listPath, current.key] : null

  const issueCount = (key: number | string) =>
    s.issues.filter((i) => i.target?.page === def.page && (def.mode === 'array' ? i.target.index === key : i.target.key === key)).length

  const q = filter.trim().toLowerCase()
  const visible = rows.filter((r) => !q || r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
  const groups = new Map<string, Row[]>()
  for (const r of visible) {
    const g = def.group && isDict(r.rec) ? def.group(r.rec, c) : ''
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(r)
  }

  const add = async () => {
    let id = def.newId ? def.newId(c) : ''
    if (def.mode === 'map') {
      const v = await promptDialog(`New ${def.title.replace(/s$/, '').toLowerCase()}`, 'Id', id, (t) =>
        !t.trim() ? 'An id is needed.' : rows.some((r) => r.id === t) ? 'That id is taken.' : null
      )
      if (!v) return
      id = v
    }
    const item = def.newItem(c, id)
    doc.edit(`Add ${def.title}`, (e) => {
      if (def.mode === 'array') {
        e.insert(def.file, def.listPath, rows.length, item)
        if (def.page === 'factions') e.set('pack.json', ['faction_count'], rows.length + 1)
      } else e.set(def.file, [...def.listPath, id], item)
    })
    store.select(def.page, def.mode === 'array' ? rows.length : id)
  }

  const duplicate = () => {
    if (!current || def.mode !== 'array' || !isDict(current.rec)) return
    const copy = structuredClone(current.rec) as Dict
    if (def.idKey && !def.numericId) {
      const taken = rows.map((r) => r.id)
      let n = 2
      while (taken.includes(`${current.id}_${n}`)) n++
      copy[Object.keys(copy).find((k) => k.toLowerCase() === def.idKey.toLowerCase()) ?? def.idKey] = `${current.id}_${n}`
    } else if (def.numericId) {
      copy[def.idKey] = Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1
    }
    doc.edit(`Duplicate ${current.id}`, (e) => {
      e.insert(def.file, def.listPath, (current.key as number) + 1, copy)
      if (def.page === 'factions') e.set('pack.json', ['faction_count'], rows.length + 1)
    })
    store.select(def.page, (current.key as number) + 1)
  }

  const remove = async () => {
    if (!current) return
    const usages = def.refKind ? findUsages(doc, def.refKind, current.id) : []
    const body =
      usages.length > 0 ? (
        <>
          <p>
            '{current.id}' is used in {usages.length} place{usages.length === 1 ? '' : 's'}; they will point at nothing (the validator will list them):
          </p>
          <ul className="plain">
            {usages.slice(0, 12).map((u, i) => (
              <li key={i}>{u.where}</li>
            ))}
            {usages.length > 12 && <li>…and {usages.length - 12} more</li>}
          </ul>
        </>
      ) : (
        `Delete '${current.id || current.key}'?`
      )
    if (!(await confirmDialog(`Delete ${current.id || current.key}`, body, 'Delete', true))) return
    doc.edit(`Delete ${current.id}`, (e) => {
      if (def.mode === 'array') {
        e.remove(def.file, [...def.listPath, current.key])
        if (def.page === 'factions') e.set('pack.json', ['faction_count'], rows.length - 1)
      } else e.remove(def.file, [...def.listPath, current.key])
    })
    if (def.mode === 'array') store.select(def.page, Math.max(0, (current.key as number) - 1))
    else store.select(def.page, undefined)
  }

  const move = (delta: number) => {
    if (!current || def.mode !== 'array') return
    const to = (current.key as number) + delta
    if (to < 0 || to >= rows.length) return
    if (def.orderNote) store.notify('info', def.orderNote)
    doc.edit(`Move ${current.id}`, (e) => e.move(def.file, def.listPath, current.key as number, to))
    store.select(def.page, to)
  }

  const renameMapKey = (next: string) => {
    if (!current || def.mode !== 'map') return
    doc.edit(`Rename ${current.id} → ${next}`, (e) => {
      if (def.refKind) renameUsages(doc, e, def.refKind, current.id, next)
      e.renameKey(def.file, def.listPath, current.id, next)
    })
    store.select(def.page, next)
  }

  const usages = current && def.refKind ? findUsages(doc, def.refKind, current.id) : []

  return (
    <div className="list-page">
      <aside className="record-list" aria-label={`${def.title} list`}>
        <div className="record-list-tools">
          <input type="search" placeholder={`Filter ${rows.length}…`} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter" />
          <button className="primary" onClick={() => void add()} title={`Add to ${def.title}`}>
            + Add
          </button>
        </div>
        <div className="record-list-items" role="listbox" aria-label={def.title}>
          {[...groups].map(([g, list]) => (
            <div key={g}>
              {g && <div className="group-label">{g}</div>}
              {list.map((r) => {
                const n = issueCount(r.key)
                const sub = def.subtitle && isDict(r.rec) ? def.subtitle(r.rec, c) : ''
                return (
                  <button
                    key={String(r.key)}
                    role="option"
                    aria-selected={current?.key === r.key}
                    className={`record ${current?.key === r.key ? 'selected' : ''}`}
                    onClick={() => store.select(def.page, r.key)}
                  >
                    <span className="record-name">{r.name || r.id || '(no id)'}</span>
                    <span className="record-id">
                      {r.name && r.id !== r.name ? r.id : ''}
                      {sub ? (r.name && r.id !== r.name ? ' · ' : '') + sub : ''}
                    </span>
                    {n > 0 && <span className="badge" title={`${n} problem${n === 1 ? '' : 's'}`}>{n}</span>}
                  </button>
                )
              })}
            </div>
          ))}
          {rows.length === 0 && <p className="muted pad">Nothing here yet. Add the first one.</p>}
        </div>
      </aside>

      <section className="record-detail">
        {def.intro && <p className="intro">{def.intro}</p>}
        {current && recPath ? (
          <>
            <header className="record-head">
              <div>
                <h2>{current.name || current.id || '(no id)'}</h2>
                {def.mode === 'map' ? (
                  <label className="inline">
                    <span className="muted">id</span>
                    <CommitInput
                      value={current.id}
                      mono
                      ariaLabel="Table id"
                      invalid={(t) => (!t.trim() ? 'An id is needed.' : t !== current.id && rows.some((r) => r.id === t) ? 'That id is taken.' : null)}
                      onCommit={renameMapKey}
                    />
                  </label>
                ) : (
                  <code className="muted">{def.idKey ? `${def.idKey}: ${current.id}` : ''}</code>
                )}
              </div>
              <div className="record-actions">
                {def.mode === 'array' && (
                  <>
                    <button onClick={() => move(-1)} disabled={(current.key as number) === 0} title={def.orderNote ?? 'Move up'}>
                      ↑
                    </button>
                    <button onClick={() => move(1)} disabled={(current.key as number) >= rows.length - 1} title={def.orderNote ?? 'Move down'}>
                      ↓
                    </button>
                    <button onClick={duplicate}>Duplicate</button>
                  </>
                )}
                <button className="danger" onClick={() => void remove()}>
                  Delete
                </button>
              </div>
            </header>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'form'} className={tab === 'form' ? 'on' : ''} onClick={() => setTab('form')}>
                Form
              </button>
              <button role="tab" aria-selected={tab === 'raw'} className={tab === 'raw' ? 'on' : ''} onClick={() => setTab('raw')}>
                Raw JSON
              </button>
            </div>
            {tab === 'form' ? (
              isDict(current.rec) ? (
                <>
                  {def.note?.(c, current.rec, current.key)}
                  {def.pictures && <PicturesPanel c={c} kind={def.pictures} rec={current.rec} />}
                  <FieldGroup c={c} file={def.file} path={recPath} rec={current.rec} fields={def.fields} />
                  {def.extra?.(c, current.rec, current.key)}
                </>
              ) : (
                <p className="bad">This entry is not an object; fix it in Raw JSON.</p>
              )
            ) : (
              <RawJson key={`${def.page}-${String(current.key)}`} file={def.file} path={recPath} value={current.rec} />
            )}
            {def.refKind && (
              <details className="usages" open={usages.length > 0 && usages.length <= 8}>
                <summary>
                  Used by {usages.length} place{usages.length === 1 ? '' : 's'}
                </summary>
                <ul className="plain">
                  {usages.map((u, i) => (
                    <li key={i}>
                      {u.where} <code className="muted">{u.file}</code>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : (
          <p className="muted">Select or add an entry.</p>
        )}
      </section>
    </div>
  )
}
