// Rule 32, credits.json, as the game checks it (pack_loader.gd Load's optional
// read and _validate_credits). The game's own cases are tests/pack_validation.gd
// _credits_case, run against its WWII pack; tests/gamecheck.test.ts proves the
// wording against the game itself.

import { describe, expect, it } from 'vitest'
import { readCredits, validateCredits } from '../src/core/credits'
import { createStarterPack } from '../src/core/starter'
import { validatePack } from '../src/core/validate'
import { gameBytes, gamePack } from './look/game'

const WW2_DIR = 'res://packs/ww2'
const ww2Has = (rel: string) => rel === 'world_1941.jpg'

describe('reading credits.json, as Load does', () => {
  it('no file, or a blank one, is no credits and no error', () => {
    expect(readCredits(null, WW2_DIR)).toEqual({ assets: null, errors: [] })
    expect(readCredits(' \n\t', WW2_DIR)).toEqual({ assets: null, errors: [] })
  })
  it('an object with an `assets` list is read, a byte-order mark and all', () => {
    expect(readCredits('﻿{"assets": [1]}', WW2_DIR)).toEqual({ assets: [1], errors: [] })
  })
  it('broken JSON names the file', () => {
    expect(readCredits('{', WW2_DIR).errors[0]).toMatch(/^res:\/\/packs\/ww2\/credits\.json: malformed JSON - /)
  })
  for (const text of ['[]', '{}', '{"assets": {}}', '{"Assets": []}', '"assets"'])
    it(`${text} is not an object with an \`assets\` list`, () => {
      expect(readCredits(text, WW2_DIR)).toEqual({ assets: null, errors: ['credits.json: must be an object with an `assets` list.'] })
    })
})

describe('credits.json (rule 32), as the game checks it', () => {
  const credit = { title: 'Map', author: 'Someone', licence: 'CC0', files: ['world_1941.jpg'] }
  const errs = (assets: unknown[]) => validateCredits(assets, WW2_DIR, ww2Has)
  const where = 'credits.json assets[0]'
  // The game's own _credits_case changes.
  const cases: [string, Record<string, unknown>, string][] = [
    ['a credit with no author', { author: '' }, `${where}: \`author\` is missing.`],
    ['a credit with no licence', { licence: '' }, `${where}: \`licence\` is missing.`],
    ['a credit naming no files', { files: [] }, `${where}: \`files\` must list the pack files it credits.`],
    ['a credit naming a file the pack lacks', { files: ['nope.png'] }, `${where}: 'nope.png' is not in ${WW2_DIR}.`],
    ['a credit link that is not https', { source: 'http://example.com' }, `${where}: \`source\` must be an https:// address.`]
  ]
  for (const [what, change, want] of cases) it(what, () => expect(errs([{ ...credit, ...change }])).toEqual([want]))

  it('a good credit, links and all, passes', () => {
    expect(errs([{ ...credit, source: 'https://example.com', licence_url: 'https://example.com/l' }])).toEqual([])
  })
  it('an entry that is not an object', () => {
    expect(errs(['x', credit])).toEqual(["credits.json assets[0]: must be an object."])
  })
  it('every check on one entry, in the game order', () => {
    expect(errs([credit, { title: ' ', licence_url: 'ftp://x', files: 'map' }])).toEqual([
      'credits.json assets[1]: `title` is missing.',
      'credits.json assets[1]: `author` is missing.',
      'credits.json assets[1]: `licence` is missing.',
      'credits.json assets[1]: `licence_url` must be an https:// address.',
      'credits.json assets[1]: `files` must list the pack files it credits.'
    ])
  })
  it("reads values as Godot's str() does: a number is text, null is '<null>'", () => {
    expect(errs([{ ...credit, title: null, licence: 5, source: 5, files: [3] }])).toEqual([
      `${where}: \`source\` must be an https:// address.`,
      `${where}: '3.0' is not in ${WW2_DIR}.`
    ])
  })
  it('never a blank path, nor one that climbs out of the pack', () => {
    expect(errs([{ ...credit, files: [' ', '../world_1941.jpg', 'world_1941.jpg'] }])).toEqual([
      `${where}: ' ' is not in ${WW2_DIR}.`,
      `${where}: '../world_1941.jpg' is not in ${WW2_DIR}.`
    ])
  })
  it('keys are exact, as Dictionary.get is', () => {
    expect(errs([{ Title: 'Map', author: 'Someone', licence: 'CC0', files: ['world_1941.jpg'] }])).toEqual([`${where}: \`title\` is missing.`])
  })
})

const haveCredits = gameBytes('packs/ww2/credits.json') !== null
describe.runIf(haveCredits)("the game's WWII credits.json", () => {
  it('passes rule 32', () => {
    const files = gamePack('ww2')
    const r = readCredits(new TextDecoder().decode(files.get('credits.json')), WW2_DIR)
    expect(r.errors).toEqual([])
    expect(r.assets!.length).toBeGreaterThan(0)
    expect(validateCredits(r.assets!, WW2_DIR, (rel) => files.has(rel))).toEqual([])
  })
})

describe('credits.json in a whole pack', () => {
  const starter = () => createStarterPack({ id: 'credits', displayName: 'Credits', sides: [{ id: 'rome', displayName: 'Rome' }, { id: 'carthage', displayName: 'Carthage' }] })

  it('a good one is clean', () => {
    const doc = starter()
    doc.edit('credits', (e) => e.setFile('credits.json', new TextEncoder().encode('{"assets": [{"title": "t", "author": "a", "licence": "l", "files": ["map.png"]}]}')))
    expect(validatePack(doc).map((e) => e.message)).toEqual([])
  })
  it('a read error comes before the rules, a check after them; both point at Files & Art', () => {
    const doc = starter()
    doc.edit('break', (e) => {
      e.setFile('credits.json', new TextEncoder().encode('[]'))
      e.set('pack.json', ['faction_count'], 3)
    })
    const issues = validatePack(doc).map((i) => [i.message, i.target?.page])
    expect(issues).toEqual([
      ['credits.json: must be an object with an `assets` list.', 'files'],
      ['pack.json: faction_count is 3 but factions.json declares 2.', 'pack']
    ])
    doc.edit('break', (e) => e.setFile('credits.json', new TextEncoder().encode('{"assets": [{"title": "t", "author": "a", "licence": "l", "files": ["gone.png"]}]}')))
    expect(validatePack(doc).map((i) => [i.message, i.target?.page])).toEqual([
      ['pack.json: faction_count is 3 but factions.json declares 2.', 'pack'],
      ["credits.json assets[0]: 'gone.png' is not in the pack folder.", 'files']
    ])
  })
})
