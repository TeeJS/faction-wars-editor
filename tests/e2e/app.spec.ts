// Drives the real app: new pack, edit, save, export, reopen; and opening a shipped
// pack. Native dialogs are replaced in the main process with canned answers.

import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
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
