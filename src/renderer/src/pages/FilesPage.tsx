// Every file the pack carries: the 12 JSON files (with a whole-file raw editor)
// and the author's own pictures and extras. Pictures for a record go where the
// game looks for them (art/<kind>/<id>.png and friends).

import { useState, type ReactNode } from 'react'
import { PACK_JSON_FILES, type PackJsonFile } from '../../../core/vocab'
import { store, useStore } from '../store'
import { confirmDialog, formDialog, promptDialog } from '../ui/Modal'
import { useImage } from '../ui/useImage'
import { RawFile } from './RawJson'

const IMAGE = /\.(png|jpe?g|bmp|webp|gif)$/i

/** Where the game looks for a row's pictures (artwork.gd). */
const SLOTS: { value: string; label: string; path: (kind: string, id: string) => string; size?: string }[] = [
  { value: 'encyclopedia', label: 'Encyclopedia picture', path: (k, id) => `art/${k}/${id}.png` },
  { value: 'portrait', label: 'Portrait', path: (k, id) => `art/portraits/${k}/${id}.png`, size: '80×80' },
  { value: 'miniature', label: 'Miniature', path: (k, id) => `art/miniatures/${k}/${id}.png`, size: '61×25' },
  { value: 'mission', label: 'Mission picture (per skin)', path: (_k, id) => `art/missions/${id}.<skin>.png`, size: '130×65 for .small' }
]

function size(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`
}

export function FilesPage(): ReactNode {
  const s = useStore()
  const doc = s.doc!
  const [sel, setSel] = useState<string | null>(null)
  const changed = new Set(doc.changedPaths())
  const others = doc.otherFiles()

  const addFiles = async () => {
    const picked = await window.api.pickFiles('Add files to the pack', [])
    if (!picked.length) return
    const v = await promptDialog('Where in the pack?', 'Folder inside the pack (blank = the top)', 'art', (t) => (/\.\.|:|^\//.test(t) ? 'A plain relative folder, e.g. art/units' : null))
    if (v === null) return
    const dir = v.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    doc.edit(`Add ${picked.length} file(s)`, (e) => {
      for (const f of picked) e.setFile(dir ? `${dir}/${f.name}` : f.name, f.bytes)
    })
    store.notify('success', `Added ${picked.length} file(s).`)
  }

  const addForRecord = async () => {
    const kinds = [
      { kind: 'characters', list: s.pack!.characters },
      { kind: 'units', list: s.pack!.units },
      { kind: 'facilities', list: s.pack!.facilities },
      { kind: 'missions', list: s.pack!.missions },
      { kind: 'planets', list: s.pack!.planets }
    ]
    const v = await formDialog(
      'Add a picture for a record',
      [
        { key: 'kind', label: 'Kind (characters, units, facilities, missions, planets)', value: 'units', validate: (t) => (kinds.some((k) => k.kind === t) ? null : 'One of the five kinds.') },
        {
          key: 'id',
          label: 'Record id',
          value: '',
          validate: (t, all) => (kinds.find((k) => k.kind === all.kind)?.list.some((r) => r.id === t) ? null : `No ${all.kind} record has that id.`)
        },
        { key: 'slot', label: 'Slot (encyclopedia, portrait, miniature, mission)', value: 'encyclopedia', validate: (t) => (SLOTS.some((x) => x.value === t) ? null : 'encyclopedia, portrait, miniature or mission') }
      ],
      'The game looks in the pack\'s own art/ folder before any art set. Only pictures you own belong in a pack.',
      'Choose picture…'
    )
    if (!v) return
    const slot = SLOTS.find((x) => x.value === v.slot)!
    let target = slot.path(v.kind, v.id)
    if (target.includes('<skin>')) {
      const skin = await promptDialog('Which skin?', 'Skin (a faction skin, or the faction id)', s.pack!.factions[0]?.skin || s.pack!.factions[0]?.id || '')
      if (!skin) return
      target = target.replace('<skin>', skin)
    }
    const picked = await window.api.pickFiles(`Picture for ${v.kind}/${v.id}`, ['png'])
    if (!picked.length) return
    doc.edit(`Add ${target}`, (e) => e.setFile(target, picked[0].bytes))
    setSel(target)
    store.notify('success', `Added ${target}${slot.size ? ` (expected ${slot.size})` : ''}.`)
  }

  const rename = async (p: string) => {
    const v = await promptDialog('Rename file', 'New path inside the pack', p, (t) =>
      !t || /\.\.|:|^\//.test(t) ? 'A plain relative path.' : t !== p && doc.hasFile(t) ? 'A file already has that path.' : null
    )
    if (!v || v === p) return
    doc.edit(`Rename ${p}`, (e) => e.renameFile(p, v))
    setSel(v)
  }

  const replace = async (p: string) => {
    const picked = await window.api.pickFiles(`Replace ${p}`, [])
    if (!picked.length) return
    doc.edit(`Replace ${p}`, (e) => e.setFile(p, picked[0].bytes))
  }

  const remove = async (p: string) => {
    if (!(await confirmDialog('Remove file', `Remove ${p} from the pack? (Undo brings it back until you save.)`, 'Remove', true))) return
    doc.edit(`Remove ${p}`, (e) => e.removeFile(p))
    setSel(null)
  }

  const isJson = sel !== null && (PACK_JSON_FILES as readonly string[]).includes(sel)
  return (
    <div className="list-page">
      <aside className="record-list" aria-label="Files">
        <div className="record-list-tools">
          <button onClick={() => void addFiles()}>+ Files…</button>
          <button onClick={() => void addForRecord()}>+ Picture for a record…</button>
        </div>
        <div className="record-list-items">
          <div className="group-label">pack files</div>
          {PACK_JSON_FILES.map((f) => {
            const t = doc.text(f)
            return (
              <button key={f} className={`record ${sel === f ? 'selected' : ''}`} onClick={() => setSel(f)}>
                <span className="record-name mono">{f}</span>
                <span className="record-id">{t ? `${size(t.toBytes().length)}${changed.has(f) ? ' · changed' : ''}` : 'MISSING'}</span>
              </button>
            )
          })}
          <div className="group-label">other files ({others.length})</div>
          {others.map((p) => (
            <button key={p} className={`record ${sel === p ? 'selected' : ''}`} onClick={() => setSel(p)}>
              <span className="record-name mono">{p}</span>
              <span className="record-id">
                {size(doc.fileBytes(p)?.length ?? 0)}
                {changed.has(p) ? ' · changed' : ''}
                {p.toLowerCase().endsWith('.import') || p.toLowerCase().endsWith('.uid') ? ' · not exported' : ''}
                {p.toLowerCase().startsWith('original/') ? ' · BLOCKS EXPORT' : ''}
              </span>
            </button>
          ))}
          {doc.removedPaths().length > 0 && <div className="group-label">removed on next save: {doc.removedPaths().join(', ')}</div>}
        </div>
      </aside>
      <section className="record-detail">
        {sel === null ? (
          <div className="muted">
            <p>Choose a file. Pack JSON files can be edited raw here; pictures can be previewed, replaced, renamed or removed.</p>
            <p>
              A zip export leaves out Godot's <code>.import</code>/<code>.uid</code> sidecars and refuses anything under <code>original/</code> or identical to a picture in your art
              set.
            </p>
          </div>
        ) : isJson ? (
          <>
            <header className="record-head">
              <h2 className="mono">{sel}</h2>
            </header>
            {doc.text(sel as PackJsonFile) ? (
              <RawFile key={`${sel}-${doc.version}`} file={sel as PackJsonFile} />
            ) : (
              <button className="primary" onClick={() => doc.edit(`Create ${sel}`, (e) => e.ensureJson(sel as PackJsonFile))}>
                Create {sel}
              </button>
            )}
          </>
        ) : doc.hasFile(sel) ? (
          <FileDetail path={sel} onRename={() => void rename(sel)} onReplace={() => void replace(sel)} onRemove={() => void remove(sel)} />
        ) : (
          <p className="muted">That file is no longer in the pack.</p>
        )}
      </section>
    </div>
  )
}

function FileDetail(props: { path: string; onRename: () => void; onReplace: () => void; onRemove: () => void }): ReactNode {
  const s = useStore()
  const bytes = s.doc!.fileBytes(props.path)
  const { image } = useImage(IMAGE.test(props.path) ? props.path : null, s.doc!.version)
  const text = !IMAGE.test(props.path) && bytes && bytes.length < 200_000 ? new TextDecoder().decode(bytes) : null
  return (
    <>
      <header className="record-head">
        <h2 className="mono">{props.path}</h2>
        <div className="record-actions">
          <button onClick={props.onRename}>Rename…</button>
          <button onClick={props.onReplace}>Replace…</button>
          <button className="danger" onClick={props.onRemove}>
            Remove
          </button>
        </div>
      </header>
      <p className="muted">{size(bytes?.length ?? 0)}</p>
      {image && (
        <figure className="preview">
          <img src={image.url} alt={props.path} />
          <figcaption>
            {image.width} × {image.height}
          </figcaption>
        </figure>
      )}
      {text !== null && <pre className="mono text-preview">{text}</pre>}
    </>
  )
}
