// Promise-based dialogs (Electron has no window.prompt). One at a time.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

interface Field {
  key: string
  label: string
  value: string
  placeholder?: string
  help?: string
  validate?: (v: string, all: Record<string, string>) => string | null
}

interface DialogSpec {
  title: string
  body?: ReactNode
  fields?: Field[]
  buttons: { label: string; value: string; primary?: boolean; danger?: boolean }[]
  resolve: (r: { button: string; values: Record<string, string> }) => void
}

let current: DialogSpec | null = null
let version = 0
const listeners = new Set<() => void>()
const emit = () => {
  version++
  for (const l of listeners) l()
}

function open(spec: Omit<DialogSpec, 'resolve'>): Promise<{ button: string; values: Record<string, string> }> {
  return new Promise((resolve) => {
    current = {
      ...spec,
      resolve: (r) => {
        current = null
        emit()
        resolve(r)
      }
    }
    emit()
  })
}

export async function alertDialog(title: string, body: ReactNode): Promise<void> {
  await open({ title, body, buttons: [{ label: 'OK', value: 'ok', primary: true }] })
}

export async function confirmDialog(title: string, body: ReactNode, ok = 'OK', danger = false): Promise<boolean> {
  const r = await open({
    title,
    body,
    buttons: [
      { label: 'Cancel', value: 'cancel' },
      { label: ok, value: 'ok', primary: !danger, danger }
    ]
  })
  return r.button === 'ok'
}

export async function choiceDialog(title: string, body: ReactNode, buttons: DialogSpec['buttons']): Promise<string> {
  return (await open({ title, body, buttons })).button
}

export async function formDialog(title: string, fields: Field[], body?: ReactNode, ok = 'OK'): Promise<Record<string, string> | null> {
  const r = await open({
    title,
    body,
    fields,
    buttons: [
      { label: 'Cancel', value: 'cancel' },
      { label: ok, value: 'ok', primary: true }
    ]
  })
  return r.button === 'ok' ? r.values : null
}

export async function promptDialog(title: string, label: string, value = '', validate?: Field['validate'], body?: ReactNode): Promise<string | null> {
  const r = await formDialog(title, [{ key: 'v', label, value, validate }], body)
  return r ? r.v : null
}

export function DialogHost(): ReactNode {
  useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => version
  )
  if (!current) return null
  return <DialogView key={version} spec={current} />
}

function DialogView({ spec }: { spec: DialogSpec }): ReactNode {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((spec.fields ?? []).map((f) => [f.key, f.value])))
  const first = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    first.current?.focus()
    first.current?.select()
  }, [])
  const errors = Object.fromEntries((spec.fields ?? []).map((f) => [f.key, f.validate ? f.validate(values[f.key] ?? '', values) : null]))
  const hasError = Object.values(errors).some(Boolean)
  const primary = spec.buttons.find((b) => b.primary) ?? spec.buttons[spec.buttons.length - 1]
  const cancel = spec.buttons.find((b) => b.value === 'cancel') ?? spec.buttons[0]
  const finish = (button: string) => {
    if (button !== cancel.value && hasError) return
    spec.resolve({ button, values })
  }
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && finish(cancel.value)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={spec.title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish(cancel.value)
          if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) finish(primary.value)
        }}
      >
        <h2>{spec.title}</h2>
        {spec.body && <div className="modal-body">{spec.body}</div>}
        {(spec.fields ?? []).map((f, i) => (
          <label key={f.key} className="modal-field">
            <span>{f.label}</span>
            <input
              ref={i === 0 ? first : undefined}
              value={values[f.key] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              aria-invalid={!!errors[f.key]}
            />
            {errors[f.key] ? <small className="err">{errors[f.key]}</small> : f.help ? <small>{f.help}</small> : null}
          </label>
        ))}
        <div className="modal-buttons">
          {spec.buttons.map((b) => (
            <button
              key={b.value}
              className={b.primary ? 'primary' : b.danger ? 'danger' : ''}
              disabled={b.value !== cancel.value && hasError}
              onClick={() => finish(b.value)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
