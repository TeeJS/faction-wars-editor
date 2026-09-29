// The 23 colours grouped the way the game uses them, with what each one paints
// (SCHEMA.md section 15, look.gd's theme and docs/window-inventory.md).

import type { ColorToken } from './vocab'

export interface ColorGroup {
  title: string
  tokens: { token: ColorToken; paints: string }[]
}

export const COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'Frame and controls',
    tokens: [
      { token: 'chassis', paints: 'Window and panel bodies, dialogs, disabled keys' },
      { token: 'chassis_deep', paints: 'Title bars, wells, lists, menus, text fields, the top strip' },
      { token: 'chassis_raised', paints: 'Keys and tabs at rest' },
      { token: 'chassis_hover', paints: 'Keys, tabs and rows under the pointer' },
      { token: 'edge', paints: "A panel's and a key's quiet border; row hairlines" }
    ]
  },
  {
    title: 'Trim',
    tokens: [
      { token: 'brass', paints: 'The selected edge, the focus ring, pressed keys, the caret' },
      { token: 'brass_dim', paints: 'Frame borders, dividers, menu and tooltip edges' }
    ]
  },
  {
    title: 'Text on the frame',
    tokens: [
      { token: 'text', paints: 'Labels, keys, lists, titles' },
      { token: 'text_muted', paints: 'Secondary text, placeholders, unselected tabs' },
      { token: 'text_disabled', paints: "A disabled control's text" },
      { token: 'heading', paints: 'Section headings, menu separators' }
    ]
  },
  {
    title: 'Documents',
    tokens: [
      { token: 'paper', paints: 'Dispatches, the dossier, the Credits sheet' },
      { token: 'paper_edge', paints: "A document's edge and frames" },
      { token: 'ink', paints: 'Text on a document; map names' },
      { token: 'ink_muted', paints: 'Secondary text on a document' }
    ]
  },
  {
    title: 'Status and selection',
    tokens: [
      { token: 'khaki', paints: 'Progress fills, operational status' },
      { token: 'olive', paints: 'The launch plate under the pointer' },
      { token: 'olive_deep', paints: 'The selected fill: pressed keys, selected rows and tabs, menu hover' }
    ]
  },
  {
    title: 'Urgent',
    tokens: [
      { token: 'signal', paints: 'Alerts, losses, the paused clock' },
      { token: 'signal_text', paints: 'Text on the signal colour' }
    ]
  },
  {
    title: 'Tooltips',
    tokens: [
      { token: 'note', paints: 'The tooltip panel' },
      { token: 'note_ink', paints: 'Tooltip text' }
    ]
  },
  {
    title: 'Dialog dim',
    tokens: [{ token: 'overlay', paints: 'The dim laid over the map behind a dialog (with overlay_alpha)' }]
  }
]
