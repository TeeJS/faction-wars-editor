// A faction pack held in memory: the 12 JSON files as JsonText, every other file
// as bytes. All changes go through edit(), which records undo/redo and keeps a
// version counter the UI subscribes to.

import { JsonText, type JSONPath } from './jsontext'
import { PACK_JSON_FILES, type PackJsonFile } from './vocab'

export type FileMap = Map<string, Uint8Array>

/** The empty shape of each file, used when a pack lacks one and the author edits it. */
export const EMPTY_SHAPES: Record<PackJsonFile, unknown> = {
  'pack.json': {},
  'factions.json': { factions: [] },
  'map.json': { sectors: [], planets: [] },
  'characters.json': { characters: [] },
  'facilities.json': { facilities: [] },
  'units.json': { units: [] },
  'weapons.json': { weapons: [] },
  'missions.json': { missions: [] },
  'mission_tables.json': { tables: {} },
  'rules.json': [],
  'setup.json': { side_lottery: [], logistics: {} },
  'display.json': { categories: [], galaxy_display_modes: [], special_power_ranks: {} }
}

/** Files the editor never carries: the importer's copy of the manifest (regenerated on
 * export) and version-control folders. */
export function isIgnoredPath(path: string): boolean {
  return path === 'manifest.json' || path.startsWith('.git/') || path === '.git' || path.endsWith('.importing')
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
}

export function isPackJsonFile(p: string): p is PackJsonFile {
  return (PACK_JSON_FILES as readonly string[]).includes(p)
}

type Snapshot =
  | { kind: 'json'; file: PackJsonFile; text: JsonText | null }
  | { kind: 'file'; path: string; bytes: Uint8Array | null }

interface Tx {
  label: string
  before: Snapshot[]
  after: Snapshot[]
}

export class PackDocument {
  /** The folder name the pack was loaded from (rule 1 compares it with pack.json id). */
  folderName: string | null
  private json = new Map<PackJsonFile, JsonText | null>()
  private files: FileMap = new Map()
  private originalFiles: FileMap = new Map()
  private undoStack: Tx[] = []
  private redoStack: Tx[] = []
  private listeners = new Set<() => void>()
  private _version = 0
  private savedVersion = 0
  /** Files that were on disk when loaded and have since been removed or renamed away. */
  private removedSinceSave = new Set<string>()

  constructor(files: FileMap, folderName: string | null) {
    this.folderName = folderName
    for (const f of PACK_JSON_FILES) this.json.set(f, null)
    for (const [rawPath, bytes] of files) {
      const path = normalizePath(rawPath)
      if (isIgnoredPath(path)) continue
      if (isPackJsonFile(path)) this.json.set(path, JsonText.fromBytes(bytes))
      else {
        this.files.set(path, bytes)
        this.originalFiles.set(path, bytes)
      }
    }
  }

  // ---- reading ----

  get version(): number {
    return this._version
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private changed(): void {
    this._version++
    for (const fn of this.listeners) fn()
  }

  /** The JsonText of a pack file, or null when the pack does not carry it. */
  text(file: PackJsonFile): JsonText | null {
    return this.json.get(file) ?? null
  }

  /** The parsed value of a pack file (undefined when missing or malformed). */
  value(file: PackJsonFile): unknown {
    return this.json.get(file)?.value
  }

  get(file: PackJsonFile, path: JSONPath): unknown {
    return this.json.get(file)?.get(path)
  }

  /** Every non-JSON file, sorted by path. */
  otherFiles(): string[] {
    return [...this.files.keys()].sort()
  }

  hasFile(path: string): boolean {
    const p = normalizePath(path)
    return this.files.has(p) || (isPackJsonFile(p) && this.json.get(p) != null)
  }

  fileBytes(path: string): Uint8Array | undefined {
    const p = normalizePath(path)
    if (isPackJsonFile(p)) return this.json.get(p)?.toBytes()
    return this.files.get(p)
  }

  /** pack.json id, or '' */
  get packId(): string {
    const v = this.get('pack.json', ['id'])
    return typeof v === 'string' ? v : ''
  }

  /** A pack made in the editor (New Pack) that has never been saved to a folder. */
  isNew = false

  /** True when any file differs from the last save/load (undoing back to it clears this). */
  get dirty(): boolean {
    if (this.isNew) return true
    return this._version !== this.savedVersion && this.changedPaths().length > 0
  }

  /** Paths whose bytes differ from the last save/load (JSON by text, others by identity). */
  changedPaths(): string[] {
    const out: string[] = []
    for (const [f, t] of this.json) if (t && t.dirty) out.push(f)
    for (const [p, b] of this.files) if (this.originalFiles.get(p) !== b) out.push(p)
    for (const p of this.removedSinceSave) out.push(p)
    return out.sort()
  }

  /** Everything the pack carries, as it would be written now. */
  allFiles(): { path: string; bytes: Uint8Array }[] {
    const out: { path: string; bytes: Uint8Array }[] = []
    for (const f of PACK_JSON_FILES) {
      const t = this.json.get(f)
      if (t) out.push({ path: f, bytes: t.toBytes() })
    }
    for (const [p, b] of this.files) out.push({ path: p, bytes: b })
    return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  }

  /** Paths removed since the last save, for the folder writer to delete. */
  removedPaths(): string[] {
    return [...this.removedSinceSave].sort()
  }

  /** After a successful save: the written state becomes the new baseline. */
  markSaved(folderName: string): void {
    this.folderName = folderName
    this.isNew = false
    for (const [f, t] of this.json) if (t) this.json.set(f, JsonText.fromBytes(t.toBytes()))
    this.originalFiles = new Map(this.files)
    this.removedSinceSave.clear()
    this.savedVersion = this._version
    this.changed()
  }

  // ---- editing ----

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0
  }
  get undoLabel(): string {
    return this.undoStack[this.undoStack.length - 1]?.label ?? ''
  }
  get redoLabel(): string {
    return this.redoStack[this.redoStack.length - 1]?.label ?? ''
  }

  /** Runs `fn` as one undoable change. Returns false when nothing changed. */
  edit(label: string, fn: (e: Editor) => void): boolean {
    const before = new Map<string, Snapshot>()
    const editor = new Editor(this, before)
    fn(editor)
    const tx: Tx = { label, before: [...before.values()], after: [] }
    for (const s of tx.before) tx.after.push(this.snapshotOf(s))
    const same = tx.before.every((b, i) => sameSnapshot(b, tx.after[i]))
    if (same) return false
    this.undoStack.push(tx)
    if (this.undoStack.length > 500) this.undoStack.shift()
    this.redoStack = []
    this.changed()
    return true
  }

  undo(): void {
    const tx = this.undoStack.pop()
    if (!tx) return
    for (const s of tx.before) this.restore(s)
    this.redoStack.push(tx)
    this.changed()
  }

  redo(): void {
    const tx = this.redoStack.pop()
    if (!tx) return
    for (const s of tx.after) this.restore(s)
    this.undoStack.push(tx)
    this.changed()
  }

  /** @internal */
  snapshotOf(s: Snapshot): Snapshot {
    if (s.kind === 'json') {
      const t = this.json.get(s.file)
      return { kind: 'json', file: s.file, text: t ? cloneText(t) : null }
    }
    return { kind: 'file', path: s.path, bytes: this.files.get(s.path) ?? null }
  }

  private restore(s: Snapshot): void {
    if (s.kind === 'json') {
      this.json.set(s.file, s.text ? cloneText(s.text) : null)
    } else if (s.bytes) {
      this.files.set(s.path, s.bytes)
      this.removedSinceSave.delete(s.path)
    } else {
      this.files.delete(s.path)
      if (this.originalFiles.has(s.path)) this.removedSinceSave.add(s.path)
    }
  }

  /** @internal - raw access for the Editor. */
  _json(): Map<PackJsonFile, JsonText | null> {
    return this.json
  }
  /** @internal */
  _files(): FileMap {
    return this.files
  }
  /** @internal */
  _originals(): FileMap {
    return this.originalFiles
  }
  /** @internal */
  _removed(): Set<string> {
    return this.removedSinceSave
  }
}

/** Keeps a JsonText's original bytes (dirty tracking) while copying its current text. */
function cloneText(t: JsonText): JsonText {
  if (t.originalBytes) {
    const c = JsonText.fromBytes(t.originalBytes)
    if (c.text !== t.text) c.setText(t.text)
    return c
  }
  return JsonText.fromText(t.text)
}

function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  if (a.kind === 'json' && b.kind === 'json') return (a.text?.text ?? null) === (b.text?.text ?? null)
  if (a.kind === 'file' && b.kind === 'file') return a.bytes === b.bytes
  return false
}

/** The mutation surface handed to PackDocument.edit(). */
export class Editor {
  constructor(
    private doc: PackDocument,
    private before: Map<string, Snapshot>
  ) {}

  private touchJson(file: PackJsonFile): JsonText {
    const key = 'json:' + file
    if (!this.before.has(key)) this.before.set(key, this.doc.snapshotOf({ kind: 'json', file, text: null }))
    const map = this.doc._json()
    let t = map.get(file)
    if (!t) {
      t = JsonText.fromValue(EMPTY_SHAPES[file])
      map.set(file, t)
    }
    return t
  }

  private touchFile(path: string): void {
    const key = 'file:' + path
    if (!this.before.has(key)) this.before.set(key, this.doc.snapshotOf({ kind: 'file', path, bytes: null }))
  }

  get(file: PackJsonFile, path: JSONPath): unknown {
    return this.doc.get(file, path)
  }

  set(file: PackJsonFile, path: JSONPath, value: unknown): void {
    this.touchJson(file).set(path, value)
  }

  remove(file: PackJsonFile, path: JSONPath): void {
    if (!this.doc.text(file)) return
    this.touchJson(file).remove(path)
  }

  insert(file: PackJsonFile, arrayPath: JSONPath, index: number, value: unknown): void {
    this.touchJson(file).insert(arrayPath, index, value)
  }

  move(file: PackJsonFile, arrayPath: JSONPath, from: number, to: number): void {
    this.touchJson(file).move(arrayPath, from, to)
  }

  renameKey(file: PackJsonFile, objectPath: JSONPath, oldKey: string, newKey: string): boolean {
    return this.touchJson(file).renameKey(objectPath, oldKey, newKey)
  }

  /** Replaces a JSON file's whole text (the raw editor). */
  setJsonText(file: PackJsonFile, text: string): void {
    this.touchJson(file).setText(text)
  }

  /** Creates the file from its empty shape if the pack lacks it. */
  ensureJson(file: PackJsonFile): void {
    this.touchJson(file)
  }

  setFile(path: string, bytes: Uint8Array): void {
    const p = normalizePath(path)
    if (isPackJsonFile(p)) {
      this.setJsonText(p, new TextDecoder().decode(bytes))
      return
    }
    this.touchFile(p)
    this.doc._files().set(p, bytes)
    this.doc._removed().delete(p)
  }

  removeFile(path: string): void {
    const p = normalizePath(path)
    if (!this.doc._files().has(p)) return
    this.touchFile(p)
    this.doc._files().delete(p)
    if (this.doc._originals().has(p)) this.doc._removed().add(p)
  }

  renameFile(from: string, to: string): void {
    const a = normalizePath(from)
    const b = normalizePath(to)
    const bytes = this.doc._files().get(a)
    if (!bytes || a === b) return
    this.removeFile(a)
    this.setFile(b, bytes)
  }
}
