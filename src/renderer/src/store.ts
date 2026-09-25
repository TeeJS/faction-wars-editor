// The app's state: the open pack, where it lives, which page and record are
// showing, and the latest validation. React reads it through useStore().

import { useSyncExternalStore } from 'react'
import { indexArtSets, type ArtSets } from '../../core/artset'
import type { PackDocument } from '../../core/document'
import { lintPack } from '../../core/lint'
import { hydrate, type LoadedPack } from '../../core/model'
import { validatePack, type Issue } from '../../core/validate'

export interface Notice {
  id: number
  kind: 'info' | 'success' | 'error'
  text: string
}

export interface Source {
  kind: 'folder' | 'zip' | 'new'
  /** The folder Save writes to (null until the pack has been saved as a folder). */
  folder: string | null
  /** Where it was opened from, for the title bar. */
  origin: string | null
}

class AppStore {
  doc: PackDocument | null = null
  source: Source = { kind: 'new', folder: null, origin: null }
  page = 'pack'
  /** The selected record per page (index into its list, or a key for keyed maps). */
  selection: Record<string, number | string | undefined> = {}
  issues: Issue[] = []
  notices: Notice[] = []
  /** The player's art sets on this computer (null until looked for; empty sources when none). */
  art: ArtSets | null = null
  /** An art set the author pointed the editor at, looked in first. */
  artChosen: string | null = null
  showIssues = true
  private artLoading: Promise<ArtSets> | null = null

  private _version = 0
  private listeners = new Set<() => void>()
  private unsubDoc: (() => void) | null = null
  private validateTimer: ReturnType<typeof setTimeout> | null = null
  private noticeId = 0
  private cache: { version: number; pack: LoadedPack } | null = null

  get version(): number {
    return this._version
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit(): void {
    this._version++
    for (const fn of this.listeners) fn()
  }

  setDoc(doc: PackDocument | null, source: Source): void {
    this.unsubDoc?.()
    this.doc = doc
    this.source = source
    this.selection = {}
    this.cache = null
    this.issues = []
    if (doc) {
      this.unsubDoc = doc.subscribe(() => {
        this.cache = null
        this.scheduleValidate()
        this.syncWindow()
        this.emit()
      })
      this.validateNow()
    }
    this.syncWindow()
    this.emit()
  }

  /** The pack hydrated the way the game reads it (cached per document version). */
  get pack(): LoadedPack | null {
    if (!this.doc) return null
    if (this.cache && this.cache.version === this.doc.version) return this.cache.pack
    const pack = hydrate(this.doc).pack
    this.cache = { version: this.doc.version, pack }
    return pack
  }

  go(page: string, select?: number | string): void {
    this.page = page
    if (select !== undefined) this.selection[page] = select
    this.emit()
  }

  select(page: string, value: number | string | undefined): void {
    this.selection[page] = value
    this.emit()
  }

  notify(kind: Notice['kind'], text: string): void {
    const n = { id: ++this.noticeId, kind, text }
    this.notices = [...this.notices, n]
    this.emit()
    setTimeout(() => this.dismiss(n.id), kind === 'error' ? 12000 : 5000)
  }

  dismiss(id: number): void {
    this.notices = this.notices.filter((n) => n.id !== id)
    this.emit()
  }

  private scheduleValidate(): void {
    if (this.validateTimer) clearTimeout(this.validateTimer)
    this.validateTimer = setTimeout(() => this.validateNow(), 250)
  }

  validateNow(): void {
    if (!this.doc) return
    const label = this.source.folder ?? undefined
    this.issues = [...validatePack(this.doc, { packDirLabel: label }), ...lintPack(this.doc)]
    this.emit()
  }

  /** Finds the art sets (once; again after the author chooses one). */
  loadArt(force = false): Promise<ArtSets> {
    if (!this.artLoading || force)
      this.artLoading = window.api.findArtSets(this.artChosen).then((sources) => {
        this.art = indexArtSets(sources)
        this.emit()
        return this.art
      })
    return this.artLoading
  }

  get errorCount(): number {
    return this.issues.filter((i) => i.severity === 'error').length
  }

  syncWindow(): void {
    const d = this.doc
    const name = d ? d.packId || '(no id)' : ''
    const title = d ? `${d.dirty ? '● ' : ''}${name} — Faction Wars Pack Editor` : 'Faction Wars Pack Editor'
    void window.api?.setTitle(title)
    void window.api?.setDirty(!!d && d.dirty)
  }
}

export const store = new AppStore()

/** Re-renders the component on any store or document change. */
export function useStore(): AppStore {
  useSyncExternalStore(store.subscribe, () => store.version)
  return store
}
