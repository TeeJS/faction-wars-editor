// pack.json, plus an at-a-glance summary of the whole pack.

import type { ReactNode } from 'react'
import { isDict } from '../../../core/model'
import { chooseArtSet, makeOwnCopy } from '../actions'
import { SHIPPED_PACK_IDS } from '../../../core/vocab'
import { displaySettingsFields, packFields } from '../forms/pages'
import { FieldGroup } from '../forms/fields'
import type { Ctx } from '../forms/types'
import { store, useStore } from '../store'
import { useImage } from '../ui/useImage'

export function PackPage(): ReactNode {
  const s = useStore()
  const doc = s.doc!
  const pack = s.pack!
  const c: Ctx = { doc, pack }
  const rec = doc.get('pack.json', [])
  const { image } = useImage(pack.manifest.mapImage, doc.version)
  const counts: [string, number, string][] = [
    ['factions', pack.factions.length, 'factions'],
    ['sectors', pack.sectors.length, 'sectors'],
    ['planets', pack.planets.length, 'planets'],
    ['characters', pack.characters.length, 'characters'],
    ['units', pack.units.length, 'units'],
    ['weapons', pack.weapons.length, 'weapons'],
    ['facilities', pack.facilities.length, 'facilities'],
    ['missions', pack.missions.length, 'missions'],
    ['mission tables', Object.keys(pack.missionTables).length, 'missionTables'],
    ['rules', pack.rules.length, 'rules'],
    ['logistics tables', Object.keys(pack.setup.logistics).length, 'logistics'],
    ['GID modes', pack.display.categories.reduce((n, cat) => n + cat.modes.length, 0), 'gid']
  ]
  return (
    <div className="page-pad">
      {SHIPPED_PACK_IDS.includes(pack.manifest.id) && (
        <div className="callout">
          <div>
            <strong>This is the built-in {pack.manifest.displayName || pack.manifest.id} pack.</strong> Look around and try changes freely. To keep a
            mod, make your own copy: it gets its own id, sits beside the original in the game's pack picker, and exports as a zip anyone can import.
          </div>
          <button className="primary" onClick={() => void makeOwnCopy()}>
            Make my own copy
          </button>
        </div>
      )}
      <div className="pack-overview">
        <div>
          <h2>{pack.manifest.displayName || pack.manifest.id || 'Untitled pack'}</h2>
          <p className="muted">{pack.manifest.summary}</p>
          <div className="counts">
            {counts.map(([label, n, page]) => (
              <button key={label} className="count" onClick={() => store.go(page)}>
                <b>{n}</b> {label}
              </button>
            ))}
          </div>
          <p className="muted">
            {s.source.folder ? (
              <>
                Folder: <code>{s.source.folder}</code>
              </>
            ) : (
              'Not saved to a folder yet.'
            )}
            {' · '}
            Your art set, for previews:{' '}
            {s.art === null ? (
              <span>looking…</span>
            ) : s.art.sources.length > 0 ? (
              s.art.sources.map((a, i) => (
                <span key={a.path}>
                  {i > 0 && ', '}
                  <code>{a.path}</code>
                </span>
              ))
            ) : (
              <span>none found (the editor looks in Documents/Faction Wars and in the game's own data folder)</span>
            )}{' '}
            <button className="link" onClick={() => void chooseArtSet()}>
              choose…
            </button>
          </p>
        </div>
        {image && <img className="thumb" src={image.url} alt="Map picture" />}
      </div>
      <h3>pack.json</h3>
      {isDict(rec) ? <FieldGroup c={c} file="pack.json" path={[]} rec={rec} fields={packFields} /> : <p className="bad">pack.json is not an object.</p>}
      <p className="muted">
        The Cockpit menu (the picture menu and its credits) has its own page.
      </p>
    </div>
  )
}

export function DisplaySettingsPage(): ReactNode {
  const s = useStore()
  const doc = s.doc!
  const c: Ctx = { doc, pack: s.pack! }
  const rec = doc.get('display.json', [])
  return (
    <div className="page-pad">
      <h2>Display settings</h2>
      <p className="muted">The rest of display.json: display slots, special-power band labels, terms, the loyalty bar and corner icons. GID categories and modes are on their own page.</p>
      {isDict(rec) ? <FieldGroup c={c} file="display.json" path={[]} rec={rec} fields={displaySettingsFields} /> : <p className="bad">display.json is not an object.</p>}
    </div>
  )
}
