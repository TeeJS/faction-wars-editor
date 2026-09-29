// THE LOOK RENDERED BY THE GAME ITSELF (the Look page's In the game tab). The
// game's own capture scripts (tests/capture_look_specimen.gd: every shared
// piece on one sheet; tests/capture_look.gd: the Cockpit, Credits, map, a
// message, a dialog, a finder, the menu) run with Godot on a COPY of the game,
// with the pack as it stands in the editor - unsaved changes included - placed
// in the copy.
//
// Optional: it runs only when the user has pointed the editor at Godot and a
// copy of the game's source; nothing else in the editor needs either. The
// game folder is only read: a git checkout is exported with `git archive`, a
// plain folder is copied. The copy lives in the app's own data folder, has
// its own user:// (use_custom_user_dir), and is imported once per game
// version. Git and Godot are started directly, never through a shell.

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { unzipSync } from 'fflate'

export interface RenderSettings {
  /** Godot's console executable (it prints what the scripts say). */
  godot: string
  /** The game: a git checkout (exported at `ref`) or a plain project folder. */
  game: string
  /** For a git checkout: what to export (a branch, tag or commit). */
  ref: string
}

export interface RenderRequest {
  packId: string
  /** Every file of the pack as it stands in the editor (relative path, bytes). */
  files: [string, Uint8Array][]
  /** The side to play for the map screen (faction id); the pack's first when empty. */
  faction?: string
}

export interface Shot {
  name: string
  file: string
}

export interface RenderResult {
  /** The game version rendered: a short commit, or "folder". */
  commit: string
  outDir: string
  shots: Shot[]
  seconds: number
}

export type Progress = (line: string) => void

/** The order the pictures are shown in; the capture scripts' own names
 * (tests/capture_look.gd, 23 since the WWII look's phase 6, after the specimen sheet). */
export const SHOT_ORDER = [
  'specimen',
  'cockpit',
  'cockpit_focus',
  'credits',
  'map',
  'message',
  'message_urgent',
  'message_empty',
  'dialog',
  'finder',
  'menu',
  'popup',
  'ency',
  'economy',
  'defense',
  'fleet',
  'sector',
  'status',
  'personnel',
  'options',
  'overview',
  'objectives',
  'mp_config',
  'mp_host'
]

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

interface Ran {
  code: number | null
  stdout: Buffer
  stderr: string
  timedOut: boolean
}

/** Runs a program directly (no shell), collecting its output; kills it after `timeoutMs`. */
export function run(exe: string, args: string[], opts: { timeoutMs: number; onLine?: (line: string) => void; cwd?: string }): Promise<Ran> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(exe, args, { cwd: opts.cwd, shell: false, windowsHide: true })
    const out: Buffer[] = []
    let err = ''
    let partial = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, opts.timeoutMs)
    const lines = (text: string) => {
      if (!opts.onLine) return
      partial += text
      const parts = partial.split(/\r?\n/)
      partial = parts.pop() ?? ''
      for (const p of parts) if (p.trim()) opts.onLine(p)
    }
    child.stdout.on('data', (d: Buffer) => {
      out.push(d)
      lines(d.toString('utf8'))
    })
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString('utf8')
      lines(d.toString('utf8'))
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (partial.trim() && opts.onLine) opts.onLine(partial)
      resolveRun({ code, stdout: Buffer.concat(out), stderr: err, timedOut })
    })
  })
}

// ---------------------------------------------------------------------------
// The copy of the game
// ---------------------------------------------------------------------------

/** project.godot with its own user:// folder, so the player's saves, settings
 * and session log are never touched. */
export function withUserDir(projectGodot: string, name: string): string {
  let text = projectGodot.replace(/^config\/use_custom_user_dir=.*\r?\n/m, '').replace(/^config\/custom_user_dir_name=.*\r?\n/m, '')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const m = /^config\/name=.*$/m.exec(text)
  if (!m) throw new Error('project.godot has no config/name line')
  const at = m.index + m[0].length
  text = text.slice(0, at) + `${eol}config/use_custom_user_dir=true${eol}config/custom_user_dir_name="${name}"` + text.slice(at)
  return text
}

function writeTree(files: Record<string, Uint8Array>, dir: string): number {
  let n = 0
  for (const [rel, bytes] of Object.entries(files)) {
    if (rel.endsWith('/')) {
      mkdirSync(join(dir, rel), { recursive: true })
      continue
    }
    const full = resolve(dir, rel)
    if (!full.startsWith(resolve(dir) + sep)) continue
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, bytes)
    n++
  }
  return n
}

function copyTree(from: string, to: string, skip: (name: string) => boolean): void {
  mkdirSync(to, { recursive: true })
  for (const name of readdirSync(from)) {
    if (skip(name)) continue
    const a = join(from, name)
    const b = join(to, name)
    if (statSync(a).isDirectory()) copyTree(a, b, skip)
    else copyFileSync(a, b)
  }
}

function sameBytes(path: string, bytes: Uint8Array): boolean {
  if (!existsSync(path) || statSync(path).size !== bytes.length) return false
  return Buffer.compare(readFileSync(path), bytes) === 0
}

/**
 * Makes `to` hold exactly `files` (relative path, bytes); an unchanged file is
 * left untouched. A file only `to` has goes, except the `.import` / `.uid`
 * sidecars Godot made for a wanted file: keeping them means an unchanged
 * picture is not imported again. Nothing is written outside `to`.
 */
export function syncFiles(files: [string, Uint8Array][], to: string): void {
  const want = new Set<string>()
  const root = resolve(to)
  for (const [rel, bytes] of files) {
    const dest = resolve(root, rel)
    if (!dest.startsWith(root + sep)) continue
    want.add(relative(root, dest).toLowerCase())
    if (sameBytes(dest, bytes)) continue
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, bytes)
  }
  if (!existsSync(to)) return
  const clean = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      const rel = relative(to, full)
      if (statSync(full).isDirectory()) {
        clean(full)
        if (readdirSync(full).length === 0) rmSync(full, { recursive: true, force: true })
        continue
      }
      if (want.has(rel.toLowerCase())) continue
      const sidecar = /\.(import|uid)$/i.exec(rel)
      if (sidecar && want.has(rel.slice(0, -sidecar[0].length).toLowerCase())) continue
      rmSync(full, { force: true })
    }
  }
  clean(to)
}

const fwd = (p: string) => p.replace(/\\/g, '/')

/** Keeps the newest `keep` folders starting with `prefix` under `root`. */
function prune(root: string, prefix: string, keep: number): void {
  if (!existsSync(root)) return
  const dirs = readdirSync(root)
    .filter((n) => n.startsWith(prefix))
    .map((n) => ({ n, t: statSync(join(root, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const d of dirs.slice(keep)) rmSync(join(root, d.n), { recursive: true, force: true })
}

export function checkSettings(s: RenderSettings): string | null {
  if (!s.godot || !existsSync(s.godot) || !statSync(s.godot).isFile()) return `Godot was not found at "${s.godot}". Choose Godot's console executable.`
  if (!s.game || !existsSync(s.game)) return `The game was not found at "${s.game}". Choose the game's folder (the one with project.godot).`
  if (!existsSync(join(s.game, '.git')) && !existsSync(join(s.game, 'project.godot')))
    return `"${s.game}" is neither a git checkout nor a Godot project (no project.godot).`
  return null
}

/** A copy of the game, ready to run: exported, given its own user://, imported. Reused per version. */
export async function prepareGame(s: RenderSettings, cacheRoot: string, progress: Progress): Promise<{ dir: string; commit: string }> {
  const problem = checkSettings(s)
  if (problem) throw new Error(problem)
  mkdirSync(cacheRoot, { recursive: true })
  const isGit = existsSync(join(s.game, '.git'))
  let commit = 'folder'
  if (isGit) {
    const r = await run('git', ['-C', s.game, 'rev-parse', '--short', s.ref || 'HEAD'], { timeoutMs: 30_000 })
    if (r.code !== 0) throw new Error(`git could not find "${s.ref}" in ${s.game}: ${r.stderr.trim()}`)
    commit = r.stdout.toString('utf8').trim()
  }
  const dir = join(cacheRoot, `game-${commit}`)
  const ready = join(dir, '.fwe-ready')
  if (isGit && existsSync(ready)) {
    progress(`Using the copy of the game at ${commit}.`)
    return { dir, commit }
  }

  const partial = `${dir}.partial`
  rmSync(partial, { recursive: true, force: true })
  if (isGit) {
    progress(`Exporting ${s.ref} (${commit}) from ${s.game} with git archive (read-only).`)
    const r = await run('git', ['-C', s.game, 'archive', '--format=zip', s.ref || 'HEAD'], { timeoutMs: 300_000 })
    if (r.code !== 0) throw new Error(`git archive failed: ${r.stderr.trim()}`)
    const n = writeTree(unzipSync(new Uint8Array(r.stdout)), partial)
    progress(`${n} files exported.`)
  } else {
    progress(`Copying the game from ${s.game}.`)
    copyTree(s.game, partial, (name) => name === '.git')
    // A folder can change between renders: copy it again each time, keeping the last import.
    const oldImport = join(dir, '.godot')
    if (existsSync(oldImport) && !existsSync(join(partial, '.godot'))) copyTree(oldImport, join(partial, '.godot'), () => false)
  }
  const proj = join(partial, 'project.godot')
  if (!existsSync(proj)) throw new Error(`The game has no project.godot at ${s.ref || s.game}.`)
  writeFileSync(proj, withUserDir(readFileSync(proj, 'utf8'), `fwe-render-${commit}`))
  rmSync(dir, { recursive: true, force: true })
  renameSync(partial, dir)

  progress('Importing the game with Godot (the first time for a version takes a minute or two).')
  const imp = await run(s.godot, ['--headless', '--path', fwd(dir), '--import'], { timeoutMs: 900_000 })
  if (imp.timedOut) throw new Error('Godot took more than 15 minutes to import the game.')
  writeFileSync(ready, commit)
  prune(cacheRoot, 'game-', 3)
  return { dir, commit }
}

/** A fingerprint of the pack's pictures and faces: when it changes, Godot must import again. */
export function binaryFingerprint(packDir: string): string {
  const h = createHash('sha256')
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (!/\.(json|md|txt|import|uid)$/i.test(name)) {
        h.update(fwd(relative(packDir, full)))
        h.update(readFileSync(full))
      }
    }
  }
  walk(packDir)
  return h.digest('hex')
}

/** Puts the pack into the copy, as it stands in the editor. True when Godot must import it. */
export function placePack(gameDir: string, req: RenderRequest): boolean {
  if (!/^[\w.-]+$/.test(req.packId)) throw new Error(`The pack id "${req.packId}" cannot name a folder.`)
  const target = join(gameDir, 'packs', req.packId)
  syncFiles(req.files, target)
  const mark = join(gameDir, `.fwe-pack-${req.packId}`)
  const print = binaryFingerprint(target)
  const needs = !existsSync(mark) || readFileSync(mark, 'utf8') !== print
  if (needs) writeFileSync(mark, print)
  return needs
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** Renders the look with the game's capture scripts. A game window opens while it captures. */
export async function renderLook(s: RenderSettings, req: RenderRequest, cacheRoot: string, progress: Progress): Promise<RenderResult> {
  const started = Date.now()
  const { dir, commit } = await prepareGame(s, cacheRoot, progress)
  if (placePack(dir, req)) {
    const markFile = join(dir, `.fwe-pack-${req.packId}`)
    progress("Importing the pack's pictures and faces.")
    const imp = await run(s.godot, ['--headless', '--path', fwd(dir), '--import'], { timeoutMs: 600_000 })
    if (imp.timedOut) {
      rmSync(markFile, { force: true })
      throw new Error('Godot took more than 10 minutes to import the pack.')
    }
  }
  const out = join(cacheRoot, 'out', stamp(new Date()))
  mkdirSync(out, { recursive: true })
  const said = (line: string) => {
    if (/^\[capture_look|ERROR|SCRIPT ERROR|\[Pack\]/.test(line.trim())) progress(line.trim())
  }
  const log: string[] = []
  const collect = (line: string) => {
    log.push(line)
    said(line)
  }
  const lookBytes = req.files.find(([rel]) => rel === 'look.json')?.[1]
  let look: unknown = null
  try {
    look = JSON.parse(new TextDecoder().decode(lookBytes ?? new Uint8Array()).replace(/^﻿/, '') || '{}')
  } catch {
    look = null
  }
  if (look && typeof look === 'object' && Object.keys(look).length > 0) {
    progress('Capturing the specimen sheet (every shared piece).')
    const r = await run(
      s.godot,
      ['--path', fwd(dir), '--resolution', '1440x850', '-s', 'tests/capture_look_specimen.gd', '--', `--out=${fwd(join(out, 'specimen.png'))}`, `--pack=${req.packId}`],
      { timeoutMs: 180_000, onLine: collect }
    )
    if (r.timedOut) progress('The specimen sheet took too long and was stopped.')
  }
  progress('Capturing the Cockpit, the Credits, the map screen, the dispatches, a dialog, the menus, every other window and the head-to-head screens.')
  const args = ['--path', fwd(dir), '--resolution', '1440x850', '-s', 'tests/capture_look.gd', '--', `--out=${fwd(join(out, 'shot'))}`, `--pack=${req.packId}`, '--record=user://fwe-capture.jsonl']
  if (req.faction) args.push(`--faction=${req.faction}`)
  const r = await run(s.godot, args, { timeoutMs: 300_000, onLine: collect })
  if (r.timedOut) progress('The screens took too long and were stopped; the ones captured are shown.')

  const shots: Shot[] = []
  for (const name of SHOT_ORDER) {
    const file = join(out, name === 'specimen' ? 'specimen.png' : `shot_${name}.png`)
    if (existsSync(file)) shots.push({ name, file })
  }
  if (!shots.length) throw new Error(`The game captured nothing. Its last words:\n${log.slice(-20).join('\n')}`)
  writeFileSync(join(out, 'log.txt'), log.join('\n'))
  prune(join(cacheRoot, 'out'), '2', 5)
  return { commit, outDir: out, shots, seconds: Math.round((Date.now() - started) / 1000) }
}
