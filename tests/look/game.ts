// The game's files the look tests need, read from the TeeJS/faction-wars
// checkout without touching it: `git show <ref>:<path>` (FACTION_WARS_REF,
// default origin/main, so a checkout whose working tree is behind still gives
// the current game), or the plain file when the folder is not a git checkout.
// Nothing of the game is copied into this repo. Tests that need a file skip
// when neither has it.

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { LookContext } from '../../src/core/look/validate'
import { FACTION_WARS_DIR } from '../helpers'

export const GAME_REF = process.env.FACTION_WARS_REF ?? 'origin/main'

const isGit = existsSync(join(FACTION_WARS_DIR, '.git'))

function git(args: string[]): Buffer | null {
  if (!isGit) return null
  try {
    return execFileSync('git', ['-C', FACTION_WARS_DIR, ...args], { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

const read = new Map<string, Uint8Array | null>()
/** A file of the game at `ref`, or null (read once). The plain file stands in only for the default ref. */
export function gameBytes(rel: string, ref = GAME_REF): Uint8Array | null {
  const key = `${ref}:${rel}`
  if (!read.has(key)) {
    const shown = git(['show', key])
    const p = join(FACTION_WARS_DIR, rel)
    read.set(key, shown ? new Uint8Array(shown) : ref === GAME_REF && existsSync(p) ? new Uint8Array(readFileSync(p)) : null)
  }
  return read.get(key)!
}

export function gameText(rel: string, ref = GAME_REF): string | null {
  const b = gameBytes(rel, ref)
  return b ? new TextDecoder().decode(b) : null
}

/** Every file under `dir` at the default ref, relative to it. */
export function gameFiles(dir: string): string[] {
  const listed = git(['ls-tree', '-r', '--name-only', GAME_REF, '--', dir])
  if (listed) {
    const names = listed.toString('utf8').split('\n').filter(Boolean)
    if (names.length) return names.map((n) => n.slice(dir.length + 1))
  }
  const root = join(FACTION_WARS_DIR, dir)
  if (!existsSync(root)) return []
  const out: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name)
      if (statSync(full).isDirectory()) walk(full)
      else out.push(relative(root, full).replace(/\\/g, '/'))
    }
  }
  walk(root)
  return out
}

const packs = new Map<string, Map<string, Uint8Array>>()
/** A whole pack of the game, as the editor opens it (read once; each call gets its own map). */
export function gamePack(id: string): Map<string, Uint8Array> {
  let files = packs.get(id)
  if (!files) {
    files = new Map()
    const rels = gameFiles(`packs/${id}`)
    const batch = gitBatch(rels.map((rel) => `packs/${id}/${rel}`))
    for (const rel of rels) {
      const b = batch?.get(`packs/${id}/${rel}`) ?? gameBytes(`packs/${id}/${rel}`)
      if (b) files.set(rel, b)
    }
    packs.set(id, files)
  }
  return new Map(files)
}

/**
 * Many of the game's files at the default ref in one `git cat-file --batch`,
 * not a `git show` each: the WWII pack is some 1,300 files since its unit
 * pictures (the game 2026-09-30), and a process per file ran past the test
 * timeout. Null when the folder is not a git checkout or git fails.
 */
function gitBatch(rels: string[]): Map<string, Uint8Array> | null {
  if (!isGit || rels.length === 0) return null
  let out: Buffer
  try {
    out = execFileSync('git', ['-C', FACTION_WARS_DIR, 'cat-file', '--batch'], {
      input: rels.map((rel) => `${GAME_REF}:${rel}\n`).join(''),
      maxBuffer: 1 << 30,
      stdio: ['pipe', 'pipe', 'ignore']
    })
  } catch {
    return null
  }
  const found = new Map<string, Uint8Array>()
  let at = 0
  for (const rel of rels) {
    const eol = out.indexOf(10, at)
    if (eol < 0) break
    const header = out.toString('utf8', at, eol)
    at = eol + 1
    if (header.endsWith(' missing')) continue
    const size = Number(header.split(' ')[2])
    found.set(rel, new Uint8Array(out.subarray(at, at + size)))
    at += size + 1 // the object and its newline
  }
  return found
}

export const ww2LookText = (): string => gameText('packs/ww2/look.json') ?? ''
export const ww2LookBytes = (): Uint8Array => gameBytes('packs/ww2/look.json') ?? new Uint8Array()
export const ww2Look = (): Record<string, unknown> => JSON.parse(ww2LookText())
/** Whether the game at hand has the WWII look (the look system reached main in September 2026). */
export const haveLook = gameBytes('packs/ww2/look.json') !== null

let ww2Shipped: string[] | null = null
/** The game's own test runs rule 31 against res://packs/ww2. */
export function ww2Ctx(packDir = 'res://packs/ww2'): LookContext {
  ww2Shipped ??= gameFiles('packs/ww2')
  const shipped = ww2Shipped
  return { packDir, factionIds: ['axis', 'allies'], hasFile: (rel) => shipped.includes(rel) }
}
