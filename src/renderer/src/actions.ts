// What the menu and toolbar do: open, new, save, save as, export.

import { PackDocument } from '../../core/document'
import { exportedName } from '../../core/model'
import { clonePack, createStarterPack } from '../../core/starter'
import { SHIPPED_PACK_IDS } from '../../core/vocab'
import { buildPackZip, checkImportable, openPackZip } from '../../core/zip'
import { store } from './store'
import { alertDialog, choiceDialog, confirmDialog, formDialog } from './ui/Modal'

const PACK_ID = /^[A-Za-z0-9_-]{1,64}$/
const idProblem = (v: string): string | null => {
  if (!PACK_ID.test(v)) return 'Letters, digits, - and _ only (1-64), e.g. my-pack.'
  if (SHIPPED_PACK_IDS.includes(v)) return `'${v}' is a pack that ships with the game - pick your own id.`
  return null
}

let appVersion = '0.0.0'
void window.api?.info().then((i) => (appVersion = i.version))

/** Asks before throwing away unsaved work. True = go ahead. */
async function discardOk(): Promise<boolean> {
  const d = store.doc
  if (!d || !d.dirty) return true
  const r = await choiceDialog('Unsaved changes', `"${d.packId || 'This pack'}" has unsaved changes.`, [
    { label: 'Cancel', value: 'cancel' },
    { label: 'Discard', value: 'discard', danger: true },
    { label: 'Save', value: 'save', primary: true }
  ])
  if (r === 'save') return await save()
  return r === 'discard'
}

function fail(what: string, e: unknown): void {
  store.notify('error', `${what}: ${(e as Error)?.message ?? String(e)}`)
}

export async function openFolder(path?: string): Promise<void> {
  if (!(await discardOk())) return
  const dir = path ?? (await window.api.pickOpenFolder())
  if (!dir) return
  try {
    const { files, folderName } = await window.api.readTree(dir)
    if (!files.some(([p]) => p === 'pack.json')) {
      const ok = await confirmDialog('No pack.json here', `${dir} has no pack.json. Open it anyway (as a pack that is missing its files)?`, 'Open anyway')
      if (!ok) return
    }
    const doc = new PackDocument(new Map(files), folderName)
    store.setDoc(doc, { kind: 'folder', folder: dir, origin: dir })
    store.go('pack')
    void window.api.addRecent({ path: dir, kind: 'folder', name: doc.packId || folderName })
    store.notify('success', `Opened ${doc.packId || folderName} (${files.length} files).`)
  } catch (e) {
    fail('Could not open the folder', e)
  }
}

export async function openZip(path?: string): Promise<void> {
  if (!(await discardOk())) return
  const file = path ?? (await window.api.pickOpenZip())
  if (!file) return
  try {
    const bytes = await window.api.readFile(file)
    const opened = await openPackZip(bytes)
    const doc = new PackDocument(opened.files, opened.folderName)
    // A zip has no folder: the first Save asks where to put it.
    doc.isNew = true
    store.setDoc(doc, { kind: 'zip', folder: null, origin: file })
    store.go('pack')
    void window.api.addRecent({ path: file, kind: 'zip', name: doc.packId || file })
    if (opened.warnings.length) await alertDialog('Opened, with notes', '• ' + opened.warnings.join('\n• '))
    else store.notify('success', `Opened ${doc.packId} from the zip. Save it as a folder to keep working on it.`)
  } catch (e) {
    fail('Could not open the zip', e)
  }
}

export async function newPack(): Promise<void> {
  if (!(await discardOk())) return
  const how = await choiceDialog(
    'New pack',
    'Start from the built-in starter - two generic sides, a small map and every table the engine needs, already valid and playable - or copy the pack that is open now under a new id.',
    [
      { label: 'Cancel', value: 'cancel' },
      ...(store.doc ? [{ label: 'Copy the open pack', value: 'clone' }] : []),
      { label: 'From scratch', value: 'scratch', primary: true }
    ]
  )
  if (how === 'cancel') return
  if (how === 'clone' && store.doc) return makeOwnCopy()
  const v = await formDialog(
    'New pack from scratch',
    [
      { key: 'id', label: 'Pack id', value: 'my-pack', validate: idProblem, help: 'Also the folder name. Letters, digits, - and _.' },
      { key: 'name', label: 'Display name', value: 'My Pack', validate: (s) => (s.trim() ? null : 'Give it a name for the pack picker.') },
      { key: 'aId', label: 'First side id', value: 'faction_a', validate: sideId },
      { key: 'aName', label: 'First side name', value: 'Faction A' },
      { key: 'bId', label: 'Second side id', value: 'faction_b', validate: (s, all) => sideId(s) ?? (s === all.aId ? 'The two sides need different ids.' : null) },
      { key: 'bName', label: 'Second side name', value: 'Faction B' }
    ],
    'Everything can be renamed later; renaming an id updates every reference to it.',
    'Create'
  )
  if (!v) return
  const doc = createStarterPack({
    id: v.id,
    displayName: v.name,
    sides: [
      { id: v.aId, displayName: v.aName },
      { id: v.bId, displayName: v.bName }
    ]
  })
  store.setDoc(doc, { kind: 'new', folder: null, origin: null })
  store.go('pack')
  store.notify('success', `Created ${v.id}. It is valid and playable as it stands; save it to choose its folder.`)
}

/**
 * The modding path: copy the open pack under an id of your own and save it as a new
 * folder. The copy sits beside the original in the game's pack picker; its pictures
 * still come from the player's art set until the mod adds its own.
 */
export async function makeOwnCopy(): Promise<void> {
  const d = store.doc
  if (!d) return
  const baseId = d.packId || 'pack'
  const baseName = String(d.get('pack.json', ['display_name']) ?? baseId)
  const v = await formDialog(
    'Make your own copy',
    [
      {
        key: 'id',
        label: 'Your pack id',
        value: `${baseId}-mod`,
        validate: (t) => idProblem(t) ?? (t === baseId ? 'Pick an id different from the original.' : null),
        help: 'Also the folder name. Choose it once: saved games remember it. Something distinctive avoids clashing with other people\'s mods.'
      },
      { key: 'name', label: 'Display name (the pack picker card)', value: `${baseName} (modded)`, validate: (s) => (s.trim() ? null : 'Give it a name.') }
    ],
    `Your copy sits beside the original in the game's pack picker, so players can keep both.${d.dirty ? ' Your unsaved edits go into the copy; the original stays as it is on disk.' : ''} Pictures keep coming from your art set until you add your own on each record's Pictures panel.`,
    'Make copy'
  )
  if (!v) return
  const copy = clonePack(d, v.id, v.name)
  store.setDoc(copy, { kind: 'new', folder: null, origin: null })
  store.go('pack')
  store.notify('success', `Made ${v.id}. Choose where to save it.`)
  await saveAs()
}

/** Runs the one-click fix a warning offers. */
export async function runFix(fix: { action: string; arg?: string }): Promise<void> {
  if (fix.action === 'makeCopy') return makeOwnCopy()
  if (fix.action === 'removeFile' && fix.arg && store.doc) {
    store.doc.edit(`Remove ${fix.arg}`, (e) => e.removeFile(fix.arg!))
    store.notify('info', `Removed ${fix.arg} from the pack (it goes from the folder on the next save; Undo brings it back).`)
  }
}

function sideId(s: string): string | null {
  return /^[a-z0-9]+(_[a-z0-9]+)*$/.test(s) ? null : 'lower_snake_case, e.g. rebels'
}

/** Saves to the current folder, or asks where (Save As) when there is none. */
export async function save(): Promise<boolean> {
  const d = store.doc
  if (!d) return false
  if (!store.source.folder || d.isNew) return saveAs()
  if (d.folderName !== d.packId) {
    const ok = await confirmDialog(
      'The id changed',
      `pack.json's id is now '${d.packId}', but this folder is '${d.folderName}'. The game requires them to match, so save it as a new folder named '${d.packId}'?`,
      'Save As…'
    )
    return ok ? saveAs() : false
  }
  return writeFolder(store.source.folder, false)
}

export async function saveAs(): Promise<boolean> {
  const d = store.doc
  if (!d) return false
  if (!PACK_ID.test(d.packId)) {
    await alertDialog('Give the pack an id first', "pack.json's id names the folder; set it on the Pack page (letters, digits, - and _).")
    store.go('pack')
    return false
  }
  const dir = await window.api.pickSaveParent(d.packId)
  if (!dir) return false
  const state = await window.api.folderState(dir)
  if (state === 'file') {
    await alertDialog('Cannot save there', `${dir} is a file.`)
    return false
  }
  const replacing = state === 'nonEmpty' && dir !== store.source.folder
  if (replacing) {
    const ok = await confirmDialog(
      'Replace that folder?',
      `${dir} already has files. It will be backed up to your editor-backups folder, then its contents replaced with this pack.`,
      'Back up and replace',
      true
    )
    if (!ok) return false
  }
  return writeFolder(dir, true, replacing)
}

async function writeFolder(dir: string, all: boolean, replace = false): Promise<boolean> {
  const d = store.doc!
  try {
    const changed = new Set(d.changedPaths())
    const files = d.allFiles().filter((f) => all || changed.has(f.path))
    const r = await window.api.saveTree(
      dir,
      files.map((f) => [f.path, f.bytes] as [string, Uint8Array]),
      all ? [] : d.removedPaths(),
      replace
    )
    const folderName = dir.split(/[\\/]/).filter(Boolean).pop() ?? d.packId
    d.markSaved(folderName)
    store.source = { kind: 'folder', folder: dir, origin: dir }
    store.validateNow()
    store.syncWindow()
    void window.api.addRecent({ path: dir, kind: 'folder', name: d.packId })
    store.notify('success', `Saved ${files.length} file${files.length === 1 ? '' : 's'} to ${dir}.${r.backup ? ` Backup: ${r.backup}` : ''}`)
    return true
  } catch (e) {
    fail('Could not save', e)
    return false
  }
}

/** Builds the zip the game imports, after the validator and the importer's checks pass. */
export async function exportZip(): Promise<void> {
  const d = store.doc
  if (!d) return
  store.validateNow()
  const errors = store.issues.filter((i) => i.severity === 'error')
  // A folder-name mismatch does not matter inside a zip: the game installs it under the id.
  const blocking = errors.filter((e) => !e.message.includes('does not match folder name'))
  if (blocking.length) {
    store.showIssues = true
    store.emit()
    await alertDialog(
      'Fix the errors first',
      `The game would refuse this pack: ${blocking.length} error${blocking.length === 1 ? '' : 's'} (listed in the Problems panel). The first: ${blocking[0].message}`
    )
    return
  }
  if (SHIPPED_PACK_IDS.includes(d.packId)) {
    const r = await choiceDialog(
      'Make it your own first',
      `This is the built-in '${d.packId}' pack. The game always uses its built-in copy of '${d.packId}', so a zip under the same id would never load. Make your own copy with a new id, then export that.`,
      [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Make my own copy', value: 'copy', primary: true }
      ]
    )
    if (r === 'copy') await makeOwnCopy()
    return
  }
  const out = await window.api.pickSaveZip(`${d.packId}.zip`)
  if (!out) return
  try {
    // What pictures a pack carries is the author's call; the editor does not check them.
    const title = String(d.get('pack.json', ['display_name']) ?? d.packId)
    const r = await buildPackZip(d.allFiles(), { id: d.packId, title, exporter: `faction-wars-editor ${appVersion}`, artSetHashes: null, ignoreOriginals: true })
    if (!r.ok || !r.bytes) {
      await alertDialog('Not exported', r.message)
      return
    }
    const refusal = await checkImportable(r.bytes, null, { ignoreOriginals: true })
    if (refusal) {
      await alertDialog('Not exported', `The game's importer would refuse this zip: ${refusal}`)
      return
    }
    await window.api.writeFile(out, r.bytes)
    // Which version went out, so an author sharing copies can tell them apart.
    const version = String(d.get('pack.json', ['version']) ?? '').trim()
    store.notify(
      'success',
      `Exported ${exportedName(title, version)}: ${r.files} files to ${out}. In Faction Wars, drag it onto the first screen, or use the + card (Add your own pack).`
    )
  } catch (e) {
    fail('Could not export', e)
  }
}

export async function chooseArtSet(): Promise<void> {
  const p = await window.api.pickArtSet()
  if (!p) return
  if (!(await window.api.isArtSet(p))) {
    await alertDialog('Not an art set', `${p} has no art-set manifest.json.`)
    return
  }
  store.artChosen = p
  const art = await store.loadArt(true)
  store.notify('success', `Using the art set at ${p} for previews (${art.sources.length} art set${art.sources.length === 1 ? '' : 's'} found).`)
}

export function undo(): void {
  store.doc?.undo()
}
export function redo(): void {
  store.doc?.redo()
}

export async function closePack(): Promise<void> {
  if (!(await discardOk())) return
  store.setDoc(null, { kind: 'new', folder: null, origin: null })
}
