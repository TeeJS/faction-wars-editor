// The Look page's In the game tab: the game renders the look. The pieces are
// tested here without Godot; with FWE_RENDER=1 (and FWE_GODOT naming Godot's
// console executable) the whole thing runs against the real game - a game
// window opens while it captures - and the pictures are checked for the colour
// the look was given.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { SHOT_ORDER, binaryFingerprint, checkSettings, placePack, prepareGame, renderLook, syncFiles, withUserDir, type RenderSettings } from '../../src/main/render'
import { LookFile } from '../../src/core/look/lookfile'
import { FACTION_WARS_DIR } from '../helpers'
import { countColor, readPng } from './png'

const enc = new TextEncoder()

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fwe-render-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('the copy of the game', () => {
  it("gets its own user:// folder, so the player's saves and log are never touched", () => {
    const text = '[application]\r\n\r\nconfig/name="faction-wars"\r\nrun/main_scene="res://PackPicker.tscn"\r\n'
    const out = withUserDir(text, 'fwe-render-abc123')
    expect(out).toBe(
      '[application]\r\n\r\nconfig/name="faction-wars"\r\nconfig/use_custom_user_dir=true\r\nconfig/custom_user_dir_name="fwe-render-abc123"\r\nrun/main_scene="res://PackPicker.tscn"\r\n'
    )
    expect(withUserDir(out, 'fwe-render-def456').match(/custom_user_dir_name/g)).toHaveLength(1)
  })

  it('says plainly when Godot or the game is not where the settings say', () => {
    expect(checkSettings({ godot: '', game: '', ref: '' })).toMatch(/Godot was not found/)
    expect(checkSettings({ godot: join(root, 'nope.exe'), game: root, ref: 'origin/main' })).toMatch(/Godot was not found/)
    writeFileSync(join(root, 'godot.exe'), '')
    expect(checkSettings({ godot: join(root, 'godot.exe'), game: join(root, 'missing'), ref: '' })).toMatch(/game was not found/)
    expect(checkSettings({ godot: join(root, 'godot.exe'), game: root, ref: '' })).toMatch(/neither a git checkout nor a Godot project/)
    writeFileSync(join(root, 'project.godot'), '')
    expect(checkSettings({ godot: join(root, 'godot.exe'), game: root, ref: '' })).toBeNull()
  })
})

describe('placing the pack in the copy', () => {
  const files = (look = '{"colors": {}}', extra: [string, string][] = []): [string, Uint8Array][] =>
    [
      ['pack.json', '{"id": "ww2"}'],
      ['look.json', look],
      ['look/paper.png', 'png-1'],
      ['look/fonts/A.ttf', 'ttf-1'],
      ...extra
    ].map(([rel, text]) => [rel, enc.encode(text)])

  it('the pack as it stands goes in; Godot imports only when a picture or face changed', () => {
    const game = join(root, 'game')
    expect(placePack(game, { packId: 'ww2', files: files('{"colors": {"brass": "#00c8ff"}}') })).toBe(true)
    expect(readFileSync(join(game, 'packs', 'ww2', 'look.json'), 'utf8')).toContain('#00c8ff')
    // Godot's sidecar for a picture the pack keeps stays; the look alone changing needs no import.
    writeFileSync(join(game, 'packs', 'ww2', 'look', 'paper.png.import'), 'sidecar')
    expect(placePack(game, { packId: 'ww2', files: files('{"colors": {"brass": "#112233"}}') })).toBe(false)
    expect(existsSync(join(game, 'packs', 'ww2', 'look', 'paper.png.import'))).toBe(true)
    // A face new to the pack: import.
    expect(placePack(game, { packId: 'ww2', files: files(undefined, [['look/fonts/B.ttf', 'ttf-2']]) })).toBe(true)
    expect(readFileSync(join(game, 'packs', 'ww2', 'look', 'fonts', 'B.ttf'), 'utf8')).toBe('ttf-2')
    // Next time without it: it goes again.
    expect(placePack(game, { packId: 'ww2', files: files() })).toBe(true)
    expect(existsSync(join(game, 'packs', 'ww2', 'look', 'fonts', 'B.ttf'))).toBe(false)
  })

  it('a pack id that cannot be a folder is refused', () => {
    expect(() => placePack(join(root, 'game'), { packId: '../x', files: files() })).toThrow(/cannot name a folder/)
  })

  it('files the pack no longer has leave the copy; sidecars of files it keeps stay; nothing is written outside it', () => {
    const to = join(root, 'to')
    syncFiles(files(), to)
    writeFileSync(join(to, 'stale.png'), 'x')
    writeFileSync(join(to, 'stale.png.import'), 'x')
    writeFileSync(join(to, 'look', 'paper.png.import'), 'x')
    syncFiles([...files(), ['../escaped.txt', enc.encode('x')]], to)
    expect(existsSync(join(to, 'stale.png'))).toBe(false)
    expect(existsSync(join(to, 'stale.png.import'))).toBe(false)
    expect(existsSync(join(to, 'look', 'paper.png.import'))).toBe(true)
    expect(existsSync(join(root, 'escaped.txt'))).toBe(false)
  })

  it('an unchanged file is not written again', () => {
    const to = join(root, 'to')
    syncFiles(files(), to)
    const before = statSync(join(to, 'look', 'paper.png')).mtimeMs
    syncFiles(files('{"colors": {"ink": "#000000"}}'), to)
    expect(statSync(join(to, 'look', 'paper.png')).mtimeMs).toBe(before)
  })

  it('the fingerprint follows pictures and faces, not JSON', () => {
    const dir = join(root, 'pack')
    syncFiles(files(), dir)
    const a = binaryFingerprint(dir)
    writeFileSync(join(dir, 'look.json'), '{"colors": {"ink": "#000000"}}')
    expect(binaryFingerprint(dir)).toBe(a)
    writeFileSync(join(dir, 'look', 'paper.png'), 'png-2')
    expect(binaryFingerprint(dir)).not.toBe(a)
  })
})

// ---------------------------------------------------------------------------
// The real thing (FWE_RENDER=1): a game window opens while it captures.
// ---------------------------------------------------------------------------

const real = process.env.FWE_RENDER === '1' ? describe : describe.skip

real('the game renders the look', () => {
  const settings: RenderSettings = {
    godot: process.env.FWE_GODOT ?? '',
    game: FACTION_WARS_DIR,
    ref: process.env.FWE_REF ?? 'origin/main'
  }
  const cache = resolve(__dirname, '..', '.scratch', 'render-cache')

  it(
    'brass changed to #00c8ff shows in the specimen and on the Cockpit, drawn by the game',
    async () => {
      const lines: string[] = []
      const { dir, commit } = await prepareGame(settings, cache, (l) => lines.push(l))
      // The WWII pack as the game ships it, its look changed as the Look page would.
      const src = join(dir, 'packs', 'ww2')
      const files: [string, Uint8Array][] = []
      const walk = (d: string) => {
        for (const name of readdirSync(d)) {
          const full = join(d, name)
          if (statSync(full).isDirectory()) walk(full)
          else if (!/\.(import|uid)$/.test(name)) files.push([relative(src, full).replace(/\\/g, '/'), new Uint8Array(readFileSync(full))])
        }
      }
      walk(src)
      const i = files.findIndex(([rel]) => rel === 'look.json')
      const look = LookFile.fromBytes(files[i][1])
      look.setColor('brass', '#00c8ff')
      files[i] = ['look.json', look.toBytes()]
      const r = await renderLook(settings, { packId: 'ww2', files }, cache, (l) => lines.push(l))
      console.log(`rendered at ${commit} in ${r.seconds}s: ${r.shots.map((s) => s.name).join(', ')}`)
      expect(r.shots.map((s) => s.name)).toEqual(SHOT_ORDER)
      const specimen = readPng(new Uint8Array(readFileSync(r.shots[0].file)))
      expect(specimen.width).toBe(1440)
      expect(countColor(specimen, '#00c8ff')).toBeGreaterThan(100)
      const cockpit = readPng(new Uint8Array(readFileSync(r.shots[1].file)))
      expect(countColor(cockpit, '#00c8ff')).toBeGreaterThan(100)
      // The original brass is gone from the launch plates' frames.
      expect(countColor(cockpit, '#a88a4e')).toBeLessThan(countColor(cockpit, '#00c8ff'))
    },
    1_500_000
  )
})
