// One JSON file held as its TEXT. Every edit is a minimal text edit computed by
// jsonc-parser, so key order, number spelling, whitespace and unknown fields
// outside the edited span survive untouched. An unedited file is written back
// from its original bytes - the game's pack hash covers raw bytes.

import {
  applyEdits,
  findNodeAtLocation,
  modify,
  parseTree,
  type FormattingOptions,
  type JSONPath,
  type Node
} from 'jsonc-parser'

export type { JSONPath }

const utf8 = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })
const utf8enc = new TextEncoder()

export interface ParseProblem {
  message: string
}

export class JsonText {
  private _text: string
  private readonly _original: string
  readonly originalBytes: Uint8Array | null
  readonly hadBom: boolean
  private _value: unknown = undefined
  private _parsed = false
  private _problem: ParseProblem | null = null

  private constructor(text: string, originalBytes: Uint8Array | null, hadBom: boolean) {
    this._text = text
    this._original = text
    this.originalBytes = originalBytes
    this.hadBom = hadBom
  }

  static fromBytes(bytes: Uint8Array): JsonText {
    let text = utf8.decode(bytes)
    const bom = text.charCodeAt(0) === 0xfeff
    if (bom) text = text.slice(1)
    return new JsonText(text, bytes, bom)
  }

  /** A new file (not on disk yet): 2-space indent, LF, trailing newline, like the shipped packs. */
  static fromValue(value: unknown): JsonText {
    const t = new JsonText('', null, false)
    t._text = JSON.stringify(value, null, 2) + '\n'
    return t
  }

  static fromText(text: string): JsonText {
    const t = new JsonText('', null, false)
    t._text = text
    return t
  }

  get text(): string {
    return this._text
  }

  /** True when the text differs from what was loaded (or the file is new). */
  get dirty(): boolean {
    return this.originalBytes === null || this._text !== this._original
  }

  /** The bytes to write: the original bytes when nothing changed. */
  toBytes(): Uint8Array {
    if (!this.dirty && this.originalBytes) return this.originalBytes
    const body = utf8enc.encode(this._text)
    if (!this.hadBom) return body
    const out = new Uint8Array(body.length + 3)
    out.set([0xef, 0xbb, 0xbf])
    out.set(body, 3)
    return out
  }

  /** The parsed value (strict JSON, like the game's parser), or undefined when malformed. */
  get value(): unknown {
    this.ensureParsed()
    return this._value
  }

  get problem(): ParseProblem | null {
    this.ensureParsed()
    return this._problem
  }

  private ensureParsed(): void {
    if (this._parsed) return
    this._parsed = true
    this._problem = null
    this._value = undefined
    if (this._text.trim().length === 0) {
      this._problem = { message: 'missing or empty.' }
      return
    }
    try {
      this._value = JSON.parse(this._text)
    } catch (e) {
      this._problem = { message: `malformed JSON - ${(e as Error).message}` }
    }
  }

  /** Line ending and indent in this file's own style (the shipped packs are CRLF on a
   * Windows checkout, LF in git), so edits match their surroundings. */
  get formatting(): FormattingOptions {
    const eol = this._text.includes('\r\n') ? '\r\n' : '\n'
    const m = /\n([ \t]+)\S/.exec(this._text)
    if (m && m[1].startsWith('\t')) return { insertSpaces: false, tabSize: 1, eol }
    const size = m ? m[1].length : 2
    return { insertSpaces: true, tabSize: size > 0 && size <= 8 ? size : 2, eol }
  }

  /** Replaces the whole text (the raw editor). The caller validates first. */
  setText(text: string): void {
    this._text = text
    this._parsed = false
  }

  /** The actual path in this file for `path`, resolving each key case-insensitively the
   * way the game does (JsonUtil.get_ci: exact match first, then a case-folded scan). */
  resolve(path: JSONPath): JSONPath {
    const out: JSONPath = []
    let cur: unknown = this.value
    for (const seg of path) {
      if (typeof seg === 'number') {
        out.push(seg)
        cur = Array.isArray(cur) ? cur[seg] : undefined
        continue
      }
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        const obj = cur as Record<string, unknown>
        let key = seg
        if (!Object.prototype.hasOwnProperty.call(obj, seg)) {
          const lower = seg.toLowerCase()
          const found = Object.keys(obj).find((k) => k.toLowerCase() === lower)
          if (found !== undefined) key = found
        }
        out.push(key)
        cur = obj[key]
      } else {
        out.push(seg)
        cur = undefined
      }
    }
    return out
  }

  get(path: JSONPath): unknown {
    let cur: unknown = this.value
    for (const seg of this.resolve(path)) {
      if (cur === null || typeof cur !== 'object') return undefined
      cur = (cur as Record<string | number, unknown>)[seg as string]
    }
    return cur
  }

  private applyModify(path: JSONPath, value: unknown, arrayInsertion = false): void {
    const edits = modify(this._text, path, value, {
      formattingOptions: this.formatting,
      isArrayInsertion: arrayInsertion
    })
    if (edits.length === 0) return
    this._text = applyEdits(this._text, edits)
    this._parsed = false
  }

  /** Sets the value at `path` (creating missing parents). `undefined` removes the key. */
  set(path: JSONPath, value: unknown): void {
    const resolved = this.resolve(path)
    if (value !== undefined && deepEqual(this.get(resolved), value)) return
    this.applyModify(resolved, value)
  }

  remove(path: JSONPath): void {
    const resolved = this.resolve(path)
    if (this.get(resolved) === undefined) return
    this.applyModify(resolved, undefined)
  }

  /** Inserts `value` into the array at `arrayPath` before `index` (or appends). */
  insert(arrayPath: JSONPath, index: number, value: unknown): void {
    const resolved = this.resolve(arrayPath)
    const arr = this.get(resolved)
    if (!Array.isArray(arr)) {
      this.applyModify(resolved, [value])
      return
    }
    const at = Math.max(0, Math.min(index, arr.length))
    this.applyModify([...resolved, at], value, true)
  }

  /** Moves an array element, keeping every other element's text as it is. */
  move(arrayPath: JSONPath, from: number, to: number): void {
    const resolved = this.resolve(arrayPath)
    const arr = this.get(resolved)
    if (!Array.isArray(arr) || from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return
    // Carry the element's own text (same array, so the same indentation) rather
    // than re-serialising its parsed value, which would respell numbers.
    const root = parseTree(this._text)
    const node = root ? findNodeAtLocation(root, [...resolved, from]) : undefined
    if (!node) return
    const raw = this._text.slice(node.offset, node.offset + node.length)
    const placeholder = `__fwe_move_${Date.now()}_${Math.random().toString(36).slice(2)}__`
    this.applyModify([...resolved, from], undefined)
    this.applyModify([...resolved, to], placeholder, true)
    const token = JSON.stringify(placeholder)
    const at = this._text.indexOf(token)
    if (at < 0) return
    this._text = this._text.slice(0, at) + raw + this._text.slice(at + token.length)
    this._parsed = false
  }

  /** Renames a property in place: only the key token changes, so order and formatting hold. */
  renameKey(objectPath: JSONPath, oldKey: string, newKey: string): boolean {
    if (oldKey === newKey) return false
    const resolved = this.resolve(objectPath)
    const root = parseTree(this._text)
    if (!root) return false
    const obj = resolved.length ? findNodeAtLocation(root, resolved) : root
    if (!obj || obj.type !== 'object' || !obj.children) return false
    const prop = obj.children.find((p: Node) => p.children && p.children[0].value === oldKey)
    if (!prop || !prop.children) return false
    if (obj.children.some((p: Node) => p.children && p.children[0].value === newKey)) return false
    const keyNode = prop.children[0]
    this._text = applyEdits(this._text, [
      { offset: keyNode.offset, length: keyNode.length, content: JSON.stringify(newKey) }
    ])
    this._parsed = false
    return true
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const bb = b as unknown[]
    return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]))
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const ak = Object.keys(ao)
  const bk = Object.keys(bo)
  return ak.length === bk.length && ak.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]))
}
