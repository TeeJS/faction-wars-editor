// THE GAME'S THEME, AS ITS OWN LINES. Every style a mock-up draws is listed
// here with the exact lines of the game's source that make it (look.gd's
// _build, the window and dispatch dress, and the screens that call Look
// directly), and the style is read OUT of those lines: Box(...) / Edged(...)
// / FocusRing(), their border and corner tweaks, C("token"), F("role"),
// Size("name"), and the window dress's palette-trade tables.
// tests/look/theme.test.ts proves every line is in the game's files
// (TeeJS/faction-wars main, checked at a46c63f: the WWII look's phases 0-6).
// So a mock-up paints a part in the token the game paints it in, or the test
// fails.

import { KNOWN_LOOK_COLORS, type ColorToken } from './vocab'

export type GameFile =
  | 'look.gd'
  | 'look_window.gd'
  | 'look_dispatch.gd'
  | 'look_hud.gd'
  | 'gid_bar.gd'
  | 'gid_key.gd'
  | 'cockpit_dossier.gd'
  | 'credits_window.gd'
  | 'galaxy_map.gd'
  | 'planet_finder.gd'
  | 'galaxy_overview_window.gd'
  | 'objectives_window.gd'
  | 'battle_results_window.gd'
  | 'battle_alert_window.gd'
  | 'look_sector.gd'
  | 'sector_window.gd'
  | 'gid.gd'

export interface Source {
  file: GameFile
  /** Exact text from the file (each must appear in it). */
  lines: string[]
  /** For a line that picks between two ("C("a") if x else C("b")"): which one. */
  branch?: 'if' | 'else'
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
  /** Drawn this far outside the control: left, top, right, bottom (below 0: inside it). */
  expand: [number, number, number, number]
  /** Corners set one by one (top-left, top-right, bottom-right, bottom-left), over `radius`. */
  corners?: [Px, Px, Px, Px]
  /** Content margins set one by one (left, top, right, bottom), over `pad`. */
  padSides?: [Px, Px, Px, Px]
}

const S = (file: GameFile, ...lines: string[]): Source => ({ file, lines })
/** Look._FolderTab's body after its Box(fill, "", 0, -1, 6): read as tweaks. */
const FOLDER_TAB = [
  'sb.border_width_left = 1',
  'sb.border_width_right = 1',
  'sb.border_width_bottom = 0',
  'sb.corner_radius_top_left = 3',
  'sb.corner_radius_top_right = 3',
  'sb.expand_margin_left = -1',
  'sb.expand_margin_right = -1',
  'sb.content_margin_left = 10',
  'sb.content_margin_right = 10'
]
/** The else side of a line that picks between two. */
const Else = (file: GameFile, ...lines: string[]): Source => ({ file, lines, branch: 'else' })

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
  // Folder tabs (TeeJS/faction-wars#433): outlined on top and sides, open at the
  // bottom, rounded top corners, 2 px apart - the body of Look._FolderTab.
  tab_selected: S('look.gd', 't.set_stylebox("tab_selected", type, _FolderTab("olive_deep", "brass", 3))', ...FOLDER_TAB),
  tab_unselected: S('look.gd', 't.set_stylebox("tab_unselected", type, _FolderTab("chassis_raised", "edge", 1))', ...FOLDER_TAB),
  tab_hovered: S('look.gd', 't.set_stylebox("tab_hovered", type, _FolderTab("chassis_hover", "brass_dim", 1))', ...FOLDER_TAB),
  tab_disabled: S('look.gd', 't.set_stylebox("tab_disabled", type, _FolderTab("chassis_deep", "edge", 1))', ...FOLDER_TAB),
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

  // The window dress (look_window.gd, phase 6).
  window_frame: S('look_window.gd', 'window.add_theme_stylebox_override("panel", Look.Box("chassis", "brass_dim", 1, 0, 0))'),

  // A dialog as an order sheet (Look.SheetTheme, phase 5): parchment, flat
  // when the look ships no paper_frame; a check box lit by the paper's edge.
  sheet_panel: S('look.gd', 't.set_stylebox("panel", "AcceptDialog", Paper(14))', 'var flat := Box("paper", "paper_edge", 1, -1, pad)'),
  sheet_check_hover: S('look.gd', 't.set_stylebox("hover", type, Box("paper_edge", "", 0, -1, 4))'),

  // The Message Index as dispatches (look_dispatch.gd, phase 4).
  dispatch_ledger: S('look_dispatch.gd', 'tabs.add_theme_stylebox_override("panel", Look.Box("chassis_deep", "edge", 1, -1, 4))'),
  stamp_urgent_ledger: S('look_dispatch.gd', 'sb = Look.Box("signal", "", 0, -1, 0)'),

  // The map screen's shell.
  hud_strip: S('look_hud.gd', 'Look.Edged("chassis_deep", "brass_dim", SIDE_BOTTOM, 1, 0)'),
  hud_console: S('look_hud.gd', 'Look.Edged("chassis_deep", "brass_dim", SIDE_TOP, 1, 0)'),
  hud_chip: S('look_hud.gd', 'Look.Box("chassis_deep", "brass_dim", 1, -1, 4)'),
  hud_chip_paused: S('look_hud.gd', 'Look.Box("signal", "", 0, -1, 4)'),
  gid_bar: S('gid_bar.gd', 'Look.Edged("chassis", "brass_dim", SIDE_TOP, 1, 6)'),
  gid_key: S('gid_key.gd', 'Look.Box("chassis", "brass_dim", 1, -1, 10)'),

  // The Cockpit dossier.
  map_plate: S('cockpit_dossier.gd', 'Look.Box("paper_edge", "ink_muted", 1, 0, 3)'),

  // The sector window as a theatre plate.
  plate_frame: S('look_sector.gd', 'frame.add_theme_stylebox_override("panel", Look.Box("", "brass_dim", 1, 0, 0))'),
  /** A corner icon's tab; its 1 px edge is the tint the window gave the icon. */
  corner_tab: S('look_sector.gd', 'var tab := Look.Box("paper", "", 0, 2, 0)')
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

  // The window dress.
  window_bar: S('look_window.gd', 'bar.color = Look.C("chassis_deep")'),
  window_rule: S('look_window.gd', 'rule.color = Look.C("brass_dim")'),
  window_title_text: S('look_window.gd', 'title.add_theme_color_override("font_color", Look.C("text"))'),
  window_body: S('look_window.gd', '(c as ColorRect).color = Look.C("chassis")'),
  /** A finder's row (LookWindow.ListRow): a side's look colour, or muted for no side. */
  finder_row_muted: Else('planet_finder.gd', 'LookWindow.ListRow(planetBtn, Look.SideColor(owner) if owner != null else Look.C("text_muted"))'),

  // A dialog as an order sheet.
  sheet_label: S('look.gd', 't.set_color("font_color", "Label", C("ink"))'),
  sheet_check_text: S('look.gd', 't.set_color(c, type, C("ink"))'),

  // The dispatches.
  row_unread: S('look_dispatch.gd', 'subject.add_theme_color_override("font_color", Look.C("text") if on or not read else Look.C("text_muted"))'),
  row_read: Else('look_dispatch.gd', 'subject.add_theme_color_override("font_color", Look.C("text") if on or not read else Look.C("text_muted"))'),
  row_meta_on: S('look_dispatch.gd', 'meta.add_theme_color_override("font_color", Look.C("text") if on else Look.C("text_muted"))'),
  row_meta: Else('look_dispatch.gd', 'meta.add_theme_color_override("font_color", Look.C("text") if on else Look.C("text_muted"))'),
  row_band: S('look_dispatch.gd', 'band.color = Look.C("signal")'),
  /** The rule between ledger rows (TeeJS/faction-wars#434), at RuleAlpha. */
  row_rule: S('look_dispatch.gd', 'rule.color = Color(Look.C("brass_dim"), RuleAlpha)', 'const RuleAlpha := 0.55'),
  stamp_ledger_on: S('look_dispatch.gd', 'var ink: Color = Look.C("text") if on else Look.C("heading")'),
  stamp_ledger: Else('look_dispatch.gd', 'var ink: Color = Look.C("text") if on else Look.C("heading")'),
  stamp_urgent_ledger_text: S('look_dispatch.gd', 'ink = Look.C("signal_text")'),
  stamp_paper_urgent: S('look_dispatch.gd', 'ink = Look.C("signal") if urgent else Look.C("ink_muted" if on_paper else "heading")'),
  stamp_paper: Else('look_dispatch.gd', 'ink = Look.C("signal") if urgent else Look.C("ink_muted" if on_paper else "heading")'),
  dispatch_subject: S('look_dispatch.gd', 'subject.add_theme_color_override("font_color", Look.C("ink"))'),
  dispatch_meta: S('look_dispatch.gd', 'meta.add_theme_color_override("font_color", Look.C("ink_muted"))'),
  dispatch_rule: S('look_dispatch.gd', 'line.color = Look.C("ink_muted")'),
  dispatch_body: S('look_dispatch.gd', 'body.add_theme_color_override("default_color", Look.C("ink"))'),
  dispatch_band: S('look_dispatch.gd', 'detail.draw_rect(Rect2(r.position, Vector2(r.size.x, PaperBand)), Look.C("signal"))'),
  dispatch_empty: S('look_dispatch.gd', 'label.add_theme_color_override("font_color", Look.C("text_muted"))'),

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
  credits_asset: S('credits_window.gd', '_ink(t, Look.F("body_bold"), Look.Size("label") + 1, "ink")'),

  // The sector window as a theatre plate.
  plate_paper: S('look_sector.gd', 'base.color = Look.C("paper")'),
  plate_wash: S('look_sector.gd', 'var paper := Look.C("paper")', 'paper.a = WASH'),
  plate_grid: S('look_sector.gd', 'var c := Look.C("ink_muted")', 'c.a = 0.16'),
  mark_unheld: S('look_sector.gd', 'disc.bg_color = owner.FactionColor if owner != null else Look.C("paper")'),
  mark_hq: S('look_sector.gd', 'disc.border_color = Look.C("brass") if hq else Look.C("ink")'),
  mark_rim: Else('look_sector.gd', 'disc.border_color = Look.C("brass") if hq else Look.C("ink")'),
  star_rim: S('look_sector.gd', 'star.add_theme_color_override("font_outline_color", Look.C("ink"))'),
  name_unheld: S('look_sector.gd', 'label.add_theme_color_override("font_color", OnPaper(owner.FactionColor) if owner != null else Look.C("ink"))'),
  name_halo: S('look_sector.gd', 'label.add_theme_color_override("font_outline_color", Look.C("paper"))'),
  /** A held system's name: its side's colour darkened until it reads on the paper (OnPaper). */
  name_on_paper: S('look_sector.gd', 'var paper := Look.C("paper")', 'while Look.Contrast(out, paper) < 4.5 and guard < 20:', 'out = out.darkened(0.08)'),
  corner_uprising: S('look_sector.gd', 'var glyph := Look.C("signal") if uprising else Look.C("ink")'),
  corner_glyph: Else('look_sector.gd', 'var glyph := Look.C("signal") if uprising else Look.C("ink")'),
  bar_energy: S('look_sector.gd', 'fill = Look.C("ink") if kind == "energy" else Look.C("olive")'),
  bar_mines: Else('look_sector.gd', 'fill = Look.C("ink") if kind == "energy" else Look.C("olive")'),
  bar_free: S('look_sector.gd', 'fill = Look.C("paper")'),
  bar_edge: S('look_sector.gd', 'sb.border_color = Look.C("ink")')
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
  /** A head-to-head screen's title (LookWindow.DressScreen): the display face, its own size. */
  screen_title: S('look_window.gd', 'for t in s.find_children("Title", "Label", true, false):', 'title.add_theme_font_override("font", Look.F("display"))'),
  finder_search_label: S('planet_finder.gd', 'field.theme_type_variation = Look.HEADING', 'field.add_theme_font_size_override("font_size", Look.Size("label"))'),
  row_unread: Else('look_dispatch.gd', 'subject.add_theme_font_override("font", Look.F("body" if read else "body_bold"))'),
  row_read: S('look_dispatch.gd', 'subject.add_theme_font_override("font", Look.F("body" if read else "body_bold"))'),
  row_meta: S('look_dispatch.gd', 'meta.add_theme_font_size_override("font_size", Look.Size("small"))'),
  stamp_paper: S('look_dispatch.gd', 'word.add_theme_font_override("font", Look.F("typed_bold"))', 'word.add_theme_font_size_override("font_size", Look.Size("label") if on_paper else Look.Size("small"))'),
  stamp_ledger: Else('look_dispatch.gd', 'word.add_theme_font_override("font", Look.F("typed_bold"))', 'word.add_theme_font_size_override("font_size", Look.Size("label") if on_paper else Look.Size("small"))'),
  dispatch_subject: S('look_dispatch.gd', 'subject.add_theme_font_override("font", Look.F("display"))', 'subject.add_theme_font_size_override("font_size", Look.Size("heading") + 4)'),
  dispatch_meta: S('look_dispatch.gd', 'meta.add_theme_font_override("font", Look.F("body"))', 'meta.add_theme_font_size_override("font_size", Look.Size("label"))'),
  dispatch_body: S('look_dispatch.gd', 'body.add_theme_font_override("normal_font", Look.F("body"))', 'body.add_theme_font_size_override("normal_font_size", Look.Size("body"))'),
  dispatch_empty: S('look_dispatch.gd', 'label.add_theme_font_size_override("font_size", Look.Size("body"))'),
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
  credits_section: S('credits_window.gd', '_ink(l, Look.F("display"), Look.Size("heading"), "ink")'),
  /** A system's name on the plate: the look's face at the window's own 15 px. */
  sector_name: S('look_sector.gd', 'label.add_theme_font_override("font", Look.F("body_bold"))')
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

/** Look._FolderTab(fill, edge, top): Box(fill, "", 0, -1, 6), `edge` along the
 * top `top` px (the rest of its body is the source's tweak lines). */
function folderTab(a: string[]): Box {
  const b = box([a[0], '""', '0', '-1', '6'])
  b.edge = tok(a[1])
  b.width[1] = Number(a[2])
  return b
}

type Call = 'Box' | 'Edged' | '_FolderTab'

/** The Box(...), Edged(...) or _FolderTab(...) call in a line, with its
 * arguments, even when it sits inside another call (set_stylebox(..., Box(...))). */
function findCall(line: string): { name: Call; args: string[] } | null {
  const m = /(?:\b|(?<![\w]))(Box|Edged|_FolderTab)\(/.exec(line)
  if (!m) return null
  let depth = 0
  for (let i = m.index + m[1].length; i < line.length; i++) {
    if (line[i] === '(') depth++
    if (line[i] === ')' && --depth === 0) return { name: m[1] as Call, args: args(line.slice(m.index, i + 1)) }
  }
  return null
}

/** A style read from its lines: the Box/Edged call, then the tweaks after it. */
export function readBox(src: Source): Box {
  let b: Box | null = null
  for (const line of src.lines) {
    const call: ReturnType<typeof findCall> = b ? null : findCall(line)
    if (call) {
      b = call.name === 'Box' ? box(call.args) : call.name === 'Edged' ? edged(call.args) : folderTab(call.args)
      continue
    }
    if (!b) continue
    let m = /\.border_width_(left|top|right|bottom) = (\d+)/.exec(line)
    if (m) b.width[SIDE_NAMES.indexOf(m[1])] = Number(m[2])
    m = /\.border_color = (?:Look\.)?C\("(\w+)"\)/.exec(line)
    if (m) b.edge = m[1] as ColorToken
    m = /\.set_corner_radius_all\((\d+)\)/.exec(line)
    if (m) b.radius = Number(m[1])
    m = /\.expand_margin_(left|top|right|bottom) = (-?\d+)/.exec(line)
    if (m) b.expand[SIDE_NAMES.indexOf(m[1])] = Number(m[2])
    m = /\.corner_radius_(top_left|top_right|bottom_right|bottom_left) = (\d+)/.exec(line)
    if (m) {
      const r = b.radius
      b.corners ??= [r, r, r, r]
      b.corners[['top_left', 'top_right', 'bottom_right', 'bottom_left'].indexOf(m[1])] = Number(m[2])
    }
    m = /\.content_margin_(left|top|right|bottom) = (\d+)/.exec(line)
    if (m) {
      const p = b.pad
      b.padSides ??= [p, p, p, p]
      b.padSides[SIDE_NAMES.indexOf(m[1])] = Number(m[2])
    }
  }
  if (!b) throw new Error(`No Box or Edged in ${src.lines.join(' | ')}`)
  return b
}

/**
 * The names a line passes to `fn` (C, F or Size), grouped by call:
 * `C("a") if x else Look.C("b")` is [[a], [b]]; `C("a" if x else "b")` is
 * [[a, b]]. With Size, each name keeps its "+ n".
 */
function calls(line: string, fn: 'C' | 'F' | 'Size'): { name: string; plus: number }[][] {
  const re = new RegExp(`\\b${fn}\\("(\\w+)"(?:\\s+if\\s+[^"]*?\\s+else\\s+"(\\w+)")?\\)(?:\\s*\\+\\s*(\\d+))?`, 'g')
  return [...line.matchAll(re)].map((m) => {
    const plus = m[3] ? Number(m[3]) : 0
    return m[2] ? [{ name: m[1], plus }, { name: m[2], plus }] : [{ name: m[1], plus }]
  })
}

/** The branch a source picks: the first name, or for `else` the other side's. */
function pickCall(groups: { name: string; plus: number }[][], branch: Source['branch']): { name: string; plus: number } | null {
  if (!groups.length) return null
  if (branch !== 'else') return groups[0][0]
  return groups.length > 1 ? groups[1][0] : groups[0][groups[0].length - 1]
}

/** The token a colour line names: its C("token") (the chosen side of one that
 * picks between two), else (the Credits sheet's _ink / _para helpers, which
 * take a token's name) its last quoted token. */
export function readColor(src: Source): ColorToken {
  for (const line of src.lines) {
    const c = pickCall(calls(line, 'C'), src.branch)
    if (c) return c.name as ColorToken
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
    const f = pickCall(calls(line, 'F'), src.branch)
    if (f && role === null) role = f.name
    if (/theme_type_variation = Look\.HEADING/.test(line)) role = 'display'
    const s = pickCall(calls(line, 'Size'), src.branch)
    if (s && size === null) size = { name: s.name, plus: s.plus }
  }
  return { role, size }
}

// ---------------------------------------------------------------------------
// The window dress's palette trade (look_window.gd, phase 6)
// ---------------------------------------------------------------------------

/**
 * THE PLAIN WINDOWS' OWN COLOURS AND THE LOOK'S FOR EACH, as the game lists
 * them: inside a dressed window, a ColorRect or a style's fill in BG_MAP, a
 * style's border in EDGE_MAP and a text colour in TEXT_MAP becomes the token
 * beside it (matched on RGB within TOLERANCE, alpha kept); a playable side's
 * colour as text becomes the side's look colour. Anything else is left as
 * the window drew it.
 */
const row = (rgb: string, token: string) => `[Color(${rgb}), "${token}"],`
export const PALETTE = {
  BG_MAP: S(
    'look_window.gd',
    'const BG_MAP := [',
    row('0.18, 0.22, 0.28', 'chassis_deep'),
    row('0.12, 0.16, 0.22', 'chassis'),
    row('0.12, 0.16, 0.21', 'chassis'),
    row('0.08, 0.10, 0.14', 'chassis_deep'),
    row('0.06, 0.08, 0.13', 'chassis_deep'),
    row('0.06, 0.07, 0.11', 'chassis_deep'),
    row('0.20, 0.20, 0.20', 'chassis_deep'),
    row('0.40, 0.40, 0.40', 'chassis_raised'),
    row('0.20, 0.60, 0.20', 'olive_deep')
  ),
  EDGE_MAP: S('look_window.gd', 'const EDGE_MAP := [', row('0.40, 0.62, 0.92', 'brass_dim'), row('0.55, 0.70, 0.95', 'brass_dim'), row('0.60, 0.70, 0.80', 'brass_dim')),
  TEXT_MAP: S(
    'look_window.gd',
    'const TEXT_MAP := [',
    row('0.60, 0.70, 0.80', 'heading'),
    row('0.60, 0.90, 0.60', 'heading'),
    row('0.565, 0.933, 0.565', 'text'), // Color.LIGHT_GREEN: running, present (Manufacturing's "[Operational]")
    row('1.00, 0.843, 0.00', 'heading'), // Color.GOLD: at work ("[Building ...]")
    row('0.50, 0.70, 1.00', 'heading'),
    row('0.92, 0.94, 1.00', 'text'),
    row('0.827, 0.827, 0.827', 'text'),
    row('0.80, 0.80, 0.80', 'text'),
    row('0.95, 0.97, 1.00', 'text'),
    row('0.95, 0.96, 1.00', 'text'),
    row('1.00, 1.00, 1.00', 'text'),
    row('0.62, 0.72, 0.88', 'text_muted'),
    row('0.70, 0.78, 0.92', 'text_muted'),
    row('0.55, 0.60, 0.70', 'text_muted'),
    row('0.45, 0.48, 0.56', 'text_muted'),
    row('0.75, 0.75, 0.75', 'text_muted'),
    row('0.663, 0.663, 0.663', 'text_muted'),
    row('0.60, 0.60, 0.60', 'text_muted'),
    row('0.50, 0.50, 0.50', 'text_muted'),
    row('0.40, 0.40, 0.40', 'text_muted')
  ),
  TOLERANCE: S('look_window.gd', 'const TOLERANCE := 0.015')
} satisfies Record<string, Source>

export type PaletteId = 'BG_MAP' | 'EDGE_MAP' | 'TEXT_MAP'

export interface PaletteRow {
  rgb: [number, number, number]
  token: ColorToken
}

/** A palette table's rows, read from its lines. */
export function readPalette(src: Source): PaletteRow[] {
  const out: PaletteRow[] = []
  for (const line of src.lines) {
    const m = /^\[Color\(([\d.]+), ([\d.]+), ([\d.]+)\), "(\w+)"\],$/.exec(line)
    if (m) out.push({ rgb: [Number(m[1]), Number(m[2]), Number(m[3])], token: m[4] as ColorToken })
  }
  return out
}

export function readTolerance(src: Source): number {
  const m = /TOLERANCE := ([\d.]+)/.exec(src.lines.join('\n'))
  if (!m) throw new Error('No TOLERANCE')
  return Number(m[1])
}

/**
 * PLAIN COLOURS THE WINDOWS WRITE THEMSELVES, where a mock-up draws a window
 * the dress reaches only through the palette (the code-built windows without
 * the scene template's title bar): their frame and title, as their scripts
 * set them.
 */
export const PLAIN = {
  overview_panel: S('galaxy_overview_window.gd', 'sb.bg_color = Color(0.06, 0.08, 0.13, 0.97)', 'sb.border_color = Color(0.40, 0.62, 0.92, 0.85)', 'sb.set_border_width_all(1)'),
  overview_title: S('galaxy_overview_window.gd', 'title.add_theme_font_size_override("font_size", 20)', 'title.add_theme_color_override("font_color", Color(0.95, 0.97, 1.0))'),
  objectives_panel: S('objectives_window.gd', 'sb.bg_color = Color(0.06, 0.08, 0.13, 0.97)', 'sb.border_color = Color(0.40, 0.62, 0.92, 0.85)', 'sb.set_border_width_all(1)'),
  objectives_title: S('objectives_window.gd', 'title.add_theme_font_size_override("font_size", 20)', 'title.add_theme_color_override("font_color", Color(0.95, 0.97, 1.0))'),
  results_panel: S('battle_results_window.gd', 'sb.bg_color = Color(0.06, 0.07, 0.11, 0.98)', 'sb.border_color = Color(0.55, 0.70, 0.95, 0.9)', 'sb.set_border_width_all(1)'),
  results_title: S('battle_results_window.gd', 'title.add_theme_font_size_override("font_size", 21)', 'title.add_theme_color_override("font_color", Color(0.95, 0.96, 1.0))'),
  alert_panel: S('battle_alert_window.gd', 'sb.bg_color = Color(0.09, 0.05, 0.06, 0.98)', 'sb.border_color = Color(0.90, 0.35, 0.30, 0.95)', 'sb.set_border_width_all(2)'),
  alert_title: S('battle_alert_window.gd', 'title.add_theme_font_size_override("font_size", 22)', 'title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.80))')
} satisfies Record<string, Source>

export type PlainId = keyof typeof PLAIN

export interface PlainStyle {
  bg: string | null
  edge: string | null
  width: number
  text: string | null
  size: number | null
}

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
const colorHex = (s: string) => {
  const [r, g, b] = s.split(',').map((x) => Number(x.trim()))
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`
}

/** A window's own frame or title, read from its script's lines (as #rrggbb). */
export function readPlain(src: Source): PlainStyle {
  const all = src.lines.join('\n')
  const bg = /bg_color = Color\(([\d., ]+?)(?:, [\d.]+)?\)/.exec(all)
  const edge = /border_color = Color\(([\d., ]+?)(?:, [\d.]+)?\)/.exec(all)
  const width = /set_border_width_all\((\d+)\)/.exec(all)
  const text = /"font_color", Color\(([\d., ]+?)\)\)/.exec(all)
  const size = /"font_size", (\d+)\)/.exec(all)
  const rgb3 = (m: RegExpExecArray | null) => (m ? colorHex(m[1].split(',').slice(0, 3).join(',')) : null)
  return { bg: rgb3(bg), edge: rgb3(edge), width: width ? Number(width[1]) : 0, text: rgb3(text), size: size ? Number(size[1]) : null }
}

/** Every token a box paints with. */
export function boxTokens(b: Box): ColorToken[] {
  return [b.fill, b.edge].filter((t): t is ColorToken => t !== null)
}

// ---------------------------------------------------------------------------
// The sector window's numbers (phase 8): its layout (sector_window.gd
// Populate and the pieces it adds), the plate (look_sector.gd) and the GID
// star's size (gid.gd), each read out of its line.
// ---------------------------------------------------------------------------

export const SECTOR = {
  // The layout.
  MAX_DIMENSION: S('sector_window.gd', 'var maxDimension: float = 600.0'),
  PADDING: S('sector_window.gd', 'var padding: float = 60.0'),
  PADDING_BOTTOM: S('sector_window.gd', 'var paddingBottom: float = 92.0'),
  MIN_PLACING: S('sector_window.gd', 'const MinPlacing: float = 40.0'),
  DISC: S('sector_window.gd', 'planetMapNode.custom_minimum_size = Vector2(32, 32)'),
  CORNER: S('sector_window.gd', 'var cornerSize: float = 16.0'),
  GLYPH_INNER_X: S('sector_window.gd', 'const GlyphInnerX := 15.0'),
  GLYPH_INNER_Y: S('sector_window.gd', 'const GlyphInnerY := 9.0'),
  STAR_X: S('sector_window.gd', 'const StarOffsetX: float = 6.0'),
  STAR_Y: S('sector_window.gd', 'const StarOffsetY: float = 24.0'),
  NAME_BELOW: S('sector_window.gd', 'var nameY: float = finalY + 30'),
  NAME_BOX: S('sector_window.gd', 'nameLabel.size = Vector2(100, 20)'),
  NAME_SIZE: S('sector_window.gd', 'nameLabel.add_theme_font_size_override("font_size", 15)'),
  BARS_TOP: S('sector_window.gd', 'const BarsTop: float = 38.0'),
  BARS_LEFT: S('sector_window.gd', 'const BarsLeft: float = 24.0'),
  SQUARE: S('sector_window.gd', 'const SquareSize: float = 6.0'),
  SQUARE_GAP: S('sector_window.gd', 'const SquareGap: float = 1.0'),
  ROW_GAP: S('sector_window.gd', 'const RowGap: float = 2.0'),
  LOYALTY_HEIGHT: S('sector_window.gd', 'const LoyaltyHeight: float = 4.0'),
  BAR_MIN_WIDTH: S('sector_window.gd', 'const BarMinWidth: float = 30.0'),
  BAR_RADIUS: S('sector_window.gd', 'const CornerRadius: int = 2'),
  ENTRY_GAP: S('sector_window.gd', 'const EntryGap := 2.0'),
  EDGE_GAP: S('sector_window.gd', 'const EdgeGap := 4.0'),
  SEPARATE_PASSES: S('sector_window.gd', 'const SeparatePasses := 60'),
  // The plate.
  WASH: S('look_sector.gd', 'const WASH := 0.58'),
  SHARP_ZOOM: S('look_sector.gd', 'const SHARP_ZOOM := 4.0'),
  GRID: S('look_sector.gd', 'const GRID := 40.0'),
  GRID_ALPHA: S('look_sector.gd', 'c.a = 0.16'),
  HALO: S('look_sector.gd', 'const HALO := 4'),
  RIM: S('look_sector.gd', 'const RIM := 2'),
  HQ_RIM: S('look_sector.gd', 'disc.set_border_width_all(3 if hq else RIM)'),
  TAB_EDGE: S('look_sector.gd', 'tab.set_border_width_all(1)'),
  ON_PAPER_STEP: S('look_sector.gd', 'out = out.darkened(0.08)'),
  ON_PAPER_TRIES: S('look_sector.gd', 'while Look.Contrast(out, paper) < 4.5 and guard < 20:'),
  // The GID star ("+", its tier's flare size scaled for the window).
  FLARE_SCALE: S('gid.gd', 'const SectorFlareScale := 0.45'),
  FLARE_MIN: S('gid.gd', 'const SectorFlareMin := 9'),
  FLARE_BIG: S('gid.gd', 'const FlareBig := 46'),
  FLARE_MID: S('gid.gd', 'const FlareMid := 32'),
  FLARE_LOW: S('gid.gd', 'const FlareLow := 22')
} satisfies Record<string, Source>

export type SectorNumber = keyof typeof SECTOR

/** The numbers a line holds, in order (never one inside a name, like Vector2's 2). */
export function readNumbers(src: Source): number[] {
  return src.lines.flatMap((l) => [...l.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0])))
}

/** One of the sector window's numbers (the `i`th in its line). */
export const sectorNumber = (id: SectorNumber, i = 0): number => readNumbers(SECTOR[id])[i]
