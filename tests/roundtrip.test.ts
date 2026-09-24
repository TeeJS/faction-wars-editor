import { describe, expect, it } from 'vitest'
import { PackDocument } from '../src/core/document'
import { JsonText } from '../src/core/jsontext'
import { SHIPPED_PACKS, bytesEqual, haveGameRepo, loadShipped, packDir, readTree } from './helpers'

const suite = haveGameRepo ? describe : describe.skip

suite('round-trip on the shipped packs', () => {
  for (const id of SHIPPED_PACKS) {
    it(`${id}: an unedited pack writes back byte-for-byte`, () => {
      const disk = readTree(packDir(id))
      const doc = loadShipped(id)
      expect(doc.dirty).toBe(false)
      expect(doc.changedPaths()).toEqual([])
      for (const f of doc.allFiles()) {
        const original = disk.get(f.path)
        expect(original, f.path).toBeDefined()
        expect(bytesEqual(f.bytes, original!), f.path).toBe(true)
      }
    })

    it(`${id}: an edit changes only the edited span`, () => {
      const doc = loadShipped(id)
      const before = doc.text('units.json')!.text
      const oldName = doc.get('units.json', ['units', 0, 'display_name']) as string
      doc.edit('rename', (e) => e.set('units.json', ['units', 0, 'display_name'], 'Renamed Unit'))
      const after = doc.text('units.json')!.text
      let p = 0
      while (before[p] === after[p]) p++
      let s = 0
      while (before[before.length - 1 - s] === after[after.length - 1 - s]) s++
      // The changed region lies inside the old value's token and the new value's token.
      expect(JSON.stringify(oldName)).toContain(before.slice(p, before.length - s))
      expect('"Renamed Unit"').toContain(after.slice(p, after.length - s))
      expect(doc.changedPaths()).toEqual(['units.json'])
      // Everything else still byte-identical.
      const disk = readTree(packDir(id))
      for (const f of doc.allFiles()) if (f.path !== 'units.json') expect(bytesEqual(f.bytes, disk.get(f.path)!), f.path).toBe(true)
    })

    it(`${id}: undo returns to the loaded bytes and clears dirty`, () => {
      const doc = loadShipped(id)
      doc.edit('x', (e) => e.set('pack.json', ['summary'], 'Something else'))
      expect(doc.dirty).toBe(true)
      doc.undo()
      expect(doc.dirty).toBe(false)
      const disk = readTree(packDir(id))
      expect(bytesEqual(doc.fileBytes('pack.json')!, disk.get('pack.json')!)).toBe(true)
      doc.redo()
      expect(doc.get('pack.json', ['summary'])).toBe('Something else')
    })

    it(`${id}: moving a weapon keeps every element's own text`, () => {
      const doc = loadShipped(id)
      const t = doc.text('weapons.json')!
      const ids = (t.value as { weapons: { id: string }[] }).weapons.map((w) => w.id)
      doc.edit('move', (e) => e.move('weapons.json', ['weapons'], 0, ids.length - 1))
      const moved = (doc.value('weapons.json') as { weapons: { id: string }[] }).weapons.map((w) => w.id)
      expect(moved).toEqual([...ids.slice(1), ids[0]])
      doc.edit('back', (e) => e.move('weapons.json', ['weapons'], ids.length - 1, 0))
      expect(doc.changedPaths()).toEqual([])
    })
  }
})

describe('JsonText', () => {
  it('keeps CRLF files CRLF when editing', () => {
    const t = JsonText.fromBytes(new TextEncoder().encode('{\r\n  "a": [\r\n    1\r\n  ]\r\n}\r\n'))
    t.insert(['a'], 1, 2)
    t.set(['b'], { c: true })
    expect(t.text.includes('\n') && !/[^\r]\n/.test(t.text)).toBe(true)
    expect(t.value).toEqual({ a: [1, 2], b: { c: true } })
  })

  it('resolves keys case-insensitively like the game', () => {
    const t = JsonText.fromText('{"Units": [{"ID": "x"}]}')
    expect(t.get(['units', 0, 'id'])).toBe('x')
    t.set(['units', 0, 'id'], 'y')
    expect(t.text).toBe('{"Units": [{"ID": "y"}]}')
  })

  it('renames a key in place, keeping order', () => {
    const t = JsonText.fromText('{\n  "by_faction": {\n    "a": 1,\n    "b": 2\n  }\n}\n')
    expect(t.renameKey(['by_faction'], 'a', 'z')).toBe(true)
    expect(t.text).toBe('{\n  "by_faction": {\n    "z": 1,\n    "b": 2\n  }\n}\n')
    expect(t.renameKey(['by_faction'], 'z', 'b')).toBe(false)
  })

  it('writes a BOM back when the file had one', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"a":1}')])
    const t = JsonText.fromBytes(bytes)
    expect(t.value).toEqual({ a: 1 })
    t.set(['a'], 2)
    const out = t.toBytes()
    expect([out[0], out[1], out[2]]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('reports malformed JSON the way the loader does', () => {
    expect(JsonText.fromText('   ').problem?.message).toBe('missing or empty.')
    expect(JsonText.fromText('{"a":').problem?.message).toMatch(/^malformed JSON - /)
  })
})

describe('PackDocument', () => {
  it('ignores the installed manifest.json and .git', () => {
    const files = new Map<string, Uint8Array>([
      ['manifest.json', new Uint8Array([1])],
      ['.git/HEAD', new Uint8Array([2])],
      ['art/x.png', new Uint8Array([3])]
    ])
    const doc = new PackDocument(files, 'x')
    expect(doc.otherFiles()).toEqual(['art/x.png'])
  })

  it('tracks removed files for the folder writer', () => {
    const doc = new PackDocument(new Map([['a.png', new Uint8Array([1])]]), 'x')
    doc.edit('rm', (e) => e.removeFile('a.png'))
    expect(doc.removedPaths()).toEqual(['a.png'])
    doc.undo()
    expect(doc.removedPaths()).toEqual([])
  })
})
