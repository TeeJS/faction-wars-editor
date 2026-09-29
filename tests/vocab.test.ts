// The editor's word lists against the game's, word for word and in order (the
// order is in the game's "Known: ..." messages): every constant list in the
// game's src/data/pack_loader.gd must be in src/core/vocab.ts or
// src/core/look/vocab.ts under the same name, and the look's message
// categories are the game's Enums.MessageCategory less "All". Read from the
// faction-wars checkout like the look tests (tests/look/game.ts); skipped
// without it. When the game adds a word, this names it.

import { describe, expect, it } from 'vitest'
import * as vocab from '../src/core/vocab'
import * as lookVocab from '../src/core/look/vocab'
import { gameText } from './look/game'

const loader = gameText('src/data/pack_loader.gd')
const enums = gameText('src/game/enums.gd')

/** A GDScript literal (list or dictionary of strings) as a value: comments and trailing commas dropped. */
function gdLiteral(text: string): unknown {
  const noComments = text
    .split('\n')
    .map((line) => {
      let inString = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"' && line[i - 1] !== '\\') inString = !inString
        if (line[i] === '#' && !inString) return line.slice(0, i)
      }
      return line
    })
    .join('\n')
  return JSON.parse(noComments.replace(/,(\s*[\]}])/g, '$1'))
}

/** Every `const NAME := [...]` or `{...}` at the top level of a GDScript file. */
function gdConstLists(src: string): Map<string, unknown> {
  const out = new Map<string, unknown>()
  const re = /^const ([A-Z_]+) *:?= *([[{])/gm
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const open = m[2]
    const close = open === '[' ? ']' : '}'
    let depth = 0
    let inString = false
    let end = -1
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      const ch = src[i]
      if (ch === '"' && src[i - 1] !== '\\') inString = !inString
      if (inString) continue
      if (ch === '#') {
        i = src.indexOf('\n', i)
        continue
      }
      if (ch === open) depth++
      if (ch === close && --depth === 0) {
        end = i + 1
        break
      }
    }
    out.set(m[1], gdLiteral(src.slice(m.index + m[0].length - 1, end)))
  }
  return out
}

const editorLists: Record<string, unknown> = { ...vocab, ...lookVocab }

describe.runIf(loader !== null)("the word lists are the game's", () => {
  const game = gdConstLists(loader ?? '')

  it('reads the lists out of the game', () => {
    expect(game.size).toBeGreaterThan(30)
    expect(game.get('KNOWN_HQ_KINDS')).toEqual(['fixed', 'hidden'])
  })

  for (const name of gdConstLists(loader ?? '').keys())
    it(name, () => {
      expect(editorLists[name], `${name} is in the game's pack_loader.gd but not in src/core/vocab.ts or src/core/look/vocab.ts`).toBeDefined()
      expect(editorLists[name]).toEqual(game.get(name))
    })

  it.runIf(enums !== null)("the look's message categories: Enums.MessageCategory less All", () => {
    const m = /enum MessageCategory \{([^}]*)\}/.exec(enums ?? '')
    expect(m).not.toBeNull()
    const cats = m![1].split(',').map((s) => s.trim().split('=')[0].trim()).filter((s) => s && s !== 'All')
    expect(lookVocab.KNOWN_MESSAGE_CATEGORIES).toEqual(cats)
  })
})
