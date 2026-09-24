// The bridge's shape, shared by the preload (which implements it) and the page.

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
  artSetHashes(path: string | null): Promise<{ path: string; hashes: string[] } | null>
  /** A picture from an art set (zip or folder), for previews. */
  artSetFile(setPath: string, rel: string): Promise<Uint8Array | null>
  defaultArtSet(): Promise<string | null>
  showItem(path: string): Promise<void>
  recent(): Promise<RecentEntry[]>
  addRecent(entry: RecentEntry): Promise<void>
  onMenu(fn: (action: string) => void): () => void
}

declare global {
  interface Window {
    api: EditorApi
  }
}
