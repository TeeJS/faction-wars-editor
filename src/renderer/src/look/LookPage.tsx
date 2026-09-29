// The Look page (Display → Look): the pack's look.json - its colours, faces,
// sizes, corners and the dim behind a dialog - chosen on mock-ups of the game's
// windows, and drawn by the game itself on request. Every change is a pack
// change: Undo, Save, Save As and Export treat look.json like any other file,
// and the Problems panel says what the game would (rule 31).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createLook, editLook, lookPack } from '@core/look/pack'
import type { LookFile } from '@core/look/lookfile'
import { KNOWN_LOOK_COLORS, type ColorToken } from '@core/look/vocab'
import { store, useStore } from '../store'
import { ColorsPanel, type Hover } from './colors'
import { Settings } from './settings'
import { StartLook } from './start'
import { RenderTab, type RenderView } from './render'
import { Stage, WindowList } from './mock/stage'
import { WINDOWS } from './mock/windows'
import { useEnvFor } from './mock/env'
import './look.css'

/** One undoable change to the look (`label` names it for Undo), with any files it brings. */
export type LookEdit = (label: string, fn: (l: LookFile) => void, files?: [string, Uint8Array][]) => void

type Tab = 'windows' | 'colours' | 'settings' | 'game'
const TABS: [Tab, string][] = [
  ['windows', 'Windows'],
  ['colours', 'Colours and contrast'],
  ['settings', 'Faces, sizes and corners'],
  ['game', 'In the game']
]

// Kept while the editor runs, so leaving the page and coming back finds it as
// it was; the game's pictures only for the pack they are of.
const kept: { tab: Tab; windowId: string; render: RenderView | null; doc: unknown } = { tab: 'windows', windowId: WINDOWS[0].id, render: null, doc: null }

export function LookPage(): ReactNode {
  const s = useStore()
  const doc = s.doc!
  if (kept.doc !== doc) {
    kept.doc = doc
    kept.render = null
  }
  const version = doc.version
  const packDir = s.source.folder ?? undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pack = useMemo(() => lookPack(doc, packDir), [doc, version, packDir])
  const [tab, setTabState] = useState<Tab>(kept.tab)
  const [windowId, setWindowState] = useState(kept.windowId)
  const [renderView, setRenderState] = useState<RenderView | null>(kept.render)
  const [hover, setHover] = useState<Hover | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<number | undefined>(undefined)
  const env = useEnvFor(pack)
  const entry = WINDOWS.find((w) => w.id === windowId) ?? WINDOWS[0]
  const problems = s.issues.filter((i) => i.target?.page === 'look')

  const setTab = (t: Tab) => setTabState((kept.tab = t))
  const setWindowId = (id: string) => setWindowState((kept.windowId = id))
  const setRenderView = (v: RenderView | null) => setRenderState((kept.render = v))

  const edit: LookEdit = useCallback((label, fn, files) => void editLook(doc, label, fn, files), [doc])
  const create = (label: string, value: Record<string, unknown>, note?: string) => {
    createLook(doc, label, value)
    if (note) store.notify('info', note)
  }

  const goTo = useCallback((key: string, elementId: string) => {
    setFlash(key)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 1800)
    requestAnimationFrame(() => document.getElementById(elementId)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }, [])
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])

  return (
    <div className="look-page">
      <div className="look-tabs" role="tablist" aria-label="Look">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {problems.length > 0 && (
        <div className="panel look-problems" role="alert">
          <h2>The game will not load this look</h2>
          <p className="muted small">Word for word what the game reports:</p>
          <ul>
            {problems.map((p, i) => (
              <li key={i}>
                <code>{p.message}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!pack.look && <StartLook pack={pack} onCreate={create} />}

      {tab === 'windows' && pack.look && env && (
        <div className="windows-view">
          <WindowList selected={entry.id} onSelect={setWindowId} />
          <Stage
            entry={entry}
            env={env}
            revision={version}
            highlight={hover}
            onPickToken={(t: ColorToken) => goTo(t, `color-${t}`)}
            onPickSide={(id) => goTo(`side:${id}`, `side-${id}`)}
          />
          <div className="color-column">
            <ColorsPanel look={pack.look} factions={pack.factions} edit={edit} compact onHover={setHover} flash={flash} />
          </div>
        </div>
      )}

      {tab === 'colours' && pack.look?.value && (
        <div className="content">
          <div className="section-head">
            <h2>Colours</h2>
            <span className="muted small">Pick with the swatch or type a hex. All {KNOWN_LOOK_COLORS.length} are required.</span>
          </div>
          <ColorsPanel look={pack.look} factions={pack.factions} edit={edit} />
        </div>
      )}

      {tab === 'settings' && pack.look?.value && (
        <div className="content">
          <Settings look={pack.look} pack={pack} env={env} edit={edit} />
        </div>
      )}

      {tab === 'game' && pack.look && <RenderTab pack={pack} files={() => doc.allFiles()} revision={version} view={renderView} setView={setRenderView} />}
    </div>
  )
}
