// Declarative field definitions: every pack field is described once here-in
// pages.ts and rendered by fields.tsx, which reads and writes the JSON directly.

import type { ReactNode } from 'react'
import type { PackDocument } from '../../../core/document'
import type { JSONPath } from '../../../core/jsontext'
import type { LoadedPack } from '../../../core/model'
import type { PictureKind } from '../../../core/pictures'
import type { RefKind } from '../../../core/refs'
import type { PackJsonFile } from '../../../core/vocab'

export type Dict = Record<string, unknown>

export interface Ctx {
  doc: PackDocument
  pack: LoadedPack
}

export interface Opt {
  value: string
  label?: string
}

export type OptSource = readonly string[] | ((c: Ctx, rec: Dict) => (Opt | string)[])

interface Base {
  key: string
  label: string
  help?: string
  /** Hide the field unless this holds. */
  showIf?: (rec: Dict, c: Ctx) => boolean
  /** Always write the key, even when empty (the game requires it). */
  required?: boolean
  wide?: boolean
}

export type FieldDef =
  | (Base & { kind: 'text'; multiline?: boolean; placeholder?: string })
  | (Base & { kind: 'int'; min?: number; max?: number; placeholder?: string })
  | (Base & { kind: 'float'; placeholder?: string })
  | (Base & { kind: 'bool' })
  | (Base & { kind: 'color' })
  | (Base & { kind: 'select'; options: OptSource; allowEmpty?: boolean; emptyLabel?: string; free?: boolean })
  | (Base & { kind: 'multi'; options: OptSource })
  | (Base & { kind: 'orderedRefs'; options: OptSource; unique?: boolean })
  | (Base & { kind: 'strings'; placeholder?: string })
  | (Base & { kind: 'ints' })
  | (Base & { kind: 'object'; fields: FieldDef[]; optional?: boolean; addValue?: (c: Ctx) => unknown })
  | (Base & {
      kind: 'list'
      fields: FieldDef[]
      newItem: (c: Ctx, parent: Dict) => unknown
      itemTitle?: (item: Dict, i: number) => string
      orderNote?: string
      allowNull?: boolean
    })
  | (Base & { kind: 'kv'; valueKind: 'int' | 'number' | 'text'; suggest?: (c: Ctx, rec: Dict) => string[]; keyOptions?: (c: Ctx, rec: Dict) => string[] })
  | (Base & { kind: 'baseVar' })
  | (Base & { kind: 'ratings' })
  | (Base & { kind: 'unitWeapons' })
  | (Base & { kind: 'rect'; float?: boolean })
  /** Four [x, y] corners: top-left, top-right, bottom-right, bottom-left. Optional; starts from the record's rect. */
  | (Base & { kind: 'quad' })
  | (Base & { kind: 'art'; artKind: string })
  | (Base & { kind: 'file'; extensions: string[]; allowArtSet?: boolean })
  | (Base & { kind: 'id'; refKind?: RefKind; numeric?: boolean; readonly?: boolean })
  | (Base & { kind: 'custom'; render: (p: FieldProps) => ReactNode })

export interface FieldProps {
  c: Ctx
  file: PackJsonFile
  /** Path to the object that holds this field. */
  path: JSONPath
  rec: Dict
  def: FieldDef
}

/** A page that lists records (an array, or an object keyed by id) with a form for the selected one. */
export interface ListPageDef {
  page: string
  title: string
  intro?: string
  file: PackJsonFile
  listPath: JSONPath
  mode: 'array' | 'map'
  idKey: string
  nameKey?: string
  refKind?: RefKind
  fields: FieldDef[]
  newItem: (c: Ctx, id: string) => Dict
  newId?: (c: Ctx) => string
  numericId?: boolean
  group?: (rec: Dict, c: Ctx) => string
  subtitle?: (rec: Dict, c: Ctx) => string
  orderNote?: string
  /** Show the Pictures panel (pictures + Encyclopedia text) for this kind of row. */
  pictures?: PictureKind
  /** A note above the form, for this record. */
  note?: (c: Ctx, rec: Dict, index: number | string) => ReactNode
  /** Extra panel under the form. */
  extra?: (c: Ctx, rec: Dict, index: number | string) => ReactNode
}
