// The bridge's shape, shared by the preload (which implements it) and the page.

import type { ArtSetSource } from '../core/artset'

export interface RecentEntry {
  path: string
  kind: 'folder' | 'zip'
  name: string
}

export interface AppInfo {
  version: string
  platform: string
  documents: string
  factionWarsDocs: string
  backups: string
}

/** The Look page's In the game tab: where Godot and the game are. */
export interface RenderSettings {
  godot: string
  game: string
  ref: string
}

export interface RenderSettingsState {
  settings: RenderSettings
  /** What is wrong with them, or null. */
  problem: string | null
  /** Where the copy of the game and the pictures live. */
  cache: string
}

export interface RenderRequest {
  packId: string
  /** Every file of the pack as it stands in the editor. */
  files: [string, Uint8Array][]
  faction?: string
}

export interface RenderResult {
  commit: string
  outDir: string
  shots: { name: string; file: string }[]
  seconds: number
}

export interface EditorApi {
  info(): Promise<AppInfo>
  setDirty(dirty: boolean): Promise<void>
  setTitle(title: string): Promise<void>
  pickOpenFolder(): Promise<string | null>
  pickOpenZip(): Promise<string | null>
  /** The folder to save the pack into (named after `id`), or null when cancelled. */
  pickSaveParent(id: string): Promise<string | null>
  pickSaveZip(suggestedName: string): Promise<string | null>
  pickFiles(title: string, extensions: string[]): Promise<{ name: string; bytes: Uint8Array }[]>
  pickArtSet(): Promise<string | null>
  exists(path: string): Promise<boolean>
  folderState(path: string): Promise<'missing' | 'file' | 'empty' | 'nonEmpty'>
  readTree(dir: string): Promise<{ files: [string, Uint8Array][]; folderName: string }>
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, bytes: Uint8Array): Promise<void>
  saveTree(dir: string, files: [string, Uint8Array][], remove: string[], replace: boolean): Promise<{ backup: string | null }>
  /** The art sets on this computer (a chosen one first), with each file's sha256. */
  findArtSets(chosen: string | null): Promise<ArtSetSource[]>
  isArtSet(path: string): Promise<boolean>
  /** A picture from an art set (zip or folder), for previews. */
  artSetFile(setPath: string, rel: string): Promise<Uint8Array | null>
  showItem(path: string): Promise<void>
  /** The Look page's In the game tab (optional: needs Godot and the game's source). */
  getRenderSettings(): Promise<RenderSettingsState>
  setRenderSettings(s: RenderSettings): Promise<RenderSettingsState>
  pickGodot(): Promise<string | null>
  pickGame(): Promise<string | null>
  /** Renders the pack's look with the game's own capture scripts. */
  render(req: RenderRequest): Promise<RenderResult>
  renderImage(file: string): Promise<Uint8Array | null>
  openRenderFolder(dir: string): Promise<void>
  onRenderProgress(fn: (line: string) => void): () => void
  recent(): Promise<RecentEntry[]>
  addRecent(entry: RecentEntry): Promise<void>
  onMenu(fn: (action: string) => void): () => void
}

declare global {
  interface Window {
    api: EditorApi
  }
}
