// Godot 4 behaviours the game's look check leans on, so rule 31's messages
// read exactly as the game prints them. Stricter than model.ts's gdStr, which
// the rest of the validator uses: a whole float prints "5.0", null "<null>".

/** Godot's str() of a parsed JSON value. The JSON parser gives floats, so a
 * whole number prints with ".0"; inside an array or object, text is quoted. */
export function gdStr(v: unknown): string {
  return gdStrInner(v, false)
}

function gdStrInner(v: unknown, nested: boolean): string {
  if (v === null || v === undefined) return '<null>'
  if (typeof v === 'string') return nested ? JSON.stringify(v) : v
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return gdFloat(v)
  if (Array.isArray(v)) return '[' + v.map((x) => gdStrInner(x, true)).join(', ') + ']'
  const entries = Object.entries(v as Record<string, unknown>)
  if (entries.length === 0) return '{  }'
  return '{ ' + entries.map(([k, x]) => `${JSON.stringify(k)}: ${gdStrInner(x, true)}`).join(', ') + ' }'
}

function gdFloat(n: number): string {
  if (Number.isNaN(n)) return 'nan'
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : '-inf'
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return `${n}.0`
  return String(n)
}

/** String.strip_edges(): strips characters up to and including the space (code 32). */
export function gdStripEdges(s: string): string {
  let a = 0
  let b = s.length
  while (a < b && s.charCodeAt(a) <= 32) a++
  while (b > a && s.charCodeAt(b - 1) <= 32) b--
  return s.slice(a, b)
}

/** `v is float or v is int` for a parsed JSON value. */
export function isNumber(v: unknown): v is number {
  return typeof v === 'number'
}

export function isDict(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** JsonUtil.data_keys: a keyed map's keys without its comments ("_comment", "_note"). */
export function dataKeys(d: Record<string, unknown>): string[] {
  return Object.keys(d).filter((k) => !k.startsWith('_'))
}

/** JsonUtil.get_ci: exact key first, then a case-folded scan. */
export function ci(d: unknown, key: string): unknown {
  if (!isDict(d)) return undefined
  if (Object.prototype.hasOwnProperty.call(d, key)) return d[key]
  const lower = key.toLowerCase()
  for (const k of Object.keys(d)) if (k.toLowerCase() === lower) return d[k]
  return undefined
}

/** Dictionary.get(key, default): the default only when the key is absent. */
export function dget(d: Record<string, unknown>, key: string, def: unknown): unknown {
  return Object.prototype.hasOwnProperty.call(d, key) ? d[key] : def
}

export function dhas(d: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(d, key)
}
