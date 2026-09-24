// The narrow bridge between the page and the main process. The page gets these
// functions and nothing else (contextIsolation on, nodeIntegration off).

import { contextBridge, ipcRenderer } from 'electron'
import type { EditorApi } from './api'

const api: EditorApi = {
  info: () => ipcRenderer.invoke('app:info'),
  setDirty: (dirty) => ipcRenderer.invoke('app:setDirty', dirty),
  setTitle: (title) => ipcRenderer.invoke('app:setTitle', title),
  pickOpenFolder: () => ipcRenderer.invoke('pick:openFolder'),
  pickOpenZip: () => ipcRenderer.invoke('pick:openZip'),
  pickSaveParent: (id) => ipcRenderer.invoke('pick:saveParent', id),
  pickSaveZip: (suggested) => ipcRenderer.invoke('pick:saveZip', suggested),
  pickFiles: (title, extensions) => ipcRenderer.invoke('pick:files', title, extensions),
  pickArtSet: () => ipcRenderer.invoke('pick:artSet'),
  exists: (path) => ipcRenderer.invoke('fs:exists', path),
  folderState: (path) => ipcRenderer.invoke('fs:folderState', path),
  readTree: (dir) => ipcRenderer.invoke('fs:readTree', dir),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, bytes) => ipcRenderer.invoke('fs:writeFile', path, bytes),
  saveTree: (dir, files, remove, replace) => ipcRenderer.invoke('fs:saveTree', dir, files, remove, replace),
  artSetHashes: (path) => ipcRenderer.invoke('artset:hashes', path),
  artSetFile: (setPath, rel) => ipcRenderer.invoke('artset:file', setPath, rel),
  defaultArtSet: () => ipcRenderer.invoke('artset:default'),
  showItem: (path) => ipcRenderer.invoke('shell:showItem', path),
  recent: () => ipcRenderer.invoke('recent:get'),
  addRecent: (entry) => ipcRenderer.invoke('recent:add', entry),
  onMenu: (fn) => {
    const listener = (_e: unknown, action: string) => fn(action)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
