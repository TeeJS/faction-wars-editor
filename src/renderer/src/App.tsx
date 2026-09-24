import { useEffect, useState, type ReactNode } from 'react'
import type { RecentEntry } from '../../preload/api'
import * as actions from './actions'
import { LIST_PAGES } from './forms/pages'
import { FilesPage } from './pages/FilesPage'
import { ListPage } from './pages/ListPage'
import { MapPage } from './pages/MapPage'
import { MenuPage } from './pages/MenuPage'
import { DisplaySettingsPage, PackPage } from './pages/PackPage'
import { store, useStore } from './store'
import { DialogHost } from './ui/Modal'

const NAV: { group: string; items: { page: string; label: string }[] }[] = [
  {
    group: 'Pack',
    items: [
      { page: 'pack', label: 'Pack' },
      { page: 'menu', label: 'Cockpit Menu' },
      { page: 'factions', label: 'Factions' }
    ]
  },
  {
    group: 'Galaxy',
    items: [
      { page: 'map', label: 'Galaxy Map' },
      { page: 'sectors', label: 'Sectors' },
      { page: 'planets', label: 'Planets' }
    ]
  },
  {
    group: 'Roster',
    items: [
      { page: 'characters', label: 'Characters' },
      { page: 'units', label: 'Units' },
      { page: 'weapons', label: 'Weapons' },
      { page: 'facilities', label: 'Facilities' }
    ]
  },
  {
    group: 'Missions',
    items: [
      { page: 'missions', label: 'Missions' },
      { page: 'missionTables', label: 'Mission Tables' }
    ]
  },
  {
    group: 'Rules & Setup',
    items: [
      { page: 'rules', label: 'Rules' },
      { page: 'sideLottery', label: 'Side Lottery' },
      { page: 'logistics', label: 'Logistics' }
    ]
  },
  {
    group: 'Display',
    items: [
      { page: 'gid', label: 'GID Modes' },
      { page: 'display', label: 'Display Settings' }
    ]
  },
  { group: 'Files', items: [{ page: 'files', label: 'Files & Art' }] }
]

export function App(): ReactNode {
  const s = useStore()

  useEffect(() => {
    const off = window.api.onMenu((a) => {
      const inField = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
      switch (a) {
        case 'new':
          return void actions.newPack()
        case 'openFolder':
          return void actions.openFolder()
        case 'openZip':
          return void actions.openZip()
        case 'save':
          ;(document.activeElement as HTMLElement | null)?.blur()
          return void setTimeout(() => void actions.save(), 0)
        case 'saveAs':
          ;(document.activeElement as HTMLElement | null)?.blur()
          return void setTimeout(() => void actions.saveAs(), 0)
        case 'export':
          ;(document.activeElement as HTMLElement | null)?.blur()
          return void setTimeout(() => void actions.exportZip(), 0)
        case 'undo':
          // In a text box, undo is the text box's; otherwise it is the pack's.
          if (inField) return void document.execCommand('undo')
          return actions.undo()
        case 'redo':
          if (inField) return void document.execCommand('redo')
          return actions.redo()
        case 'validate':
          return store.validateNow()
      }
    })
    return off
  }, [])

  return (
    <div className="app">
      <Toolbar />
      {s.doc ? (
        <div className="workspace">
          <Nav />
          <main className="page" aria-label={s.page}>
            <Page page={s.page} />
          </main>
        </div>
      ) : (
        <Welcome />
      )}
      {s.doc && <Problems />}
      <Notices />
      <DialogHost />
    </div>
  )
}

function Toolbar(): ReactNode {
  const s = useStore()
  const d = s.doc
  const errors = s.issues.filter((i) => i.severity === 'error').length
  const warnings = s.issues.length - errors
  return (
    <header className="toolbar">
      <span className="brand">Faction Wars Pack Editor</span>
      <button onClick={() => void actions.newPack()}>New</button>
      <button onClick={() => void actions.openFolder()}>Open Folder</button>
      <button onClick={() => void actions.openZip()}>Open Zip</button>
      {d && (
        <>
          <span className="sep" />
          <button onClick={() => void actions.save()} className={d.dirty ? 'primary' : ''} title="Ctrl+S">
            Save
          </button>
          <button onClick={() => void actions.saveAs()}>Save As</button>
          <button onClick={() => void actions.exportZip()} title="Build the zip the game's Import button takes (Ctrl+E)">
            Export Zip
          </button>
          <span className="sep" />
          <button onClick={actions.undo} disabled={!d.canUndo} title={d.canUndo ? `Undo ${d.undoLabel}` : 'Nothing to undo'}>
            Undo
          </button>
          <button onClick={actions.redo} disabled={!d.canRedo} title={d.canRedo ? `Redo ${d.redoLabel}` : 'Nothing to redo'}>
            Redo
          </button>
          <span className="spacer" />
          <span className="pack-name" title={s.source.origin ?? 'unsaved'}>
            {d.dirty && <span className="dirty" aria-label="unsaved changes">●</span>} {d.packId || '(no id)'}
          </span>
          <button
            className={`status ${errors ? 'bad' : warnings ? 'warn' : 'good'}`}
            onClick={() => {
              store.showIssues = !store.showIssues
              store.emit()
            }}
            title="Show or hide the Problems panel"
          >
            {errors ? `${errors} error${errors === 1 ? '' : 's'}` : 'Valid'}
            {warnings ? ` · ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}
          </button>
        </>
      )}
    </header>
  )
}

function Nav(): ReactNode {
  const s = useStore()
  const count = (page: string) => s.issues.filter((i) => i.target?.page === page && i.severity === 'error').length
  return (
    <nav className="nav" aria-label="Pack sections">
      {NAV.map((g) => (
        <div key={g.group} className="nav-group">
          <div className="nav-label">{g.group}</div>
          {g.items.map((it) => {
            const n = count(it.page)
            return (
              <button key={it.page} className={`nav-item ${s.page === it.page ? 'on' : ''}`} aria-current={s.page === it.page ? 'page' : undefined} onClick={() => store.go(it.page)}>
                {it.label}
                {n > 0 && <span className="badge">{n}</span>}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function Page({ page }: { page: string }): ReactNode {
  switch (page) {
    case 'pack':
      return <PackPage />
    case 'menu':
      return <MenuPage />
    case 'map':
      return <MapPage />
    case 'display':
      return <DisplaySettingsPage />
    case 'files':
      return <FilesPage />
  }
  const def = LIST_PAGES.find((p) => p.page === page)
  return def ? <ListPage key={page} def={def} /> : <PackPage />
}

function Problems(): ReactNode {
  const s = useStore()
  if (!s.showIssues) return null
  const errors = s.issues.filter((i) => i.severity === 'error')
  const warnings = s.issues.filter((i) => i.severity === 'warning')
  return (
    <section className="problems" aria-label="Problems">
      <header>
        <strong>Problems</strong>
        <span className="muted">
          Errors are what the game's validator would say (the pack would not load). Warnings are things the engine needs that the validator does not check.
        </span>
        <span className="spacer" />
        <button
          className="icon"
          aria-label="Close"
          onClick={() => {
            store.showIssues = false
            store.emit()
          }}
        >
          ✕
        </button>
      </header>
      <ul>
        {[...errors, ...warnings].map((i, n) => (
          <li key={n} className={i.severity}>
            <button className="link" onClick={() => i.target && store.go(i.target.page, i.target.index ?? i.target.key)}>
              <span className="sev">{i.severity === 'error' ? 'Error' : 'Warning'}</span> {i.message}
            </button>
          </li>
        ))}
        {s.issues.length === 0 && <li className="good">No problems: the game would load this pack.</li>}
      </ul>
    </section>
  )
}

function Notices(): ReactNode {
  const s = useStore()
  return (
    <div className="notices" aria-live="polite">
      {s.notices.map((n) => (
        <div key={n.id} className={`notice ${n.kind}`} role={n.kind === 'error' ? 'alert' : 'status'}>
          <span>{n.text}</span>
          <button className="icon" aria-label="Dismiss" onClick={() => store.dismiss(n.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

function Welcome(): ReactNode {
  const [recent, setRecent] = useState<RecentEntry[]>([])
  useEffect(() => {
    void window.api.recent().then(setRecent)
  }, [])
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <h1>Faction Wars Pack Editor</h1>
        <p className="muted">Edit any faction pack, or build one from scratch. Save it as a folder; export the zip the game's pack picker imports.</p>
        <div className="welcome-actions">
          <button className="primary big" onClick={() => void actions.newPack()}>
            New pack
            <small>A valid, playable starter to grow from</small>
          </button>
          <button className="big" onClick={() => void actions.openFolder()}>
            Open a pack folder
            <small>The folder with pack.json in it</small>
          </button>
          <button className="big" onClick={() => void actions.openZip()}>
            Open a pack zip
            <small>An exported pack, or a zipped folder</small>
          </button>
        </div>
        {recent.length > 0 && (
          <div className="recent">
            <h2>Recent</h2>
            {recent.map((r) => (
              <button key={r.path} className="recent-item" onClick={() => void (r.kind === 'zip' ? actions.openZip(r.path) : actions.openFolder(r.path))}>
                <span>{r.name}</span>
                <code className="muted">{r.path}</code>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
