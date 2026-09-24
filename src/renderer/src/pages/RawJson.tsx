// The escape hatch: edit any value as JSON. Applying re-serialises just that value.

import { useState, type ReactNode } from 'react'
import type { JSONPath } from '../../../core/jsontext'
import type { PackJsonFile } from '../../../core/vocab'
import { store } from '../store'

export function RawJson(props: { file: PackJsonFile; path: JSONPath; value: unknown }): ReactNode {
  const original = JSON.stringify(props.value, null, 2) ?? ''
  const [text, setText] = useState(original)
  const [error, setError] = useState<string | null>(null)
  const apply = () => {
    let v: unknown
    try {
      v = JSON.parse(text)
    } catch (e) {
      setError((e as Error).message)
      return
    }
    setError(null)
    store.doc?.edit('Edit raw JSON', (e) => e.set(props.file, props.path, v))
    store.notify('success', 'Applied.')
  }
  return (
    <div className="raw">
      <p className="muted">
        Any field, including ones the form does not know. Applying rewrites this entry's formatting only; the rest of <code>{props.file}</code> is untouched.
      </p>
      <textarea spellCheck={false} className="mono" value={text} onChange={(e) => setText(e.target.value)} aria-label="Raw JSON" rows={24} />
      {error && <p className="bad">Not valid JSON: {error}</p>}
      <div className="row-actions">
        <button className="primary" disabled={text === original} onClick={apply}>
          Apply
        </button>
        <button disabled={text === original} onClick={() => setText(original)}>
          Revert
        </button>
      </div>
    </div>
  )
}

/** A whole file's text. */
export function RawFile(props: { file: PackJsonFile }): ReactNode {
  const doc = store.doc!
  const original = doc.text(props.file)?.text ?? ''
  const [text, setText] = useState(original)
  const [error, setError] = useState<string | null>(null)
  const apply = () => {
    try {
      JSON.parse(text)
    } catch (e) {
      setError((e as Error).message)
      return
    }
    setError(null)
    doc.edit(`Edit ${props.file}`, (e) => e.setJsonText(props.file, text))
    store.notify('success', `Applied ${props.file}.`)
  }
  return (
    <div className="raw">
      <textarea spellCheck={false} className="mono" value={text} onChange={(e) => setText(e.target.value)} aria-label={`${props.file} text`} rows={30} />
      {error && <p className="bad">Not valid JSON: {error}</p>}
      <div className="row-actions">
        <button className="primary" disabled={text === original} onClick={apply}>
          Apply
        </button>
        <button disabled={text === original} onClick={() => setText(original)}>
          Revert
        </button>
      </div>
    </div>
  )
}
