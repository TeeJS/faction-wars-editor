// Electron main process: windows, the menu, native dialogs and file I/O.
// Everything pack-specific (parsing, validation, zips) lives in src/core and runs
// in the renderer; this side only moves bytes and keeps backups.

import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { unzipSync, zipSync } from 'fflate'
import { artSetHashesFromManifest, artSetHashesFromZip } from '../core/zip'

let win: BrowserWindow | null = null
let rendererDirty = false
let quitting = false
const backedUpThisSession = new Set<string>()

const isMac = process.platform === 'darwin'

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Faction Wars Pack Editor',
    backgroundColor: '#15171c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win?.show())
  win.on('close', (e) => {
    if (quitting || !rendererDirty || !win) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Quit without saving', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved changes',
      message: 'This pack has unsaved changes.',
      detail: 'Quit anyway and lose them?'
    })
    if (choice !== 0) e.preventDefault()
  })
  // Links open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function send(action: string): void {
  win?.webContents.send('menu', action)
}

function buildMenu(): void {
  const item = (label: string, action: string, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(action)
  })
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        item('New Pack…', 'new', 'CmdOrCtrl+N'),
        item('Open Pack Folder…', 'openFolder', 'CmdOrCtrl+O'),
        item('Open Pack Zip…', 'openZip', 'CmdOrCtrl+Shift+O'),
        { type: 'separator' },
        item('Save', 'save', 'CmdOrCtrl+S'),
        item('Save As…', 'saveAs', 'CmdOrCtrl+Shift+S'),
        item('Export Zip for the Game…', 'export', 'CmdOrCtrl+E'),
        { type: 'separator' },
        { label: 'Open Backups Folder', click: () => void shell.openPath(ensureDir(backupsDir())) },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        item('Undo Pack Change', 'undo', 'CmdOrCtrl+Z'),
        item('Redo Pack Change', 'redo', isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y'),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        item('Validate Now', 'validate', 'F5'),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Project Page', click: () => void shell.openExternal('https://github.com/TeeJS/faction-wars-editor') },
        { label: 'Pack Schema (SCHEMA.md)', click: () => void shell.openExternal('https://github.com/TeeJS/faction-wars/blob/main/SCHEMA.md') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---- file helpers ----

function ensureDir(d: string): string {
  mkdirSync(d, { recursive: true })
  return d
}

function factionWarsDocs(): string {
  return join(app.getPath('documents'), 'Faction Wars')
}

function backupsDir(): string {
  return join(factionWarsDocs(), 'editor-backups')
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function readTree(dir: string): [string, Uint8Array][] {
  const out: [string, Uint8Array][] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (name === '.git' || name === 'node_modules') continue
        walk(full)
      } else out.push([relative(dir, full).split(sep).join('/'), new Uint8Array(readFileSync(full))])
    }
  }
  walk(dir)
  return out
}

/** A path inside `root`, or throws: nothing is ever written outside the pack folder. */
function inside(root: string, rel: string): string {
  const full = resolve(root, rel)
  const r = resolve(root)
  if (full !== r && !full.startsWith(r + sep)) throw new Error(`Refusing to write outside the pack folder: ${rel}`)
  return full
}

function writeAtomic(path: string, bytes: Uint8Array): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.fwe-tmp`
  writeFileSync(tmp, bytes)
  renameSync(tmp, path)
}

/** Zips a folder into the backups directory (before the editor first overwrites it). */
function backupFolder(dir: string): string | null {
  if (!existsSync(dir) || readdirSync(dir).length === 0) return null
  const files: Record<string, Uint8Array> = {}
  for (const [rel, bytes] of readTree(dir)) files[rel] = bytes
  const out = join(ensureDir(backupsDir()), `${basename(dir)}-${stamp()}.zip`)
  writeFileSync(out, zipSync(files, { level: 6 }))
  return out
}

// ---- IPC ----

function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    documents: app.getPath('documents'),
    factionWarsDocs: factionWarsDocs(),
    backups: backupsDir()
  }))

  ipcMain.handle('app:setDirty', (_e, dirty: boolean) => {
    rendererDirty = dirty
  })

  ipcMain.handle('app:setTitle', (_e, title: string) => {
    win?.setTitle(title)
  })

  ipcMain.handle('pick:openFolder', async () => {
    const r = await dialog.showOpenDialog(win!, { title: 'Open a pack folder (the one with pack.json)', properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('pick:openZip', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Open a pack zip',
      properties: ['openFile'],
      filters: [{ name: 'Faction pack', extensions: ['zip'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('pick:saveParent', async (_e, id: string) => {
    const r = await dialog.showOpenDialog(win!, {
      title: `Choose where to save - a folder named "${id}" is made inside it`,
      buttonLabel: 'Save Here',
      properties: ['openDirectory', 'createDirectory']
    })
    if (r.canceled) return null
    const chosen = r.filePaths[0]
    // Picking the pack's own folder (already named after the id) saves into it.
    return basename(chosen) === id ? chosen : join(chosen, id)
  })

  ipcMain.handle('pick:saveZip', async (_e, suggested: string) => {
    const r = await dialog.showSaveDialog(win!, {
      title: 'Export the pack for the game',
      defaultPath: join(factionWarsDocs(), suggested),
      filters: [{ name: 'Faction pack', extensions: ['zip'] }]
    })
    return r.canceled || !r.filePath ? null : r.filePath
  })

  ipcMain.handle('pick:files', async (_e, title: string, extensions: string[]) => {
    const r = await dialog.showOpenDialog(win!, {
      title,
      properties: ['openFile', 'multiSelections'],
      filters: extensions.length ? [{ name: 'Files', extensions }] : []
    })
    if (r.canceled) return []
    return r.filePaths.map((p) => ({ name: basename(p), bytes: new Uint8Array(readFileSync(p)) }))
  })

  ipcMain.handle('pick:artSet', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Choose your art set (the .art.zip the Faction Wars Exporter made)',
      properties: ['openFile'],
      filters: [{ name: 'Art set', extensions: ['zip'] }]
    })
    return r.canceled ? null : r.filePaths[0]
  })

  ipcMain.handle('fs:exists', (_e, path: string) => existsSync(path))

  ipcMain.handle('fs:folderState', (_e, path: string) => {
    if (!existsSync(path)) return 'missing'
    if (!statSync(path).isDirectory()) return 'file'
    return readdirSync(path).length === 0 ? 'empty' : 'nonEmpty'
  })

  ipcMain.handle('fs:readTree', (_e, dir: string) => {
    if (!existsSync(join(dir, 'pack.json')) && !existsSync(dir)) throw new Error(`${dir} does not exist.`)
    return { files: readTree(dir), folderName: basename(dir) }
  })

  ipcMain.handle('fs:readFile', (_e, path: string) => new Uint8Array(readFileSync(path)))

  ipcMain.handle('fs:writeFile', (_e, path: string, bytes: Uint8Array) => {
    writeAtomic(path, bytes)
  })

  /**
   * Writes a pack folder. `files` are written atomically, `remove` deleted; with
   * `replace`, anything else in the folder (except manifest.json and .git) goes too.
   * The folder is backed up first, once per session.
   */
  ipcMain.handle(
    'fs:saveTree',
    (_e, dir: string, files: [string, Uint8Array][], remove: string[], replace: boolean) => {
      let backup: string | null = null
      const key = resolve(dir).toLowerCase()
      if (!backedUpThisSession.has(key)) {
        backup = backupFolder(dir)
        backedUpThisSession.add(key)
      }
      mkdirSync(dir, { recursive: true })
      const keep = new Set(files.map(([rel]) => rel))
      for (const [rel, bytes] of files) writeAtomic(inside(dir, rel), bytes)
      const toRemove = new Set(remove)
      if (replace)
        for (const [rel] of readTree(dir)) if (!keep.has(rel) && rel !== 'manifest.json') toRemove.add(rel)
      for (const rel of toRemove) {
        if (keep.has(rel)) continue
        const full = inside(dir, rel)
        if (existsSync(full)) rmSync(full)
      }
      return { backup }
    }
  )

  /** The art-set hashes for the export leak guard: a chosen art set, or the Exporter's default. */
  ipcMain.handle('artset:hashes', (_e, path: string | null) => {
    const candidates = path ? [path] : [join(factionWarsDocs(), 'swr-original.art.zip')]
    for (const p of candidates) {
      if (!existsSync(p)) continue
      let set: Set<string> | null = null
      if (statSync(p).isDirectory()) {
        const m = join(p, 'manifest.json')
        if (existsSync(m)) set = artSetHashesFromManifest(readFileSync(m, 'utf8'))
      } else set = artSetHashesFromZip(new Uint8Array(readFileSync(p)))
      if (set) return { path: p, hashes: [...set] }
    }
    return null
  })

  /** One picture out of an art set (zip or folder), for previews only - never copied into a pack. */
  ipcMain.handle('artset:file', (_e, setPath: string, rel: string) => {
    if (!existsSync(setPath)) return null
    if (statSync(setPath).isDirectory()) {
      const full = inside(setPath, rel)
      return existsSync(full) ? new Uint8Array(readFileSync(full)) : null
    }
    const entries = unzipSync(new Uint8Array(readFileSync(setPath)), { filter: (f) => f.name === rel })
    return entries[rel] ?? null
  })

  /** The default art set's location (the Exporter writes it to Documents\Faction Wars). */
  ipcMain.handle('artset:default', () => {
    const p = join(factionWarsDocs(), 'swr-original.art.zip')
    return existsSync(p) ? p : null
  })

  ipcMain.handle('shell:showItem', (_e, path: string) => shell.showItemInFolder(path))

  // Recent packs, newest first.
  const recentFile = () => join(app.getPath('userData'), 'recent.json')
  const readRecent = (): { path: string; kind: 'folder' | 'zip'; name: string }[] => {
    try {
      return JSON.parse(readFileSync(recentFile(), 'utf8'))
    } catch {
      return []
    }
  }
  ipcMain.handle('recent:get', () => readRecent().filter((r) => existsSync(r.path)))
  ipcMain.handle('recent:add', (_e, entry: { path: string; kind: 'folder' | 'zip'; name: string }) => {
    const list = [entry, ...readRecent().filter((r) => r.path !== entry.path)].slice(0, 10)
    ensureDir(app.getPath('userData'))
    writeFileSync(recentFile(), JSON.stringify(list, null, 2))
  })
}

app.whenReady().then(() => {
  registerIpc()
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  // The window's close handler asks; once it allowed the close, do not ask twice.
})

app.on('window-all-closed', () => {
  quitting = true
  if (!isMac) app.quit()
})
