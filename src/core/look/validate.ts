// Validation rule 31, a line-for-line port of the game's check of look.json
// (TeeJS/faction-wars origin/main a46c63f, src/data/pack_loader.gd
// _read_optional_json, _validate_look, _require_color, _pack_has). Same
// checks, same order, same message text: a message here is exactly what the
// game prints for the pack. scripts/gamecheck.ps1 proves it against the game.
//
// Only what stops the game loading the pack is checked. Contrast is shown
// elsewhere and never blocks (the modding rule: users decide).

import { dataKeys, dget, dhas, gdStr, gdStripEdges, isDict, isNumber } from './godot'
import {
  KNOWN_DOSSIER_KEYS,
  KNOWN_LOOK_COLORS,
  KNOWN_LOOK_FONTS,
  KNOWN_LOOK_METRICS,
  KNOWN_LOOK_SIZES,
  KNOWN_LOOK_TEXTURES,
  KNOWN_MESSAGE_CATEGORIES,
  KNOWN_MESSAGES_KEYS
} from './vocab'

export interface LookContext {
  /** The pack folder as the game names it: forward slashes, no trailing slash. */
  packDir: string
  /** The faction ids factions.json declares. */
  factionIds: readonly string[]
  /** Whether the pack ships the file at `rel` (a path inside the pack folder). */
  hasFile: (rel: string) => boolean
}

/** How the game names a folder in its messages. */
export function gamePackDir(dir: string): string {
  return dir.replace(/\\/g, '/').replace(/\/+$/, '')
}

export interface ReadLook {
  /** The parsed look, or null when the pack has none (or it could not be read). */
  look: Record<string, unknown> | null
  errors: string[]
}

/** _read_optional_json plus the object check: a blank file is no look at all. */
export function readLook(text: string | null, ctx: LookContext): ReadLook {
  if (text === null || gdStripEdges(text).length === 0) return { look: null, errors: [] }
  let data: unknown
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
  } catch (e) {
    // The game prints its own parser's wording here; the editor cannot match it.
    return { look: null, errors: [`${ctx.packDir}/look.json: malformed JSON - ${(e as Error).message}`] }
  }
  if (!isDict(data)) return { look: null, errors: ['look.json: must be an object.'] }
  return { look: data, errors: [] }
}

const joined = (a: readonly string[]) => a.join(', ')

/** String.length() and indexing by code point, as Godot counts. */
function codePoints(s: string): string[] {
  return Array.from(s)
}

function requireColor(value: string, where: string, errors: string[]): void {
  if (gdStripEdges(value).length === 0) {
    errors.push(`${where}: missing.`)
    return
  }
  const cp = codePoints(value)
  let ok = cp.length === 7 && cp[0] === '#'
  if (ok)
    for (let i = 1; i < 7; i++)
      if (!/^[0-9a-fA-F]$/.test(cp[i])) {
        ok = false
        break
      }
  if (!ok) errors.push(`${where}: '${value}' is not a #rrggbb color.`)
}

/** _pack_has: a file the pack ships; never a path that climbs out of it. */
function packHas(ctx: LookContext, rel: string): boolean {
  if (gdStripEdges(rel).length === 0 || rel.includes('..')) return false
  return ctx.hasFile(rel)
}

/** Rule 31 on a parsed look. An empty look is no look: nothing to check. */
export function validateLook(look: Record<string, unknown>, ctx: LookContext): string[] {
  const errors: string[] = []
  if (Object.keys(look).length === 0) return errors

  const colors = dget(look, 'colors', null)
  if (!isDict(colors)) {
    errors.push("look.json: `colors` must be an object of the look's colours.")
  } else {
    for (const key of KNOWN_LOOK_COLORS) if (!dhas(colors, key)) errors.push(`look.json colors: '${key}' is missing.`)
    for (const key of dataKeys(colors)) {
      if (!(KNOWN_LOOK_COLORS as readonly string[]).includes(key))
        errors.push(`look.json colors: '${key}' is not a known colour. Known: ${joined(KNOWN_LOOK_COLORS)}.`)
      else requireColor(gdStr(colors[key]), `look.json colors.${key}`, errors)
    }
  }

  const sides = dget(look, 'sides', {})
  if (!isDict(sides)) {
    errors.push('look.json: `sides` must be an object of faction id -> colour.')
  } else {
    for (const key of dataKeys(sides)) {
      if (!ctx.factionIds.includes(key)) errors.push(`look.json sides: '${key}' is not a faction in factions.json.`)
      else requireColor(gdStr(sides[key]), `look.json sides.${key}`, errors)
    }
  }

  const fonts = dget(look, 'fonts', {})
  if (!isDict(fonts)) {
    errors.push('look.json: `fonts` must be an object of role -> face.')
  } else {
    for (const key of dataKeys(fonts)) {
      const where = `look.json fonts.${key}`
      if (!(KNOWN_LOOK_FONTS as readonly string[]).includes(key)) {
        errors.push(`${where}: not a known role. Known: ${joined(KNOWN_LOOK_FONTS)}.`)
        continue
      }
      const face = fonts[key]
      if (!isDict(face)) {
        errors.push(`${where}: must be an object with a \`file\`.`)
        continue
      }
      const file = gdStr(dget(face, 'file', ''))
      const lower = file.toLowerCase()
      if (!(lower.endsWith('.ttf') || lower.endsWith('.otf'))) errors.push(`${where}: file '${file}' is not a .ttf or .otf.`)
      else if (!packHas(ctx, file)) errors.push(`${where}: '${file}' is not in ${ctx.packDir}.`)
      if (dhas(face, 'weight')) {
        const w = face.weight
        if (!isNumber(w) || w < 100 || w > 900) errors.push(`${where}: weight must be a number from 100 to 900.`)
      }
      if (dhas(face, 'tabular') && typeof face.tabular !== 'boolean') errors.push(`${where}: tabular must be true or false.`)
    }
  }

  const blocks: [string, readonly string[], boolean][] = [
    ['sizes', KNOWN_LOOK_SIZES, true],
    ['metrics', KNOWN_LOOK_METRICS, false]
  ]
  for (const [name, known, positiveWhole] of blocks) {
    const d = dget(look, name, {})
    if (!isDict(d)) {
      errors.push(`look.json: \`${name}\` must be an object.`)
      continue
    }
    for (const key of dataKeys(d)) {
      if (!known.includes(key)) {
        errors.push(`look.json ${name}: '${key}' is not known. Known: ${joined(known)}.`)
        continue
      }
      const v = d[key]
      const number = isNumber(v)
      if (positiveWhole && (!number || v <= 0 || v !== Math.floor(v)))
        errors.push(`look.json ${name}.${key}: must be a positive whole number.`)
      else if (!positiveWhole && (!number || v < 0)) errors.push(`look.json ${name}.${key}: must be a number, 0 or more.`)
    }
  }

  if (dhas(look, 'overlay_alpha')) {
    const a = look.overlay_alpha
    if (!isNumber(a) || a < 0 || a > 1) errors.push('look.json overlay_alpha: must be a number from 0 to 1.')
  }

  const messages = dget(look, 'messages', {})
  if (!isDict(messages)) {
    errors.push('look.json: `messages` must be an object.')
  } else {
    const cats: readonly string[] = KNOWN_MESSAGE_CATEGORIES
    for (const key of dataKeys(messages))
      if (!(KNOWN_MESSAGES_KEYS as readonly string[]).includes(key))
        errors.push(`look.json messages: '${key}' is not known. Known: header, stamps, urgent.`)
    if (dhas(messages, 'header') && typeof messages.header !== 'string') errors.push('look.json messages.header: must be text.')
    const stamps = dget(messages, 'stamps', {})
    if (!isDict(stamps)) {
      errors.push('look.json messages.stamps: must be an object of category -> word.')
    } else {
      for (const key of dataKeys(stamps)) {
        if (!cats.includes(key)) errors.push(`look.json messages.stamps: '${key}' is not a message category. Known: ${joined(cats)}.`)
        else if (typeof stamps[key] !== 'string' || gdStripEdges(gdStr(stamps[key])).length === 0)
          errors.push(`look.json messages.stamps.${key}: must be a word.`)
      }
    }
    const urgent = dget(messages, 'urgent', [])
    if (!Array.isArray(urgent)) {
      errors.push('look.json messages.urgent: must be a list of message categories.')
    } else {
      for (const c of urgent) if (!cats.includes(gdStr(c))) errors.push(`look.json messages.urgent: '${gdStr(c)}' is not a message category.`)
    }
  }

  const dossier = dget(look, 'dossier', {})
  if (!isDict(dossier)) {
    errors.push('look.json: `dossier` must be an object.')
  } else {
    for (const key of dataKeys(dossier))
      if (!(KNOWN_DOSSIER_KEYS as readonly string[]).includes(key))
        errors.push(`look.json dossier: '${key}' is not known. Known: subtitle, map_rect, map_caption.`)
    for (const key of ['subtitle', 'map_caption'])
      if (dhas(dossier, key) && typeof dossier[key] !== 'string') errors.push(`look.json dossier.${key}: must be text.`)
    if (dhas(dossier, 'map_rect')) {
      const r = dossier.map_rect
      let ok = Array.isArray(r) && r.length === 4
      if (ok) {
        const arr = r as unknown[]
        for (const n of arr) ok = ok && isNumber(n) && n >= 0
        ok = ok && (arr[2] as number) > 0 && (arr[3] as number) > 0
      }
      if (!ok) errors.push("look.json dossier.map_rect: must be [x, y, w, h] in map_image's pixels, w and h above 0.")
    }
  }

  const textures = dget(look, 'textures', {})
  if (!isDict(textures)) {
    errors.push('look.json: `textures` must be an object of name -> picture.')
  } else {
    for (const key of dataKeys(textures)) {
      const where = `look.json textures.${key}`
      if (!(KNOWN_LOOK_TEXTURES as readonly string[]).includes(key)) {
        errors.push(`${where}: not a known texture. Known: ${joined(KNOWN_LOOK_TEXTURES)}.`)
        continue
      }
      const t = textures[key]
      const file = isDict(t) ? gdStr(dget(t, 'file', '')) : gdStr(t)
      if (!file.toLowerCase().endsWith('.png')) errors.push(`${where}: '${file}' is not a .png.`)
      else if (!packHas(ctx, file)) errors.push(`${where}: '${file}' is not in ${ctx.packDir}.`)
      if (isDict(t) && dhas(t, 'margin')) {
        const mg = t.margin
        if (!isNumber(mg) || mg < 0) errors.push(`${where}: margin must be a number, 0 or more.`)
      }
    }
  }
  return errors
}
