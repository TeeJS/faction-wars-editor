// Drives the real app: new pack, edit, save, export, reopen; and opening a shipped
// pack. Native dialogs are replaced in the main process with canned answers.

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { starfieldPng } from '../../src/core/png'
import { checkImportable } from '../../src/core/zip'

const root = resolve(__dirname, '..', '..')
const scratch = join(root, 'tests', '.scratch', 'e2e')
const FW = resolve(process.env.FACTION_WARS_DIR ?? join(root, '..', 'faction-wars'))

let app: ElectronApplication
let page: Page

async function answerDialogs(answers: { open?: string[]; save?: string }): Promise<void> {
  await app.evaluate(({ dialog }, a) => {
    const d = dialog as unknown as Record<string, unknown>
    d.showOpenDialog = async () => ({ canceled: !a.open, filePaths: a.open ?? [] })
    d.showSaveDialog = async () => ({ canceled: !a.save, filePath: a.save })
    d.showMessageBoxSync = () => 0
  }, answers)
}

test.beforeAll(async () => {
  rmSync(scratch, { recursive: true, force: true })
  mkdirSync(scratch, { recursive: true })
  // FWE_APP_EXE runs the packaged app instead of the dev build; Linux CI runners need --no-sandbox.
  const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : []
  app = process.env.FWE_APP_EXE
    ? await electron.launch({ executablePath: process.env.FWE_APP_EXE, args: sandbox })
    : await electron.launch({ args: [...sandbox, join(root, 'out', 'main', 'index.js')], env: { ...process.env, NODE_ENV: 'test' } })
  page = await app.firstWindow()
  await page.waitForSelector('text=Faction Wars Pack Editor')
})

test.afterAll(async () => {
  await app?.close()
})

test('new pack from scratch: valid, saved as a folder, exported as an importable zip', async () => {
  await page.getByRole('button', { name: /New pack/ }).click()
  await page.getByRole('button', { name: 'From scratch' }).click()
  const id = page.getByLabel('Pack id')
  await id.fill('e2e-pack')
  await page.getByLabel('Display name').fill('E2E Pack')
  await page.getByRole('button', { name: 'Create' }).click()
  await expect(page.locator('.toolbar .status')).toHaveText('Valid')
  await page.screenshot({ path: join(scratch, '01-new-pack.png') })

  // Edit a unit's name through the form.
  await page.getByRole('button', { name: 'Units', exact: true }).click()
  await page.getByRole('option', { name: /Battleship A/ }).click()
  const name = page.getByLabel('Display name')
  await name.fill('Dreadnought A')
  await name.press('Enter')
  await expect(page.getByRole('option', { name: /Dreadnought A/ })).toBeVisible()
  await page.screenshot({ path: join(scratch, '02-units.png') })

  // Save: the folder dialog answers with the scratch dir; the pack lands in <scratch>/e2e-pack.
  await answerDialogs({ open: [scratch] })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.notice.success').last()).toContainText('Saved')
  const folder = join(scratch, 'e2e-pack')
  expect(existsSync(join(folder, 'pack.json'))).toBe(true)
  expect(readFileSync(join(folder, 'units.json'), 'utf8')).toContain('Dreadnought A')

  // Export.
  const zipPath = join(scratch, 'e2e-pack.zip')
  await answerDialogs({ save: zipPath })
  await page.getByRole('button', { name: 'Export Zip' }).click()
  await expect(page.locator('.notice.success').last()).toContainText('Exported')
  const bytes = new Uint8Array(readFileSync(zipPath))
  expect(await checkImportable(bytes)).toBe('')
  const manifest = JSON.parse(strFromU8(unzipSync(bytes)['manifest.json']))
  expect(manifest.id).toBe('e2e-pack')
})

test('the galaxy map shows the planets', async () => {
  await page.getByRole('button', { name: 'Galaxy Map' }).click()
  await expect(page.locator('.planet')).toHaveCount(15)
  await page.screenshot({ path: join(scratch, '03-map.png') })
})

test('opening a shipped pack folder: valid, and offers to make a copy of the built-in pack', async () => {
  test.skip(!existsSync(join(FW, 'packs', 'ww2', 'pack.json')), 'needs a faction-wars checkout')
  await answerDialogs({ open: [join(FW, 'packs', 'ww2')] })
  await page.getByRole('button', { name: 'Open Folder' }).click()
  // The open pack is saved, so no discard prompt.
  await expect(page.locator('.toolbar .pack-name')).toContainText('ww2')
  await expect(page.locator('.toolbar .status')).toContainText('Valid')
  await expect(page.locator('.problems')).toContainText('this is the built-in')
  await page.getByRole('button', { name: 'Galaxy Map' }).click()
  await expect(page.locator('.planet').first()).toBeVisible()
  await page.screenshot({ path: join(scratch, '04-ww2-map.png') })
  await page.getByRole('button', { name: 'Logistics' }).click()
  await page.screenshot({ path: join(scratch, '05-ww2-logistics.png') })
  await page.getByRole('button', { name: 'Rules', exact: true }).click()
  await page.screenshot({ path: join(scratch, '06-ww2-rules.png') })
})

test('make my own copy of the built-in pack, then give a character a portrait and text', async () => {
  test.skip(!existsSync(join(FW, 'packs', 'ww2', 'pack.json')), 'needs a faction-wars checkout')
  // The previous test left the built-in WW2 pack open.
  await page.locator('.problems button.fix', { hasText: 'Make my own copy' }).click()
  await page.getByLabel('Your pack id').fill('ww2-e2e-mod')
  await page.getByLabel('Display name (the pack picker card)').fill('WW2 E2E Mod')
  await answerDialogs({ open: [scratch] })
  await page.getByRole('button', { name: 'Make copy' }).click()
  await expect(page.locator('.notice.success').last()).toContainText('Saved')
  const mod = join(scratch, 'ww2-e2e-mod')
  expect(JSON.parse(readFileSync(join(mod, 'pack.json'), 'utf8')).id).toBe('ww2-e2e-mod')
  expect(existsSync(join(mod, 'world_1941.jpg'))).toBe(true)
  await expect(page.locator('.toolbar .pack-name')).toContainText('ww2-e2e-mod')
  await expect(page.locator('.problems')).not.toContainText('this is the built-in')
  await page.screenshot({ path: join(scratch, '07-own-copy.png') })

  // Pictures: add a portrait from a PNG on disk, and Encyclopedia text.
  const png = join(scratch, 'portrait.png')
  writeFileSync(png, starfieldPng(80, 80, 3))
  await page.getByRole('button', { name: 'Characters', exact: true }).click()
  const portrait = page.locator('.picture-card', { hasText: 'Portrait' })
  await expect(portrait).toContainText('none')
  await answerDialogs({ open: [png] })
  await portrait.getByRole('button', { name: 'Add my own…' }).click()
  await expect(portrait).toContainText('this pack · 80×80')
  const text = page.getByLabel('Encyclopedia text')
  await text.fill('Written for the E2E mod.')
  await text.blur()
  await page.screenshot({ path: join(scratch, '08-pictures.png') })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.notice.success').last()).toContainText('Saved')
  const first = JSON.parse(readFileSync(join(mod, 'characters.json'), 'utf8')).characters[0].id
  expect(existsSync(join(mod, 'art', 'portraits', 'characters', `${first}.png`))).toBe(true)
  expect(JSON.parse(readFileSync(join(mod, 'art', 'descriptions.json'), 'utf8')).characters[first]).toBe('Written for the E2E mod.')
})

test("the Cockpit's screen corners: drawn, and a corner drags", async () => {
  const sw = join(FW, 'packs', 'star-wars-rebellion')
  test.skip(!existsSync(join(sw, 'pack.json')), 'needs a faction-wars checkout')
  // A copy, so nothing can ever write to the game checkout.
  const copy = join(scratch, 'star-wars-rebellion')
  cpSync(sw, copy, { recursive: true, filter: (p) => !/[\\/]original([\\/]|$)/i.test(p) })
  await answerDialogs({ open: [copy] })
  await page.getByRole('button', { name: 'Open Folder' }).click()
  await expect(page.locator('.toolbar .pack-name')).toContainText('star-wars-rebellion')
  await page.getByRole('button', { name: 'Cockpit Menu' }).click()
  // The pack gives corners for 7 screens: 3 difficulties, 3 galaxy sizes, the victory monitor.
  await expect(page.locator('.quad-outline')).toHaveCount(7)
  // Select difficulty:easy (the first region after the readout), then drag its top-left corner.
  await page.locator('.region').nth(1).locator('rect').first().click()
  const corners = page.locator('.quad-outline.on .corner')
  await expect(corners).toHaveCount(4)
  const polygon = page.locator('.quad-outline.on polygon')
  const before = await polygon.getAttribute('points')
  const box = (await corners.first().boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 15, { steps: 5 })
  await page.mouse.up()
  const after = await polygon.getAttribute('points')
  expect(after).not.toBe(before)
  expect(Number(after!.split(' ')[0].split(',')[0])).toBeGreaterThan(Number(before!.split(' ')[0].split(',')[0]))
  await expect(page.locator('.toolbar .status')).toContainText('Valid')
  await page.screenshot({ path: join(scratch, '09-cockpit-corners.png') })
})

test('forms for the faction adjective and the Cockpit monitors', async () => {
  test.skip(!existsSync(join(FW, 'packs', 'star-wars-rebellion', 'pack.json')), 'needs a faction-wars checkout')
  // The Star Wars copy the previous test opened.
  await page.getByRole('button', { name: 'Factions', exact: true }).click()
  await page.getByRole('listbox', { name: 'Factions' }).getByRole('option', { name: /empire/i }).click()
  await expect(page.getByLabel('Adjective')).toHaveValue('Imperial')

  await page.getByRole('button', { name: 'Cockpit Menu' }).click()
  await expect(page.getByText('Monitor pictures')).toBeVisible()
  await page.getByRole('button', { name: /^▸ 1: easy\.png/ }).click()
  const frames = page.getByLabel('Frames', { exact: true })
  await expect(frames).toHaveValue('30')
  await expect(page.getByLabel('Top-left x')).toHaveValue('61')
  // A bad value is the game's error, word for word; fixing it clears it.
  await frames.fill('0')
  await frames.press('Enter')
  await expect(page.locator('.problems')).toContainText("pack.json menu.monitors[0]: 'frames' must be 1 or more.")
  await page.screenshot({ path: join(scratch, '11-monitors.png') })
  await frames.fill('30')
  await frames.press('Enter')
  await expect(page.locator('.problems')).not.toContainText("'frames' must be 1 or more")
  await page.screenshot({ path: join(scratch, '12-monitor-preview.png') })
})

test("the original's pictures are never copied in, and the card picture has a field", async () => {
  // A stand-in art set holding one portrait (the real one is the player's own).
  const portrait = starfieldPng(80, 80, 11)
  const manifest = {
    format: 1,
    kind: 'art_set',
    id: 'swr-original',
    title: 'Test art set',
    exporter: 'e2e',
    created_utc: '2026-09-24T00:00:00Z',
    files: { 'portraits/characters/test_hero.png': createHash('sha256').update(portrait).digest('hex') }
  }
  const setZip = join(scratch, 'test.art.zip')
  writeFileSync(setZip, zipSync({ 'portraits/characters/test_hero.png': portrait, 'manifest.json': strToU8(JSON.stringify(manifest)) }))
  const copied = join(scratch, 'copied-portrait.png')
  writeFileSync(copied, portrait)

  // Point the editor at it (the Pack page's "choose…").
  await page.getByRole('button', { name: 'Pack', exact: true }).click()
  await answerDialogs({ open: [setZip] })
  await page.getByRole('button', { name: 'choose…' }).click()
  await expect(page.locator('.notice.success').last()).toContainText('Using the art set at')
  await expect(page.getByText('Card picture')).toBeVisible()
  await page.getByText('Card picture').scrollIntoViewIfNeeded()
  await page.screenshot({ path: join(scratch, '10-card-picture.png') })

  // Adding that portrait to a character is refused, and nothing is written.
  await page.getByRole('button', { name: 'Characters', exact: true }).click()
  const card = page.locator('.picture-card', { hasText: 'Portrait' })
  await answerDialogs({ open: [copied] })
  await card.getByRole('button', { name: /Add my own|Replace/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText("That's the original's picture")
  await expect(dialog).toContainText('Leave it empty: it is already in your art set.')
  await page.screenshot({ path: join(scratch, '10-original-refused.png') })
  await dialog.getByRole('button').last().click()
  await expect(card).not.toContainText('this pack')

  // A pack folder that already carries it gets an early warning, with a fix.
  const carrier = join(scratch, 'e2e-pack')
  mkdirSync(join(carrier, 'art', 'portraits', 'characters'), { recursive: true })
  writeFileSync(join(carrier, 'art', 'portraits', 'characters', 'copied.png'), portrait)
  await answerDialogs({ open: [carrier] })
  await page.getByRole('button', { name: 'Open Folder' }).click()
  const discard = page.getByRole('dialog').getByRole('button', { name: 'Discard' })
  if (await discard.isVisible().catch(() => false)) await discard.click()
  await expect(page.locator('.toolbar .pack-name')).toContainText('e2e-pack')
  const warning = page.locator('.problems', { hasText: "art/portraits/characters/copied.png: this is the original's picture" })
  await expect(warning).toBeVisible()
  await expect(page.locator('.problems button.fix', { hasText: 'Remove it' })).toBeVisible()
})
