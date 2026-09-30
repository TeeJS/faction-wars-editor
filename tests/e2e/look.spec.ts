/// <reference lib="dom" />
// The Look page (Display → Look), driving the real app on the game's own WWII
// pack (read from the faction-wars checkout with git show, into a scratch
// folder) and on a new pack: the colours, the window mock-ups, faces, sizes,
// corners and the dim, starting a look, the game's own words for a broken
// one, and Undo and Save treating look.json as part of the pack.
// Native dialogs are replaced in the main process with canned answers.

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { PRESETS } from '../../src/core/look/presets'
import { gamePack, haveLook } from '../look/game'

const root = resolve(__dirname, '..', '..')
const scratch = join(root, 'tests', '.scratch', 'look')
const backups = join(scratch, 'backups')

let app: ElectronApplication
let page: Page

const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`

/** The game's WWII pack in its own folder under the scratch dir, `change` applied to its look. */
function ww2(name: string, change?: (look: Record<string, any>) => void): string {
  const dir = join(scratch, name, 'ww2')
  rmSync(dir, { recursive: true, force: true })
  for (const [rel, bytes] of gamePack('ww2')) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), bytes)
  }
  if (change) {
    const look = JSON.parse(readFileSync(join(dir, 'look.json'), 'utf8'))
    change(look)
    writeFileSync(join(dir, 'look.json'), JSON.stringify(look, null, 2) + '\n')
  }
  return dir
}

async function answer(a: { open?: string[]; save?: string; discard?: boolean }): Promise<void> {
  await app.evaluate(({ dialog }, x) => {
    const d = dialog as unknown as Record<string, unknown>
    d.showOpenDialog = async () => ({ canceled: !x.open, filePaths: x.open ?? [] })
    d.showSaveDialog = async () => ({ canceled: !x.save, filePath: x.save })
    d.showMessageBoxSync = () => 0
  }, a)
}

async function openFolder(dir: string): Promise<void> {
  await answer({ open: [dir] })
  await page.getByRole('button', { name: 'Open Folder' }).click()
  const discard = page.getByRole('dialog').getByRole('button', { name: 'Discard' })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await expect(page.locator('.toolbar .pack-name')).toContainText('ww2')
  await page.locator('.nav-item', { hasText: 'Look' }).click()
}

async function show(name: string): Promise<void> {
  await page.getByRole('tab', { name: 'Windows' }).click()
  await page.locator('.window-item', { hasText: name }).first().click()
  await expect(page.locator('.band b')).toHaveText(name)
}

const lookProblems = () => page.locator('.problems li', { hasText: 'look.json' })

test.beforeAll(async () => {
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(scratch, { recursive: true })
  const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : []
  app = await electron.launch({
    args: [...sandbox, join(root, 'out', 'main', 'index.js')],
    // FWE_RENDER_DIR: tests/look/render.test.ts's copy of the game, so it is not imported twice.
    env: { ...process.env, NODE_ENV: 'test', FWE_BACKUPS_DIR: backups, FWE_USER_DATA: join(scratch, 'user-data'), FWE_RENDER_DIR: join(root, 'tests', '.scratch', 'render-cache') }
  })
  page = await app.firstWindow()
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.waitForSelector('text=Faction Wars Pack Editor')
})

test.afterAll(async () => {
  await app?.close()
})

test.describe('on the game’s WWII pack', () => {
  test.skip(!haveLook, 'needs a faction-wars checkout with the WWII look')

  test('every colour and side, and every window a look reaches drawn with where each colour comes from', async () => {
    // 48 windows, each drawn and swept: more than the default 90 s on a busy machine.
    test.setTimeout(240_000)
    await openFolder(ww2('windows'))
    await expect(page.locator('.color-column .token[data-token]')).toHaveCount(23)
    await expect(page.locator('.color-column .token[data-side]')).toHaveCount(2)
    await expect(page.getByLabel('brass_dim hex', { exact: true })).toHaveValue('#7d6a3f')
    await expect(lookProblems()).toHaveCount(0)
    await page.screenshot({ path: join(scratch, '01-look-page.png') })
    const names = await page.locator('.window-item').allTextContents()
    expect(names.length).toBeGreaterThan(40)
    let drawn = 0
    for (const name of names) {
      await page.locator('.window-item', { hasText: name }).first().click()
      if (!(await page.locator('.canvas').count())) {
        await expect(page.locator('.band')).toContainText('A look never reaches these')
        continue
      }
      drawn++
      const orphans = await page.locator('.canvas').evaluate((c) =>
        [...c.querySelectorAll<HTMLElement>('[data-part]')].filter((e) => !e.dataset.src && !e.dataset.fixed && !e.dataset.side && !e.dataset.tex).map((e) => e.dataset.part)
      )
      expect(orphans, `${name}: parts that do not say where their colour comes from`).toEqual([])
    }
    expect(drawn).toBe(40)
  })

  test('a typed hex and the picker repaint the mock-up, Undo takes each back, and Save writes only that span of look.json', async () => {
    const dir = ww2('edit')
    const original = readFileSync(join(dir, 'look.json'), 'utf8')
    await openFolder(dir)
    await show('Cockpit (campaign dossier)')
    const plate = page.locator('.canvas [data-part="Launch plate"]').first()
    await expect(plate).toHaveCSS('border-top-color', rgb('#a88a4e'))
    await page.getByLabel('brass hex', { exact: true }).fill('#00aaff')
    await expect(plate).toHaveCSS('border-top-color', rgb('#00aaff'))
    await page.getByLabel('olive_deep colour picker').fill('#123456')
    await expect(plate).toHaveCSS('background-color', rgb('#123456'))
    await expect(page.locator('.toolbar .dirty')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveAttribute('title', 'Undo Colour olive_deep')
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(plate).toHaveCSS('background-color', rgb('#4a4d31'))
    await page.getByRole('button', { name: 'Redo' }).click()
    await expect(plate).toHaveCSS('background-color', rgb('#123456'))
    await page.screenshot({ path: join(scratch, '02-edited.png') })

    await answer({ open: [dir] })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.notice.success').last()).toContainText('Saved 1 file')
    expect(readFileSync(join(dir, 'look.json'), 'utf8')).toBe(
      original.replace('"brass": "#a88a4e"', '"brass": "#00aaff"').replace('"olive_deep": "#4a4d31"', '"olive_deep": "#123456"')
    )
    // The editor's own backup: the folder as it was, zipped, before the first save.
    expect(readdirSync(backups).filter((n) => n.startsWith('ww2-'))).toHaveLength(1)
    await expect(page.locator('.toolbar .dirty')).toHaveCount(0)
  })

  test('hovering a colour outlines the parts it paints; clicking a part names its colours and goes to them', async () => {
    await openFolder(ww2('hover'))
    await show('Message Index (dispatches)')
    await page.locator('#color-chassis_deep').hover()
    const hl = page.locator('.canvas .hl')
    await expect(hl.first()).toBeVisible()
    for (const t of await hl.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.tokens ?? ''))) expect(t.split(' ')).toContain('chassis_deep')
    await page.mouse.move(5, 5)
    await expect(page.locator('.canvas .hl')).toHaveCount(0)
    await show('Planetary System Finder')
    await page.locator('.canvas [data-part="Title bar"]').click({ position: { x: 3, y: 1 } })
    const inspector = page.getByRole('complementary', { name: 'The clicked part' })
    await expect(inspector).toContainText('Title bar')
    await inspector.getByRole('button', { name: /chassis_deep/ }).click()
    await expect(page.locator('#color-chassis_deep')).toHaveClass(/flash/)
  })

  test('a side colour: the launch plate band follows it; back to the map colour and its own again', async () => {
    await openFolder(ww2('sides'))
    await show('Cockpit (campaign dossier)')
    const band = page.locator('.canvas [data-part="Side band"][data-side="axis"]')
    await expect(band).toHaveCSS('background-color', rgb('#d06a55'))
    await page.getByLabel('Axis Powers side hex', { exact: true }).fill('#ffcc00')
    await expect(band).toHaveCSS('background-color', rgb('#ffcc00'))
    const axis = page.locator('.color-column .token[data-side="axis"]')
    await axis.getByRole('button', { name: 'Use the map colour' }).click()
    await expect(axis).toContainText('uses the map colour')
    await axis.getByRole('button', { name: 'Give it its own colour' }).click()
    await expect(page.getByLabel('Axis Powers side hex', { exact: true })).toHaveValue('#d22a2a')
  })

  test("a broken look: the game's own words, in the Problems panel and on the page", async () => {
    await openFolder(
      ww2('broken', (l) => {
        delete l.colors.brass
        l.colors.ink = 'black'
      })
    )
    await expect(page.locator('.problems')).toContainText("look.json colors: 'brass' is missing.")
    await expect(page.locator('.problems')).toContainText("look.json colors.ink: 'black' is not a #rrggbb color.")
    await expect(page.locator('.look-problems')).toContainText("look.json colors: 'brass' is missing.")
    await expect(page.locator('.nav-item', { hasText: 'Look' }).locator('.badge')).toHaveText('2')
    await page.screenshot({ path: join(scratch, '03-broken.png') })
    // Fixing it here clears it there.
    await page.getByLabel('ink hex', { exact: true }).fill('#2a2620')
    await expect(page.locator('.problems')).not.toContainText('look.json colors.ink')
  })

  test('a face from disk comes into the pack with its change, and Save writes it', async () => {
    const dir = ww2('face')
    const font = join(scratch, 'Stencil Test.ttf')
    writeFileSync(font, readFileSync(join(dir, 'look', 'fonts', 'CourierPrime-Regular.ttf')))
    await openFolder(dir)
    await page.getByRole('tab', { name: 'Faces, sizes and corners' }).click()
    await answer({ open: [font] })
    await page.locator('.face[data-role="display"]').getByRole('button', { name: 'Choose a font file…' }).click()
    await expect(page.getByLabel('display face file')).toHaveValue('look/fonts/Stencil Test.ttf')
    await expect(lookProblems()).toHaveCount(0)
    await page.getByLabel('display weight').fill('650')
    await page.getByLabel('display tabular figures').check()
    await page.screenshot({ path: join(scratch, '04-faces.png'), fullPage: true })
    await answer({ open: [dir] })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.notice.success').last()).toContainText('Saved 2 files')
    expect(readFileSync(join(dir, 'look', 'fonts', 'Stencil Test.ttf'))).toEqual(readFileSync(font))
    const look = JSON.parse(readFileSync(join(dir, 'look.json'), 'utf8'))
    expect(look.fonts.display).toEqual({ file: 'look/fonts/Stencil Test.ttf', weight: 650, tabular: true })
  })

  test('sizes, corners and the dim: the mock-ups follow, and a dragged value is one step for Undo', async () => {
    const dir = ww2('sizes')
    await openFolder(dir)
    await page.getByRole('tab', { name: 'Faces, sizes and corners' }).click()
    // The map's detail copy and its insets are shown, kept as they are.
    await expect(page.getByRole('row', { name: /map_detail/ })).toContainText('look/world_1941_detail.jpg')
    await expect(page.getByRole('table', { name: 'Map insets' })).toContainText('look/europe_1941.jpg')
    await expect(page.getByRole('table', { name: 'Map insets' })).toContainText('[328, 120, 57, 52]')
    await page.getByLabel('heading size').fill('22')
    await page.getByLabel('small size').fill('')
    await page.getByLabel('radius metric').fill('6')
    const dim = page.getByLabel('Dim strength value')
    for (const v of ['0.6', '0.7', '0.8']) await dim.fill(v)
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveAttribute('title', 'Undo Dim strength')
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveAttribute('title', 'Undo Corners radius')
    await page.getByRole('button', { name: 'Redo' }).click()
    await show('Cockpit (campaign dossier)')
    await expect(page.locator('.canvas [data-part="Launch plate"]').first()).toHaveCSS('border-top-left-radius', '6px')
    await expect(page.locator('.canvas [data-part="Launch plate"]').first()).toHaveCSS('font-size', '22px')
    await answer({ open: [dir] })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.notice.success').last()).toContainText('Saved 1 file')
    const look = JSON.parse(readFileSync(join(dir, 'look.json'), 'utf8'))
    expect(look.sizes).toEqual({ body: 16, label: 14, title: 15, heading: 22, display: 34 })
    expect(look.metrics.radius).toBe(6)
    expect(look.overlay_alpha).toBe(0.8)
  })

  test('dispatch words: set on the page, drawn on the Message Index, saved in look.json', async () => {
    const dir = ww2('dispatch')
    await openFolder(dir)
    await page.getByRole('tab', { name: 'Faces, sizes and corners' }).click()
    await page.getByLabel('Dispatch header word').fill('Cable')
    await page.getByLabel('Fleets stamp').fill('Convoy')
    await page.getByLabel('Missions is urgent').check()
    await expect(lookProblems()).toHaveCount(0)
    await show('Message Index (dispatches)')
    // The open dispatch is a Fleets one: the header word, its stamp in the muted ink.
    await expect(page.locator('.canvas [data-part="Typed heading"]')).toHaveText('CABLE')
    await expect(page.locator('.canvas [data-part="Stamp on the dispatch"]')).toHaveText('Convoy')
    // Missions is urgent now, beside Conflict: a filled stamp and a band on each row.
    await expect(page.locator('.canvas [data-part="Stamp (urgent)"]')).toHaveCount(2)
    await expect(page.locator('.canvas [data-part="Urgent band"]')).toHaveCount(2)
    await page.screenshot({ path: join(scratch, '06-dispatches.png') })
    await show('Message Index: an urgent dispatch')
    await expect(page.locator('.canvas [data-part="Urgent band across the dispatch"]')).toHaveCount(1)
    await answer({ open: [dir] })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.notice.success').last()).toContainText('Saved 1 file')
    const look = JSON.parse(readFileSync(join(dir, 'look.json'), 'utf8'))
    expect(look.messages.header).toBe('Cable')
    expect(look.messages.stamps.Fleets).toBe('Convoy')
    expect(look.messages.urgent).toEqual(['Conflict', 'Missions'])
  })

  test('a dialog is an order sheet: parchment, its words in ink', async () => {
    await openFolder(ww2('sheet'))
    await show('Dialogs (Confirm Scrap, Retire, Leave Game, Pause, refusals…)')
    const words = page.locator('.canvas [data-part="Label on the order sheet"]').first()
    await expect(words).toHaveCSS('color', rgb('#2a2620'))
    await page.getByLabel('ink hex', { exact: true }).fill('#553311')
    await expect(words).toHaveCSS('color', rgb('#553311'))
  })
})

test('a new pack: start a look from a preset, Undo takes it back, and it saves with the pack', async () => {
  await page.getByRole('button', { name: 'New', exact: true }).click()
  const discard = page.getByRole('dialog').getByRole('button', { name: 'Discard' })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await page.getByRole('button', { name: 'From scratch' }).click()
  await page.getByLabel('Pack id').fill('look-e2e')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.locator('.nav-item', { hasText: 'Look' }).click()
  await expect(page.getByText('This pack has no look')).toBeVisible()
  await page.screenshot({ path: join(scratch, '05-start.png') })
  await page.getByRole('button', { name: 'Start from Plain grey' }).click()
  await expect(page.locator('.canvas')).toBeVisible()
  await expect(page.locator('.toolbar .status')).toHaveText('Valid')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('This pack has no look')).toBeVisible()
  await page.getByRole('button', { name: 'Redo' }).click()
  await answer({ open: [scratch] })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.notice.success').last()).toContainText('Saved')
  const saved = JSON.parse(readFileSync(join(scratch, 'look-e2e', 'look.json'), 'utf8'))
  expect(saved.colors).toEqual(PRESETS.find((p) => p.id === 'plain-grey')!.colors)
})

test("a new pack: start from another pack's look.json", async () => {
  test.skip(!haveLook, 'needs a faction-wars checkout with the WWII look')
  const other = join(scratch, 'other-look.json')
  writeFileSync(other, gamePack('ww2').get('look.json')!)
  await page.getByRole('button', { name: 'New', exact: true }).click()
  const discard = page.getByRole('dialog').getByRole('button', { name: 'Discard' })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await page.getByRole('button', { name: 'From scratch' }).click()
  await page.getByLabel('Pack id').fill('borrow-e2e')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await page.locator('.nav-item', { hasText: 'Look' }).click()
  await answer({ open: [other] })
  await page.getByRole('button', { name: 'Choose a look.json…' }).click()
  await expect(page.locator('.notice').last()).toContainText('Left behind')
  await expect(page.locator('.notice').last()).toContainText('side axis')
  await expect(page.locator('.notice').last()).toContainText('map inset (look/europe_1941.jpg)')
  await expect(page.getByLabel('brass hex', { exact: true })).toHaveValue('#a88a4e')
  await expect(page.locator('.toolbar .status')).toHaveText('Valid')
})

test('In the game: without Godot where the settings say, it says so and will not start', async () => {
  await page.locator('.nav-item', { hasText: 'Look' }).click()
  await page.getByRole('tab', { name: 'In the game' }).click()
  const godot = page.getByLabel('Godot', { exact: true })
  await godot.fill(join(scratch, 'no-godot-here.exe'))
  await godot.blur()
  await expect(page.locator('.render-settings')).toContainText('Godot was not found')
  await expect(page.getByRole('button', { name: 'Render in the game' })).toBeDisabled()
  // The settings live in the test's own user data, never the user's.
  expect(existsSync(join(scratch, 'user-data', 'render-settings.json'))).toBe(true)
})

test('In the game: the look, an unsaved change included, rendered by the real game', async () => {
  test.skip(process.env.FWE_RENDER !== '1' || !process.env.FWE_GODOT || !haveLook, 'FWE_RENDER=1 and FWE_GODOT render with the real game (a game window opens)')
  test.setTimeout(900_000)
  await openFolder(ww2('render'))
  await page.getByRole('tab', { name: 'Colours and contrast' }).click()
  await page.getByLabel('paper hex', { exact: true }).fill('#ffd0e0')
  await page.getByRole('tab', { name: 'In the game' }).click()
  for (const [label, value] of [
    ['Godot', process.env.FWE_GODOT!],
    ['Game folder', resolve(process.env.FACTION_WARS_DIR ?? join(root, '..', 'faction-wars'))]
  ]) {
    const field = page.getByLabel(label, { exact: true })
    await field.fill(value)
    await field.blur()
  }
  await expect(page.getByRole('button', { name: 'Render in the game' })).toBeEnabled()
  await page.getByRole('button', { name: 'Render in the game' }).click()
  await expect(page.locator('.shot')).toHaveCount(24, { timeout: 900_000 })
  await expect(page.locator('.render-go')).toContainText('Rendered by the game at')
  await page.screenshot({ path: join(scratch, '06-rendered.png') })
  // A change after the render is flagged.
  await page.getByRole('tab', { name: 'Colours and contrast' }).click()
  await page.getByLabel('paper hex', { exact: true }).fill('#ffffff')
  await page.getByRole('tab', { name: 'In the game' }).click()
  await expect(page.locator('.render-go')).toContainText('The look has changed since this render')
})
