// Validation rule 32, a line-for-line port of the game's check of credits.json
// (TeeJS/faction-wars origin/main 4ad04bf, src/data/pack_loader.gd Load's
// optional read and _validate_credits; SCHEMA.md section 16): each asset names
// a title, an author and a licence and one or more files the pack ships; its
// links, when given, are https addresses. Same checks, same order, same
// message text; tests/gamecheck.test.ts proves it against the game.
//
// That every picture and font a pack ships HAS an entry is the game's own
// tests/asset_credits.gd, not a load rule: not checked here.

import { dget, dhas, gdStr, gdStripEdges, isDict } from './look/godot'

export const CREDITS_FILE = 'credits.json'

export interface ReadCredits {
  /** The `assets` list, or null when the pack ships no credits (or they could not be read). */
  assets: unknown[] | null
  errors: string[]
}

/** Load's read of the optional file: blank is none; present, it must be an object with an `assets` list. */
export function readCredits(text: string | null, packDir: string): ReadCredits {
  if (text === null || gdStripEdges(text).length === 0) return { assets: null, errors: [] }
  let data: unknown
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch (e) {
    // The game prints its own parser's wording here; the editor cannot match it.
    return { assets: null, errors: [`${packDir}/credits.json: malformed JSON - ${(e as Error).message}`] }
  }
  if (isDict(data) && Array.isArray(dget(data, 'assets', null))) return { assets: data.assets as unknown[], errors: [] }
  return { assets: null, errors: ['credits.json: must be an object with an `assets` list.'] }
}

/** _pack_has: a file the pack ships; never a path that climbs out of it. */
function packHas(hasFile: (rel: string) => boolean, rel: string): boolean {
  if (gdStripEdges(rel).length === 0 || rel.includes('..')) return false
  return hasFile(rel)
}

/** Rule 32 on the `assets` list. */
export function validateCredits(assets: unknown[], packDir: string, hasFile: (rel: string) => boolean): string[] {
  const errors: string[] = []
  assets.forEach((a, i) => {
    const where = `credits.json assets[${i}]`
    if (!isDict(a)) {
      errors.push(`${where}: must be an object.`)
      return
    }
    for (const key of ['title', 'author', 'licence'])
      if (gdStripEdges(gdStr(dget(a, key, ''))).length === 0) errors.push(`${where}: \`${key}\` is missing.`)
    for (const key of ['source', 'licence_url'])
      if (dhas(a, key) && !gdStr(a[key]).startsWith('https://')) errors.push(`${where}: \`${key}\` must be an https:// address.`)
    const files = dget(a, 'files', null)
    if (!Array.isArray(files) || files.length === 0) {
      errors.push(`${where}: \`files\` must list the pack files it credits.`)
      return
    }
    for (const f of files) if (!packHas(hasFile, gdStr(f))) errors.push(`${where}: '${gdStr(f)}' is not in ${packDir}.`)
  })
  return errors
}
