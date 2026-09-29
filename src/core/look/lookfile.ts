// A pack's look.json held as its text (JsonText). Keys are matched exactly, as
// the game's validator matches them (Dictionary.has), and every edit is a
// minimal text edit, so whatever the Look page does not change - key order,
// spacing, line endings, `_comment`s, `messages`, `dossier` - keeps its bytes.

import { applyEdits, modify } from 'jsonc-parser'
import { JsonText, deepEqual } from '../jsontext'
import { isDict } from './godot'
import type { ColorToken } from './vocab'

type Path = (string | number)[]

export class LookFile {
  /** `baseline`: the file as last saved, when that is not the JsonText's own original. */
  private constructor(
    readonly json: JsonText,
    private readonly baseline?: Uint8Array | null
  ) {}

  static fromBytes(bytes: Uint8Array): LookFile {
    return new LookFile(JsonText.fromBytes(bytes))
  }

  /** The look as it stands (`current`), measured against the file as last saved
   * (`saved`; none when the pack did not have a look then). */
  static open(current: Uint8Array, saved?: Uint8Array): LookFile {
    if (!saved) return new LookFile(JsonText.fromBytes(current), null)
    const json = JsonText.fromBytes(saved)
    const now = JsonText.fromBytes(current).text
    if (json.text !== now) json.setText(now)
    return new LookFile(json)
  }

  /** A new look.json, written in the shipped packs' style (2-space indent, LF). */
  static fromValue(value: Record<string, unknown>): LookFile {
    return new LookFile(JsonText.fromValue(value))
  }

  get text(): string {
    return this.json.text
  }

  get dirty(): boolean {
    return this.json.dirty
  }

  toBytes(): Uint8Array {
    return this.json.toBytes()
  }

  /** The parsed look, or null when the text is not a JSON object. */
  get value(): Record<string, unknown> | null {
    const v = this.json.value
    return isDict(v) ? v : null
  }

  private _saved: Record<string, unknown> | null | undefined = undefined

  /** The look as it is on disk (as read), for telling what changed; null for a new file. */
  get saved(): Record<string, unknown> | null {
    if (this._saved === undefined) {
      const bytes = this.baseline === undefined ? this.json.originalBytes : this.baseline
      let v: unknown = null
      if (bytes) {
        try {
          const text = new TextDecoder().decode(bytes)
          v = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
        } catch {
          v = null
        }
      }
      this._saved = isDict(v) ? v : null
    }
    return this._saved
  }

  savedColor(token: ColorToken): string | undefined {
    const c = this.saved?.colors
    const v = isDict(c) ? c[token] : undefined
    return typeof v === 'string' ? v : undefined
  }

  savedSide(factionId: string): string | undefined {
    const s = this.saved?.sides
    const v = isDict(s) ? s[factionId] : undefined
    return typeof v === 'string' ? v : undefined
  }

  /** The value at `path`, keys matched exactly. */
  get(path: Path): unknown {
    let cur: unknown = this.value
    for (const seg of path) {
      if (cur === null || typeof cur !== 'object') return undefined
      cur = (cur as Record<string | number, unknown>)[seg as string]
    }
    return cur
  }

  /** Sets the value at `path` (keys matched exactly, missing parents made);
   * `undefined` removes the key. Nothing changes when the value is already there. */
  set(path: Path, value: unknown): void {
    if (value !== undefined && deepEqual(this.get(path), value)) return
    if (value === undefined && this.get(path) === undefined) return
    const edits = modify(this.json.text, path, value, { formattingOptions: this.json.formatting })
    if (edits.length === 0) return
    this.json.setText(applyEdits(this.json.text, edits))
  }

  color(token: ColorToken): string | undefined {
    const v = this.get(['colors', token])
    return typeof v === 'string' ? v : undefined
  }

  setColor(token: ColorToken, hex: string): void {
    this.set(['colors', token], hex)
  }

  side(factionId: string): string | undefined {
    const v = this.get(['sides', factionId])
    return typeof v === 'string' ? v : undefined
  }

  setSide(factionId: string, hex: string | undefined): void {
    this.set(['sides', factionId], hex)
  }
}
