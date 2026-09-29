// The "In the game" tab: the look rendered by the game itself (its own capture
// scripts, run with Godot on a copy of the game), unsaved changes included.
// The mock-ups are for choosing; these are the proof. Optional: it needs Godot
// and a copy of the game's source, which the user points it at once; nothing
// else in the editor does.

import { useEffect, useState } from 'react'
import type { LookPack } from '@core/look/pack'
import type { RenderResult, RenderSettings, RenderSettingsState } from '../../../preload/api'

const CAPTIONS: Record<string, string> = {
  specimen: 'Specimen sheet: every shared piece',
  cockpit: 'Cockpit',
  cockpit_focus: 'Cockpit, keyboard focus on a launch plate',
  credits: 'Credits sheet',
  map: 'Map screen, a fresh game',
  message: 'Message Index',
  dialog: 'A dialog',
  finder: 'A finder',
  menu: 'Game Menu'
}

export interface RenderView {
  result: RenderResult
  urls: { name: string; url: string }[]
  /** Whether the look has changed since this render. */
  at: number
}

export function RenderTab(props: {
  pack: LookPack
  /** The pack's files as they stand, unsaved changes included. */
  files: () => { path: string; bytes: Uint8Array }[]
  revision: number
  view: RenderView | null
  setView: (v: RenderView | null) => void
}) {
  const { pack, files, revision, view, setView } = props
  const [state, setState] = useState<RenderSettingsState | null>(null)
  const [draft, setDraft] = useState<RenderSettings | null>(null)
  const [faction, setFaction] = useState(pack.factions[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [big, setBig] = useState<string | null>(null)

  useEffect(() => {
    void window.api.getRenderSettings().then((s) => {
      setState(s)
      setDraft(s.settings)
    })
  }, [])
  useEffect(() => window.api.onRenderProgress((line) => setLines((l) => [...l.slice(-40), line])), [])

  const saveSettings = async (s: RenderSettings) => {
    setDraft(s)
    setState(await window.api.setRenderSettings(s))
  }

  const render = async () => {
    if (!pack.look) return
    setBusy(true)
    setError(null)
    setLines([])
    try {
      const result = await window.api.render({ packId: pack.id, files: files().map((f) => [f.path, f.bytes] as [string, Uint8Array]), faction })
      const urls: { name: string; url: string }[] = []
      for (const s of result.shots) {
        const bytes = await window.api.renderImage(s.file)
        if (bytes) urls.push({ name: s.name, url: URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' })) })
      }
      view?.urls.forEach((u) => URL.revokeObjectURL(u.url))
      setView({ result, urls, at: revision })
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
    }
  }

  const stale = view !== null && view.at !== revision
  return (
    <div className="content render-tab">
      <div className="panel">
        <h2>The look, drawn by the game</h2>
        <p>
          The game's own capture scripts draw your look as it is now, unsaved changes included: every shared piece on one sheet, then the Cockpit, the
          Credits, the map screen, a message, a dialog, a finder and the Game Menu. A game window opens for a few seconds while each set is captured.
        </p>
        <p className="muted small">
          This needs Godot 4.7 (godotengine.org) and a copy of the game's source (github.com/TeeJS/faction-wars); point the editor at them once below.
          Nothing else in the editor uses them. The game folder is only read: a git checkout is exported with <code>git archive</code>, and the copy, its
          own save folder and the pictures stay in <code>{state?.cache ?? '…'}</code>.
        </p>
      </div>

      {draft && (
        <section className="group render-settings">
          <h3>Where Godot and the game are</h3>
          <label className="look-field">
            <span>Godot (the console executable)</span>
            <span className="look-field-row">
              <input type="text" aria-label="Godot" value={draft.godot} onChange={(e) => setDraft({ ...draft, godot: e.currentTarget.value })} onBlur={() => void saveSettings(draft)} />
              <button
                type="button"
                onClick={async () => {
                  const p = await window.api.pickGodot()
                  if (p) void saveSettings({ ...draft, godot: p })
                }}
              >
                Choose…
              </button>
            </span>
          </label>
          <label className="look-field">
            <span>The game (a git checkout, or the project folder)</span>
            <span className="look-field-row">
              <input type="text" aria-label="Game folder" value={draft.game} onChange={(e) => setDraft({ ...draft, game: e.currentTarget.value })} onBlur={() => void saveSettings(draft)} />
              <button
                type="button"
                onClick={async () => {
                  const p = await window.api.pickGame()
                  if (p) void saveSettings({ ...draft, game: p })
                }}
              >
                Choose…
              </button>
            </span>
          </label>
          <label className="look-field">
            <span>For a git checkout: the version to render</span>
            <input type="text" aria-label="Game version" value={draft.ref} placeholder="origin/main" onChange={(e) => setDraft({ ...draft, ref: e.currentTarget.value })} onBlur={() => void saveSettings(draft)} />
            <span className="muted small">A branch, tag or commit. The editor never fetches: origin/main is as new as your last fetch.</span>
          </label>
          {state?.problem && <p className="small below-text">{state.problem}</p>}
        </section>
      )}

      <div className="render-go">
        <label className="inline">
          Play the map screen as
          <select aria-label="Side for the map screen" value={faction} onChange={(e) => setFaction(e.currentTarget.value)}>
            {pack.factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name || f.id}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary" onClick={() => void render()} disabled={busy || !pack.look || !!state?.problem}>
          {busy ? 'Rendering…' : 'Render in the game'}
        </button>
        {view && (
          <span className={`small ${stale ? 'was' : 'muted'}`}>
            {stale ? 'The look has changed since this render. ' : ''}Rendered by the game at <code>{view.result.commit}</code> in {view.result.seconds} s.
          </span>
        )}
        {view && (
          <button type="button" className="link" onClick={() => void window.api.openRenderFolder(view.result.outDir)}>
            Open the pictures' folder
          </button>
        )}
      </div>

      {(busy || lines.length > 0) && (
        <pre className="render-log" aria-live="polite">
          {lines.slice(-12).join('\n') || 'Starting…'}
        </pre>
      )}
      {error && (
        <div className="panel problems" role="alert">
          <h2>The render did not finish</h2>
          <pre className="render-log">{error}</pre>
        </div>
      )}

      {view && (
        <div className="shots">
          {view.urls.map((u) => (
            <figure key={u.name} className="shot" data-shot={u.name}>
              <button type="button" className="shot-button" onClick={() => setBig(u.url)} aria-label={`Show ${CAPTIONS[u.name] ?? u.name} full size`}>
                <img src={u.url} alt={CAPTIONS[u.name] ?? u.name} />
              </button>
              <figcaption>{CAPTIONS[u.name] ?? u.name}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {big && (
        <div className="lightbox" role="dialog" aria-label="Full size" onClick={() => setBig(null)}>
          <img src={big} alt="" />
        </div>
      )}
    </div>
  )
}
