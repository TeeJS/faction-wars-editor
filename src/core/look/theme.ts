// THE GAME'S THEME, AS ITS OWN LINES. Every style a mock-up draws is listed
// here with the exact lines of the game's source that make it (look.gd's
// _build and the screens that call Look directly), and the style is read OUT
// of those lines: Box(...) / Edged(...) / FocusRing(), their border and
// corner tweaks, C("token"), F("role"), Size("name"). tests/look/theme.test.ts
// proves every line is in the game's files (TeeJS/faction-wars main, checked
// at ee4b89b, and look_window.gd from the paused ww2-look-messages branch at
// 2bd1b98). So a mock-up paints a part in the token the game paints it in, or
// the test fails.

import { KNOWN_LOOK_COLORS, type ColorToken } from './vocab'

export type GameFile =
  | 'look.gd'
  | 'look_window.gd'
  | 'look_hud.gd'
  | 'gid_bar.gd'
  | 'gid_key.gd'
  | 'cockpit_dossier.gd'
  | 'credits_window.gd'
  | 'galaxy_map.gd'

export interface Source {
  file: GameFile
  /** Exact text from the file (each must appear in it). */
  lines: string[]
}

export type Metric = 'radius' | 'border' | 'focus' | 'pad'
/** A number of pixels, or one of the look's metrics. */
export type Px = number | Metric

export interface Box {
  fill: ColorToken | null
  edge: ColorToken | null
  /** Border widths: left, top, right, bottom. */
  width: [Px, Px, Px, Px]
  radius: Px
  pad: Px
  /** Drawn this far outside the control: left, top, right, bottom. */
  expand: [number, number, number, number]
}

const S = (file: GameFile, ...lines: string[]): Source => ({ file, lines })

// ---------------------------------------------------------------------------
// Boxes (StyleBoxFlat)
// ---------------------------------------------------------------------------

export const BOXES = {
  // The base controls.
  key: S('look.gd', 'var key := Box("chassis_raised", "edge", -1, -1, 6)'),
  key_hover: S('look.gd', 'var key_hover := Box("chassis_hover", "brass_dim", -1, -1, 6)'),
  key_down: S('look.gd', 'var key_down := Box("olive_deep", "brass", -1, -1, 6)'),
  key_off: S('look.gd', 'var key_off := Box("chassis", "edge", -1, -1, 6)'),
  focus_ring: S('look.gd', 'var sb := Box("", "brass", Metric("focus"), -1, 0)', 'sb.expand_margin_left = 3', 'sb.expand_margin_right = 3', 'sb.expand_margin_top = 3', 'sb.expand_margin_bottom = 3'),
  check_bare: S('look.gd', 'var bare := Box("", "", 0, 0, 4)'),
  check_hover: S('look.gd', 't.set_stylebox("hover", type, Box("chassis_hover", "", 0, -1, 4))'),
  panel: S('look.gd', 'var body := Box("chassis", "edge")'),
  popup: S('look.gd', 't.set_stylebox("panel", "PopupMenu", Box("chassis_deep", "brass_dim", -1, -1, 4))'),
  popup_hover: S('look.gd', 't.set_stylebox("hover", "PopupMenu", Box("olive_deep", "", 0, 0, 2))'),
  tooltip: S('look.gd', 't.set_stylebox("panel", "TooltipPanel", Box("note", "brass_dim", 1, -1, 6))'),
  line_edit: S('look.gd', 't.set_stylebox("normal", "LineEdit", Box("chassis_deep", "edge", -1, -1, 6))'),
  line_edit_focus: S('look.gd', 't.set_stylebox("focus", "LineEdit", Box("", "brass", Metric("focus"), -1, 6))'),
  line_edit_read_only: S('look.gd', 't.set_stylebox("read_only", "LineEdit", Box("chassis", "edge", -1, -1, 6))'),
  item_list: S('look.gd', 't.set_stylebox("panel", "ItemList", Box("chassis_deep", "edge", -1, -1, 4))'),
  item_hover: S('look.gd', 't.set_stylebox("hovered", "ItemList", Box("chassis_hover", "", 0, -1, 2))'),
  item_selected: S('look.gd', 't.set_stylebox("selected", "ItemList", Edged("olive_deep", "brass", SIDE_LEFT, 3, 2))'),
  tab_selected: S('look.gd', 't.set_stylebox("tab_selected", type, Edged("olive_deep", "brass", SIDE_TOP, 2, 6))'),
  tab_unselected: S('look.gd', 't.set_stylebox("tab_unselected", type, Box("chassis_raised", "", 0, -1, 6))'),
  tab_hovered: S('look.gd', 't.set_stylebox("tab_hovered", type, Box("chassis_hover", "", 0, -1, 6))'),
  tab_disabled: S('look.gd', 't.set_stylebox("tab_disabled", type, Box("chassis", "", 0, -1, 6))'),
  tab_panel: S('look.gd', 't.set_stylebox("panel", "TabContainer", Box("chassis", "edge"))'),
  scroll_track: S('look.gd', 't.set_stylebox("scroll", type, Box("chassis_deep", "", 0, 0, 0))'),
  scroll_grabber: S('look.gd', 't.set_stylebox("grabber", type, Box("brass_dim", "", 0, -1, 0))'),
  scroll_grabber_hot: S('look.gd', 't.set_stylebox("grabber_highlight", type, Box("brass", "", 0, -1, 0))'),
  progress_bg: S('look.gd', 't.set_stylebox("background", "ProgressBar", Box("chassis_deep", "edge", -1, -1, 0))'),
  progress_fill: S('look.gd', 't.set_stylebox("fill", "ProgressBar", Box("khaki", "", 0, -1, 0))'),
  dialog_panel: S('look.gd', 't.set_stylebox("panel", "AcceptDialog", Box("chassis", "", 0, 0, 12))'),
  dialog_frame: S('look.gd', 'var frame := Box("chassis", "brass_dim", 1, -1, 0)', 'frame.expand_margin_top = 28', 'frame.expand_margin_left = 1', 'frame.expand_margin_right = 1', 'frame.expand_margin_bottom = 1'),

  // The shared pieces.
  PANEL: S('look.gd', 't.set_stylebox("panel", PANEL, Box("chassis", "brass_dim", -1, -1, 0))'),
  INSET: S('look.gd', 't.set_stylebox("panel", INSET, Box("chassis_deep", "edge", -1, -1, 6))'),
  TITLE_BAR: S('look.gd', 't.set_stylebox("panel", TITLE_BAR, Edged("chassis_deep", "brass_dim", SIDE_BOTTOM, 1, 4))'),
  COMMAND: S('look.gd', 'var cmd := Box("chassis_raised", "edge", -1, -1, 8)', 'cmd.border_width_bottom = 2', 'cmd.border_color = C("chassis_deep")'),
  COMMAND_hover: S('look.gd', 'var cmd_hover := Box("chassis_hover", "brass_dim", -1, -1, 8)', 'cmd_hover.border_width_bottom = 2'),
  COMMAND_pressed: S('look.gd', 'var cmd_down := Box("olive_deep", "brass", -1, -1, 8)', 'cmd_down.border_width_bottom = 2'),
  RAIL: S('look.gd', 't.set_stylebox("normal", RAIL, Box("chassis_raised", "", 0, -1, 6))'),
  RAIL_hover: S('look.gd', 't.set_stylebox("hover", RAIL, Box("chassis_hover", "", 0, -1, 6))'),
  RAIL_pressed: S('look.gd', 'var rail_on := Edged("olive_deep", "brass", SIDE_LEFT, 4, 6)', 'rail_on.border_width_right = 1', 'rail_on.border_width_top = 1', 'rail_on.border_width_bottom = 1'),
  ROW: S('look.gd', 'var row := Edged("", "edge", SIDE_BOTTOM, 1, 4)', 'row.set_corner_radius_all(0)'),
  ROW_hover: S('look.gd', 't.set_stylebox("hover", ROW, Box("chassis_hover", "", 0, 0, 4))'),
  ROW_pressed: S('look.gd', 't.set_stylebox("pressed", ROW, Edged("olive_deep", "brass", SIDE_LEFT, 3, 4))'),
  CHIP: S('look.gd', 't.set_stylebox("panel", CHIP, Box("chassis_deep", "edge", -1, -1, 4))'),
  CHIP_ALERT: S('look.gd', 't.set_stylebox("panel", CHIP_ALERT, Box("signal", "", 0, -1, 4))'),
  /** Paper() without a paper_frame texture: the flat document (pad 14). */
  DOCUMENT: S('look.gd', 'static func Paper(pad: int = 14) -> StyleBox:', 'var flat := Box("paper", "paper_edge", 1, -1, pad)'),
  MODAL: S('look.gd', 't.set_stylebox("panel", MODAL, Box("chassis", "brass_dim", 1, -1, 12))'),
  LAUNCH: S('look.gd', 'var plate := Box("olive_deep", "brass", 2, -1, 14)'),
  LAUNCH_hover: S('look.gd', 'var plate_hover := Box("olive", "brass", 2, -1, 14)'),

  // The paused window dress (phases 4-6).
  window_frame: S('look_window.gd', 'window.add_theme_stylebox_override("panel", Look.Box("chassis", "brass_dim", 1, 0, 0))'),

  // The map screen's shell.
  hud_strip: S('look_hud.gd', 'Look.Edged("chassis_deep", "brass_dim", SIDE_BOTTOM, 1, 0)'),
  hud_console: S('look_hud.gd', 'Look.Edged("chassis_deep", "brass_dim", SIDE_TOP, 1, 0)'),
  hud_chip: S('look_hud.gd', 'Look.Box("chassis_deep", "brass_dim", 1, -1, 4)'),
  hud_chip_paused: S('look_hud.gd', 'Look.Box("signal", "", 0, -1, 4)'),
  gid_bar: S('gid_bar.gd', 'Look.Edged("chassis", "brass_dim", SIDE_TOP, 1, 6)'),
  gid_key: S('gid_key.gd', 'Look.Box("chassis", "brass_dim", 1, -1, 10)'),

  // The Cockpit dossier.
  map_plate: S('cockpit_dossier.gd', 'Look.Box("paper_edge", "ink_muted", 1, 0, 3)')
} satisfies Record<string, Source>

export type BoxId = keyof typeof BOXES

// ---------------------------------------------------------------------------
// Colours (text, fills, lines)
// ---------------------------------------------------------------------------

export const COLORS = {
  button_text: S('look.gd', 't.set_color("font_color", type, C("text"))'),
  button_text_disabled: S('look.gd', 't.set_color("font_disabled_color", type, C("text_disabled"))'),
  label: S('look.gd', 't.set_color("font_color", "Label", C("text"))'),
  rich_text: S('look.gd', 't.set_color("default_color", "RichTextLabel", C("text"))'),
  popup_text: S('look.gd', 't.set_color("font_color", "PopupMenu", C("text"))'),
  popup_disabled: S('look.gd', 't.set_color("font_disabled_color", "PopupMenu", C("text_disabled"))'),
  popup_separator_text: S('look.gd', 't.set_color("font_separator_color", "PopupMenu", C("heading"))'),
  popup_accelerator: S('look.gd', 't.set_color("font_accelerator_color", "PopupMenu", C("text_muted"))'),
  popup_separator: S('look.gd', 'sep.color = C("brass_dim")'),
  tooltip_text: S('look.gd', 't.set_color("font_color", "TooltipLabel", C("note_ink"))'),
  line_edit_text: S('look.gd', 't.set_color("font_color", "LineEdit", C("text"))'),
  line_edit_placeholder: S('look.gd', 't.set_color("font_placeholder_color", "LineEdit", C("text_muted"))'),
  line_edit_caret: S('look.gd', 't.set_color("caret_color", "LineEdit", C("brass"))'),
  line_edit_selection: S('look.gd', 't.set_color("selection_color", "LineEdit", C("olive_deep"))'),
  item_text: S('look.gd', 't.set_color("font_color", "ItemList", C("text"))'),
  tab_selected_text: S('look.gd', 't.set_color("font_selected_color", type, C("text"))'),
  tab_unselected_text: S('look.gd', 't.set_color("font_unselected_color", type, C("text_muted"))'),
  tab_disabled_text: S('look.gd', 't.set_color("font_disabled_color", type, C("text_disabled"))'),
  rule: S('look.gd', 'line.color = C("brass_dim")'),
  upright: S('look.gd', 'upright.color = C("brass_dim")'),
  progress_text: S('look.gd', 't.set_color("font_color", "ProgressBar", C("text"))'),
  window_title: S('look.gd', 't.set_color("title_color", "Window", C("text"))'),
  TITLE_BAR_bg: S('look.gd', 't.set_color("bg", TITLE_BAR, C("chassis_deep"))'),
  TITLE: S('look.gd', 't.set_color("font_color", TITLE, C("text"))'),
  ROW_text: S('look.gd', 't.set_color("font_color", ROW, C("text"))'),
  HEADING: S('look.gd', 't.set_color("font_color", HEADING, C("heading"))'),
  INK: S('look.gd', 't.set_color("font_color", INK, C("ink"))'),
  TYPED: S('look.gd', 't.set_color("font_color", TYPED, C("ink"))'),
  dim: S('look.gd', 'var c := C("overlay")'),

  // The paused window dress.
  window_bar: S('look_window.gd', 'bar.color = Look.C("chassis_deep")'),
  window_rule: S('look_window.gd', 'rule.color = Look.C("brass_dim")'),
  window_title_text: S('look_window.gd', 'title.add_theme_color_override("font_color", Look.C("text"))'),
  window_body: S('look_window.gd', 'back.color = Look.C("chassis")'),

  // The map screen's shell.
  hud_readout: S('look_hud.gd', '(l as Label).add_theme_color_override("font_color", Look.C("text"))'),
  hud_speed: S('look_hud.gd', 'speed.add_theme_color_override("font_color", Look.C("text_muted"))'),
  hud_unread: S('look_hud.gd', 'badge.add_theme_color_override("font_color", Look.C("brass"))'),
  gid_key_title: S('gid_key.gd', 'Look.C("heading") if Look.Active() else Color(0.95, 0.97, 1.0)'),
  gid_key_row: S('gid_key.gd', 'Look.C("text") if Look.Active() else Color(0.92, 0.94, 1.0)'),
  map_name_outline: S('galaxy_map.gd', 'Look.C("paper") if Look.Active() else TitleOutline'),
  map_name: S('galaxy_map.gd', 'var ink: Color = Look.C("ink") if Look.Active() else TitleColor'),
  bezel_inner: S('galaxy_map.gd', 'draw_rect(pic.grow(2.0), Look.C("chassis_deep"), false, 2.0)'),
  bezel_outer: S('galaxy_map.gd', 'draw_rect(pic.grow(3.5), Look.C("brass_dim"), false, 1.0)'),
  bezel_line: S('galaxy_map.gd', 'draw_rect(pic.grow(0.5), Color(Look.C("ink"), 0.7), false, 1.0)'),
  flare_rim: S('galaxy_map.gd', 'lbl.add_theme_color_override("font_outline_color", Color(Look.C("ink"), 0.85))'),

  // The Cockpit dossier.
  cockpit_background: S('cockpit_dossier.gd', '(menu.get_node("Background") as ColorRect).color = Look.C("chassis_deep")'),
  cockpit_version: S('cockpit_dossier.gd', 'ver.add_theme_color_override("font_color", Look.C("text_muted"))'),
  campaign_name: S('cockpit_dossier.gd', 'campaign.add_theme_color_override("font_color", Look.C("ink"))'),
  map_caption: S('cockpit_dossier.gd', 'cap.add_theme_color_override("font_color", Look.C("ink_muted"))'),
  check_frame: S('cockpit_dossier.gd', 'var edge := Look.C("text")'),
  check_tick: S('cockpit_dossier.gd', 'var tick := Look.C("brass")'),

  // The Credits sheet.
  credits_title: S('credits_window.gd', '_ink(head, Look.F("display_bold"), Look.Size("heading") + 10, "ink")'),
  credits_line: S('credits_window.gd', 'box.add_child(_para(line, "ink"))'),
  credits_what: S('credits_window.gd', '_ink(w, Look.F("body"), Look.Size("label"), "ink_muted")'),
  credits_changes: S('credits_window.gd', 'e.add_child(_para("Changes: %s" % str(a["changes"]), "ink_muted"))'),
  credits_section: S('credits_window.gd', '_ink(l, Look.F("display"), Look.Size("heading"), "ink")'),
  credits_asset: S('credits_window.gd', '_ink(t, Look.F("body_bold"), Look.Size("label") + 1, "ink")')
} satisfies Record<string, Source>

export type ColorId = keyof typeof COLORS

// ---------------------------------------------------------------------------
// Faces and sizes
// ---------------------------------------------------------------------------

export const FONTS = {
  default: S('look.gd', 't.default_font = F("body")', 't.default_font_size = Size("body")'),
  window_title: S('look.gd', 't.set_font("title_font", "Window", F("display"))', 't.set_font_size("title_font_size", "Window", Size("title"))'),
  tooltip: S('look.gd', 't.set_font("font", "TooltipLabel", F("body"))', 't.set_font_size("font_size", "TooltipLabel", Size("small"))'),
  TITLE: S('look.gd', 't.set_font("font", TITLE, F("display"))', 't.set_font_size("font_size", TITLE, Size("title"))'),
  COMMAND: S('look.gd', 't.set_font("font", COMMAND, F("display"))', 't.set_font_size("font_size", COMMAND, Size("label"))'),
  RAIL: S('look.gd', 't.set_font("font", RAIL, F("display"))', 't.set_font_size("font_size", RAIL, Size("label"))'),
  HEADING: S('look.gd', 't.set_font("font", HEADING, F("display"))', 't.set_font_size("font_size", HEADING, Size("heading"))'),
  INK: S('look.gd', 't.set_font("font", INK, F("body"))', 't.default_font_size = Size("body")'),
  TYPED: S('look.gd', 't.set_font("font", TYPED, F("typed_bold"))', 't.set_font_size("font_size", TYPED, Size("label"))'),
  LAUNCH: S('look.gd', 't.set_font("font", LAUNCH, F("display_bold"))', 't.set_font_size("font_size", LAUNCH, Size("heading"))'),
  window_title_dress: S('look_window.gd', 'title.add_theme_font_override("font", Look.F("display"))', 'title.add_theme_font_size_override("font_size", Look.Size("title"))'),
  window_keys_dress: S('look_window.gd', 'b.theme_type_variation = Look.COMMAND', 'b.add_theme_font_size_override("font_size", Look.Size("small"))'),
  hud_readout: S('look_hud.gd', '(l as Label).add_theme_font_override("font", Look.F("body"))', '(l as Label).add_theme_font_size_override("font_size", Look.Size("label") + 1)'),
  hud_day: S('look_hud.gd', 'day.add_theme_font_override("font", Look.F("display"))', 'day.add_theme_font_size_override("font_size", Look.Size("heading"))'),
  hud_speed: S('look_hud.gd', 'speed.add_theme_font_override("font", Look.F("display"))', 'speed.add_theme_font_size_override("font_size", Look.Size("small"))'),
  hud_unread: S('look_hud.gd', 'badge.add_theme_font_override("font", Look.F("display_bold"))', 'badge.add_theme_font_size_override("font_size", Look.Size("label"))'),
  gid_mode: S('gid_bar.gd', '_activeLabel.add_theme_font_override("font", Look.F("display"))'),
  gid_key_title: S('gid_key.gd', '_title.add_theme_font_override("font", Look.F("display"))'),
  map_name: S('galaxy_map.gd', 'return Look.F("display_bold")'),
  cockpit_title: S('cockpit_dossier.gd', 'title.theme_type_variation = Look.HEADING', 'title.add_theme_font_size_override("font_size", Look.Size("heading") + 4)'),
  cockpit_label: S('cockpit_dossier.gd', 'l.theme_type_variation = Look.HEADING', 'l.add_theme_font_size_override("font_size", Look.Size("label"))'),
  campaign_name: S('cockpit_dossier.gd', 'campaign.add_theme_font_override("font", Look.F("display_bold"))', 'campaign.add_theme_font_size_override("font_size", Look.Size("display"))'),
  map_caption: S('cockpit_dossier.gd', 'cap.add_theme_font_override("font", Look.F("typed"))', 'cap.add_theme_font_size_override("font_size", Look.Size("small"))'),
  credits_title: S('credits_window.gd', '_ink(head, Look.F("display_bold"), Look.Size("heading") + 10, "ink")'),
  credits_asset: S('credits_window.gd', '_ink(t, Look.F("body_bold"), Look.Size("label") + 1, "ink")'),
  credits_body: S('credits_window.gd', '_ink(l, Look.F("body"), Look.Size("label"), colour)'),
  credits_section: S('credits_window.gd', '_ink(l, Look.F("display"), Look.Size("heading"), "ink")')
} satisfies Record<string, Source>

export type FontId = keyof typeof FONTS

// ---------------------------------------------------------------------------
// Reading the lines
// ---------------------------------------------------------------------------

const SIDES: Record<string, number> = { SIDE_LEFT: 0, SIDE_TOP: 1, SIDE_RIGHT: 2, SIDE_BOTTOM: 3 }
const SIDE_NAMES = ['left', 'top', 'right', 'bottom']

function args(call: string): string[] {
  const open = call.indexOf('(')
  const close = call.lastIndexOf(')')
  const inner = call.slice(open + 1, close)
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of inner) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const str = (a: string | undefined): string => (a === undefined ? '' : a.replace(/^"|"$/g, ''))
const tok = (a: string | undefined): ColorToken | null => (str(a) ? (str(a) as ColorToken) : null)

/** An int argument: -1 means "the look's metric", Metric("x") names one. */
function px(a: string | undefined, metric: Metric, fallback: Px): Px {
  if (a === undefined) return fallback
  const m = /^Metric\("(\w+)"\)$/.exec(a)
  if (m) return m[1] as Metric
  if (a === 'pad') return 14 // Paper(pad: int = 14)
  const n = Number(a)
  return n < 0 ? metric : n
}

/** Look.Box(fill, edge = "", width = -1, radius = -1, pad = -1). */
function box(a: string[]): Box {
  const edge = tok(a[1])
  const w = px(a[2], 'border', 'border')
  return {
    fill: tok(a[0]),
    edge,
    width: edge ? [w, w, w, w] : [0, 0, 0, 0],
    radius: px(a[3], 'radius', 'radius'),
    pad: px(a[4], 'pad', 'pad'),
    expand: [0, 0, 0, 0]
  }
}

/** Look.Edged(fill, edge, side, width, pad = -1): Box(fill, "", 0, -1, pad) with one edge. */
function edged(a: string[]): Box {
  const b = box([a[0], '""', '0', '-1', a[4] ?? '-1'])
  b.edge = tok(a[1])
  b.width[SIDES[a[2]]] = Number(a[3])
  return b
}

/** The Box(...) or Edged(...) call in a line, with its arguments, even when it
 * sits inside another call (set_stylebox(..., Box(...))). */
function findCall(line: string): { name: 'Box' | 'Edged'; args: string[] } | null {
  const m = /\b(Box|Edged)\(/.exec(line)
  if (!m) return null
  let depth = 0
  for (let i = m.index + m[1].length; i < line.length; i++) {
    if (line[i] === '(') depth++
    if (line[i] === ')' && --depth === 0) return { name: m[1] as 'Box' | 'Edged', args: args(line.slice(m.index, i + 1)) }
  }
  return null
}

/** A style read from its lines: the Box/Edged call, then the tweaks after it. */
export function readBox(src: Source): Box {
  let b: Box | null = null
  for (const line of src.lines) {
    const call: ReturnType<typeof findCall> = b ? null : findCall(line)
    if (call) {
      b = call.name === 'Box' ? box(call.args) : edged(call.args)
      continue
    }
    if (!b) continue
    let m = /\.border_width_(left|top|right|bottom) = (\d+)/.exec(line)
    if (m) b.width[SIDE_NAMES.indexOf(m[1])] = Number(m[2])
    m = /\.border_color = (?:Look\.)?C\("(\w+)"\)/.exec(line)
    if (m) b.edge = m[1] as ColorToken
    m = /\.set_corner_radius_all\((\d+)\)/.exec(line)
    if (m) b.radius = Number(m[1])
    m = /\.expand_margin_(left|top|right|bottom) = (\d+)/.exec(line)
    if (m) b.expand[SIDE_NAMES.indexOf(m[1])] = Number(m[2])
  }
  if (!b) throw new Error(`No Box or Edged in ${src.lines.join(' | ')}`)
  return b
}

/** The token a colour line names: its C("token"), else (the Credits sheet's
 * _ink / _para helpers, which take a token's name) its last quoted token. */
export function readColor(src: Source): ColorToken {
  for (const line of src.lines) {
    const m = /C\("(\w+)"\)/.exec(line)
    if (m) return m[1] as ColorToken
    const named = [...line.matchAll(/"(\w+)"/g)].map((x) => x[1]).filter((w) => (KNOWN_LOOK_COLORS as readonly string[]).includes(w))
    if (named.length) return named[named.length - 1] as ColorToken
  }
  throw new Error(`No colour in ${src.lines.join(' | ')}`)
}

export interface FontSpec {
  /** A font role (look.json fonts), or null to keep the one in force. */
  role: string | null
  /** A size name (look.json sizes) plus pixels, or null to keep the one in force. */
  size: { name: string; plus: number } | null
}

/** The face and size a font entry sets (F("role"), Size("name") + n). A
 * HEADING-tagged label takes HEADING's face. */
export function readFont(src: Source): FontSpec {
  let role: string | null = null
  let size: FontSpec['size'] = null
  for (const line of src.lines) {
    const f = /F\("(\w+)"\)/.exec(line)
    if (f && role === null) role = f[1]
    if (/theme_type_variation = Look\.HEADING/.test(line)) role = 'display'
    const s = /Size\("(\w+)"\)(?:\s*\+\s*(\d+))?/.exec(line)
    if (s && size === null) size = { name: s[1], plus: s[2] ? Number(s[2]) : 0 }
  }
  return { role, size }
}

/** Every token a box paints with. */
export function boxTokens(b: Box): ColorToken[] {
  return [b.fill, b.edge].filter((t): t is ColorToken => t !== null)
}
