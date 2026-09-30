// THE MOCK-UP KIT: the game's UI pieces drawn in the look being edited. Every
// piece takes its box, text colour, face and size from the game's own lines
// (src/core/look/theme.ts), and says so on the element: data-part (what it
// is), data-src (the lines), data-tokens (the colours it paints). A colour
// the look does not decide (a faction's, a status colour, Godot's default)
// is drawn as the game draws it and marked data-fixed with why.

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import type { LookPack } from '@core/look/pack'
import {
  BOXES,
  COLORS,
  FONTS,
  PALETTE,
  PLAIN,
  boxTokens,
  readBox,
  readColor,
  readFont,
  readPalette,
  readPlain,
  readTolerance,
  type Box,
  type BoxId,
  type ColorId,
  type FontId,
  type Metric,
  type PaletteRow,
  type PlainId,
  type Px
} from '@core/look/theme'
import { DEFAULT_METRICS, DEFAULT_OVERLAY_ALPHA, DEFAULT_SIZES, type ColorToken } from '@core/look/vocab'

export interface TexInfo {
  url: string
  width: number
  height: number
  margin: number
}

/** The look as the mock-ups need it: colours, metrics, sizes, faces, pictures. */
export interface Env {
  /** A token's colour; magenta when the look lacks it, as the game draws it. */
  c(t: ColorToken): string
  metric(m: Metric): number
  size(name: string, plus?: number): number
  /** CSS for a font role, falling back to body and then the system face. */
  face(role: string | null): CSSProperties
  tex(name: string): TexInfo | null
  /** look.json map_insets as the game loads them (Look.MapInsets): each picture that loads, with its `at`. */
  insets: { tex: TexInfo; at: [number, number, number, number]; file: string }[]
  /** A sector-window corner glyph's own picture (display.json icons), or null for the engine's. */
  icon(glyph: string): TexInfo | null
  /** A side's colour in the chrome: the look's, else factions.json's. */
  side(factionId: string): string
  overlayAlpha: number
  pack: LookPack
  mapUrl: string | null
  dossier: { subtitle: string; mapRect: number[] | null; caption: string }
  /** look.json `messages`, read as the game reads it (Look.DispatchHeader, Stamp, Urgent). */
  messages: { header: string; stamp: (category: string) => string; urgent: (category: string) => boolean }
}

export const EnvContext = createContext<Env | null>(null)
export const useEnv = (): Env => useContext(EnvContext)!

/** What the stage has picked for a mock-up that offers a choice (the Sector window's theatre). */
export const ChoiceContext = createContext<string | null>(null)
export const useChoice = (): string | null => useContext(ChoiceContext)

// ---------------------------------------------------------------------------
// The window dress's palette trade (look_window.gd Remap)
// ---------------------------------------------------------------------------

const BG_ROWS = readPalette(PALETTE.BG_MAP)
const EDGE_ROWS = readPalette(PALETTE.EDGE_MAP)
const TEXT_ROWS = readPalette(PALETTE.TEXT_MAP)
const TOLERANCE = readTolerance(PALETTE.TOLERANCE)

function rgbOf(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : null
}

/** Within the game's TOLERANCE on each channel. */
function near(a: string, b: [number, number, number]): boolean {
  const x = rgbOf(a)
  // Half a step of 8-bit rounding either side, so a colour written as #rrggbb still matches.
  return !!x && x.every((v, i) => Math.abs(v - b[i]) <= TOLERANCE + 0.5 / 255)
}

function traded(rows: PaletteRow[], hex: string): PaletteRow | null {
  return rows.find((r) => near(hex, r.rgb)) ?? null
}

/** Inside a window the game dresses (LookWindow.DressAny): its own colours are traded for the look's. */
const DressedContext = createContext(false)
export const Dressed = ({ children }: { children: ReactNode }) => <DressedContext.Provider value>{children}</DressedContext.Provider>

/** Inside a dialog the game makes an order sheet (Look.SheetTheme): parchment, words in ink. */
const SheetContext = createContext(false)

export { DEFAULT_METRICS, DEFAULT_SIZES, DEFAULT_OVERLAY_ALPHA }

/** Godot's Color(r, g, b) as #rrggbb. */
export function rgb(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

const boxes = new Map<BoxId, Box>()
export function box(id: BoxId): Box {
  let b = boxes.get(id)
  if (!b) boxes.set(id, (b = readBox(BOXES[id])))
  return b
}
export const colorOf = (id: ColorId): ColorToken => readColor(COLORS[id])

function px(env: Env, v: Px): number {
  return typeof v === 'number' ? v : env.metric(v)
}

/** A StyleBoxFlat as CSS. Godot draws the border inside the box. */
export function boxCss(env: Env, b: Box, padOverride?: number): CSSProperties {
  const [l, t, r, bt] = b.width.map((w) => px(env, w))
  const pad = padOverride ?? px(env, b.pad)
  return {
    background: b.fill ? env.c(b.fill) : 'transparent',
    borderStyle: 'solid',
    borderColor: b.edge ? env.c(b.edge) : 'transparent',
    borderWidth: `${t}px ${r}px ${bt}px ${l}px`,
    borderRadius: px(env, b.radius),
    padding: pad,
    boxSizing: 'border-box'
  }
}

export function fontCss(env: Env, id: FontId | null, fallbackSize = 'body'): CSSProperties {
  const f = id ? readFont(FONTS[id]) : { role: null, size: null }
  return { ...env.face(f.role ?? 'body'), fontSize: f.size ? env.size(f.size.name, f.size.plus) : env.size(fallbackSize) }
}

export interface Fixed {
  color: string
  note: string
}

interface PartProps {
  name: string
  box?: BoxId
  color?: ColorId
  font?: FontId
  fixed?: Fixed
  /** Extra tokens this part paints that its box/colour do not name. */
  extra?: ColorToken[]
  /** A look texture this part is drawn with (look.json textures). */
  tex?: string
  pad?: number
  style?: CSSProperties
  className?: string
  children?: ReactNode
  title?: string
}

/** One visible part of a window, tagged with where its colours come from. */
export function Part({ name, box: boxId, color, font, fixed, extra, tex, pad, style, className, children, title }: PartProps) {
  const env = useEnv()
  const tokens = new Set<ColorToken>(extra ?? [])
  const src: string[] = []
  let css: CSSProperties = {}
  if (boxId) {
    const b = box(boxId)
    boxTokens(b).forEach((t) => tokens.add(t))
    src.push(`${BOXES[boxId].file}:${boxId}`)
    css = boxCss(env, b, pad)
  }
  if (color) {
    const t = colorOf(color)
    tokens.add(t)
    src.push(`${COLORS[color].file}:${color}`)
    css.color = env.c(t)
  }
  if (font) {
    src.push(`${FONTS[font].file}:${font}`)
    css = { ...css, ...fontCss(env, font) }
  }
  if (fixed) css.color = css.color ?? fixed.color
  return (
    <div
      className={`part${className ? ' ' + className : ''}`}
      data-part={name}
      data-src={src.join(' ') || undefined}
      data-tokens={[...tokens].join(' ') || undefined}
      data-fixed={fixed ? fixed.note : undefined}
      data-tex={tex}
      title={title}
      style={{ ...css, ...style }}
    >
      {children}
    </div>
  )
}

/** A side's colour in the chrome (look.json `sides`, else factions.json's). */
export function SideText({ factionId, children, style, name = 'Side colour' }: { factionId: string; children: ReactNode; style?: CSSProperties; name?: string }) {
  const env = useEnv()
  return (
    <span className="part" data-part={name} data-side={factionId} style={{ color: env.side(factionId), ...style }}>
      {children}
    </span>
  )
}

export function SideBox({ factionId, style, name = 'Side colour' }: { factionId: string; style?: CSSProperties; name?: string }) {
  const env = useEnv()
  return <div className="part" data-part={name} data-side={factionId} style={{ background: env.side(factionId), ...style }} />
}

/** Text in a colour the window writes itself. In a window the game dresses, a
 * colour in the dress's TEXT_MAP becomes its token and a playable side's
 * colour becomes the side's look colour (LookWindow._text); any other colour
 * (damage red, ready green, gold) stays as the window drew it. */
export function FixedText({ color, note, children, style, drawn }: { color: string; note: string; children: ReactNode; style?: CSSProperties; drawn?: boolean }) {
  const env = useEnv()
  const dressed = useContext(DressedContext)
  // Text the window paints itself (draw_string), not a label: the trade never sees it.
  if (dressed && !drawn) {
    const row = traded(TEXT_ROWS, color)
    if (row)
      return (
        <span className="part" data-part="Text (its plain colour, traded for the look's)" data-src="look_window.gd:TEXT_MAP" data-tokens={row.token} style={{ color: env.c(row.token), ...style }}>
          {children}
        </span>
      )
    const side = env.pack.factions.find((f) => {
      const rgb = rgbOf(f.color.toLowerCase())
      return rgb !== null && near(color, rgb)
    })
    if (side)
      return (
        <span className="part" data-part="Text in a side's colour (traded for its look colour)" data-src="look_window.gd:_text" data-side={side.id} style={{ color: env.side(side.id), ...style }}>
          {children}
        </span>
      )
  }
  return (
    <span className="part" data-part="Fixed colour" data-fixed={note} style={{ color, ...style }}>
      {children}
    </span>
  )
}

/** A block in a colour the window writes itself (a picture's frame, a map).
 * `scene`: a ColorRect or a style's fill written into the window, which the
 * dress trades through BG_MAP; a block the window draws itself is left. */
export function FixedBox({ color, note, style, children, name = 'Fixed colour', scene }: { color: string; note: string; style?: CSSProperties; children?: ReactNode; name?: string; scene?: boolean }) {
  const env = useEnv()
  const dressed = useContext(DressedContext)
  const row = dressed && scene ? traded(BG_ROWS, color) : null
  if (row)
    return (
      <div className="part" data-part={`${name} (its plain colour, traded for the look's)`} data-src="look_window.gd:BG_MAP" data-tokens={row.token} style={{ background: env.c(row.token), ...style }}>
        {children}
      </div>
    )
  return (
    <div className="part" data-part={name} data-fixed={note} style={{ background: color, ...style }}>
      {children}
    </div>
  )
}

/**
 * A window the game builds in code without the scene template's title bar
 * (Galaxy Overview, Objectives, the battle windows): its own frame and title
 * as its script sets them (PLAIN), traded through the dress's BG_MAP,
 * EDGE_MAP and TEXT_MAP where they match; kept where they do not.
 */
export function CodeWindow({ frame, heading, title, width, children }: { frame: PlainId; heading: PlainId; title: ReactNode; width: number; children: ReactNode }) {
  const env = useEnv()
  const f = readPlain(PLAIN[frame])
  const h = readPlain(PLAIN[heading])
  const bg = f.bg ? traded(BG_ROWS, f.bg) : null
  const edge = f.edge ? traded(EDGE_ROWS, f.edge) : null
  const tokens = [bg?.token, edge?.token].filter(Boolean).join(' ')
  const src = [`${PLAIN[frame].file}:${frame}`, bg ? 'look_window.gd:BG_MAP' : '', edge ? 'look_window.gd:EDGE_MAP' : ''].filter(Boolean).join(' ')
  return (
    <Dressed>
      <div
        className="part"
        data-part="Window frame (its own style)"
        data-src={src}
        data-tokens={tokens || undefined}
        data-fixed={!bg || !edge ? "The window's own frame colour: the dress's tables do not list it, so it is kept." : undefined}
        style={{ width, boxSizing: 'border-box', background: bg ? env.c(bg.token) : f.bg ?? 'transparent', border: `${f.width}px solid ${edge ? env.c(edge.token) : f.edge ?? 'transparent'}`, padding: 14, display: 'grid', gap: 8, alignContent: 'start', ...env.face('body'), fontSize: env.size('body') }}
      >
        <FixedText color={h.text ?? '#ffffff'} note="The window's own title colour." style={{ fontSize: h.size ?? env.size('body') }}>
          {title}
        </FixedText>
        {children}
      </div>
    </Dressed>
  )
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const sheet = useContext(SheetContext)
  return (
    <Part name={sheet ? 'Label on the order sheet' : 'Label'} color={sheet ? 'sheet_label' : 'label'} font="default" style={style}>
      {children}
    </Part>
  )
}

export const Heading = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <Part name="Heading" color="HEADING" font="HEADING" style={{ textTransform: 'uppercase', ...style }}>
    {children}
  </Part>
)

export const Ink = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <Part name="Text on a document" color="INK" font="INK" style={style}>
    {children}
  </Part>
)

export const Typed = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <Part name="Typed heading" color="TYPED" font="TYPED" style={style}>
    {children}
  </Part>
)

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export type KeyState = 'normal' | 'hover' | 'pressed' | 'disabled' | 'focus'

const KEY_BOX: Record<KeyState, BoxId> = { normal: 'key', hover: 'key_hover', pressed: 'key_down', disabled: 'key_off', focus: 'key' }
const CMD_BOX: Record<KeyState, BoxId> = { normal: 'COMMAND', hover: 'COMMAND_hover', pressed: 'COMMAND_pressed', disabled: 'key_off', focus: 'COMMAND' }

function focusRing(env: Env): CSSProperties {
  const b = box('focus_ring')
  const w = px(env, b.width[0])
  return { outline: `${w}px solid ${env.c(b.edge!)}`, outlineOffset: b.expand[0] - w }
}

/** A plain button (the theme's base Button). */
export function Key({ label, state = 'normal', style, name = 'Button' }: { label: ReactNode; state?: KeyState; style?: CSSProperties; name?: string }) {
  const env = useEnv()
  return (
    <Part
      name={`${name} (${state})`}
      box={KEY_BOX[state]}
      color={state === 'disabled' ? 'button_text_disabled' : 'button_text'}
      font="default"
      extra={state === 'focus' ? ['brass'] : undefined}
      className="key"
      style={{ ...(state === 'focus' ? focusRing(env) : {}), ...style }}
    >
      {label}
    </Part>
  )
}

/** A console key (LookCommand). */
export function Cmd({ label, state = 'normal', style, small, name = 'Console key' }: { label: ReactNode; state?: KeyState; style?: CSSProperties; small?: boolean; name?: string }) {
  const env = useEnv()
  return (
    <Part
      name={`${name} (${state})`}
      box={CMD_BOX[state]}
      color={state === 'disabled' ? 'button_text_disabled' : 'button_text'}
      font={small ? 'window_keys_dress' : 'COMMAND'}
      extra={state === 'focus' ? ['brass'] : undefined}
      className="key"
      style={{
        ...(small ? { ...env.face('display'), fontSize: env.size('small') } : {}),
        ...(state === 'focus' ? focusRing(env) : {}),
        ...style
      }}
    >
      {label}
    </Part>
  )
}

/** A category on the dispatch rail (LookRail); `count` is the brass unread badge. */
export function RailItem({ label, state = 'normal', count }: { label: string; state?: KeyState; count?: number }) {
  const id: BoxId = state === 'pressed' ? 'RAIL_pressed' : state === 'hover' ? 'RAIL_hover' : state === 'disabled' ? 'key_off' : 'RAIL'
  return (
    <Part name={`Rail item (${state})`} box={id} color="button_text" font="RAIL" className="key rail" style={{ display: 'flex', alignItems: 'center' }}>
      <span>{label}</span>
      {count ? (
        <Part name="Unread count" color="hud_unread" font="hud_unread" style={{ marginLeft: 'auto', paddingLeft: 8 }}>
          {count}
        </Part>
      ) : null}
    </Part>
  )
}

/** A list row (LookRow). */
export function RowItem({ label, state = 'normal', style }: { label: ReactNode; state?: KeyState; style?: CSSProperties }) {
  const id: BoxId = state === 'pressed' ? 'ROW_pressed' : state === 'hover' ? 'ROW_hover' : 'ROW'
  return (
    <Part name={`List row (${state})`} box={id} color="ROW_text" font="default" className="key" style={style}>
      {label}
    </Part>
  )
}

export interface ListItem {
  label: ReactNode
  state?: 'normal' | 'hover' | 'selected'
  fixed?: Fixed
}

/** An ItemList. */
export function ItemList({ items, style, name = 'List' }: { items: ListItem[]; style?: CSSProperties; name?: string }) {
  return (
    <Part name={name} box="item_list" style={{ display: 'grid', alignContent: 'start', gap: 0, overflow: 'hidden', ...style }}>
      {items.map((it, i) => {
        const id: BoxId | undefined = it.state === 'selected' ? 'item_selected' : it.state === 'hover' ? 'item_hover' : undefined
        const text = it.fixed ? <FixedText color={it.fixed.color} note={it.fixed.note}>{it.label}</FixedText> : it.label
        return (
          <Part key={i} name={`List item (${it.state ?? 'normal'})`} box={id} color="item_text" font="default" pad={id ? undefined : 2} style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {text}
          </Part>
        )
      })}
    </Part>
  )
}

export interface TabSpec {
  label: string
  state?: 'selected' | 'normal' | 'hover' | 'disabled'
}

/** A tab bar; with `children`, a TabContainer's panel under it (`panelBox`: a style the window gives it). */
export function Tabs({ tabs, children, style, panelBox = 'tab_panel' }: { tabs: TabSpec[]; children?: ReactNode; style?: CSSProperties; panelBox?: BoxId }) {
  return (
    <div style={{ display: 'grid', ...style }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
        {tabs.map((t, i) => {
          const s = t.state ?? 'normal'
          const id: BoxId = s === 'selected' ? 'tab_selected' : s === 'hover' ? 'tab_hovered' : s === 'disabled' ? 'tab_disabled' : 'tab_unselected'
          const color: ColorId = s === 'selected' || s === 'hover' ? 'tab_selected_text' : s === 'disabled' ? 'tab_disabled_text' : 'tab_unselected_text'
          return (
            <Part key={i} name={`Tab (${s})`} box={id} color={color} font="default" className="key">
              {t.label}
            </Part>
          )
        })}
      </div>
      {children !== undefined && (
        <Part name="Tab panel" box={panelBox} style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
          {children}
        </Part>
      )}
    </div>
  )
}

/** A text field. */
export function LineEdit({ value, placeholder, focus, readOnly, style }: { value?: string; placeholder?: string; focus?: boolean; readOnly?: boolean; style?: CSSProperties }) {
  const env = useEnv()
  const id: BoxId = readOnly ? 'line_edit_read_only' : 'line_edit'
  return (
    <Part name={`Text field${focus ? ' (focused)' : readOnly ? ' (read-only)' : ''}`} box={id} color={value ? 'line_edit_text' : 'line_edit_placeholder'} font="default" extra={focus ? ['brass'] : undefined} style={{ position: 'relative', whiteSpace: 'nowrap', overflow: 'hidden', ...(focus ? { boxShadow: `inset 0 0 0 ${env.metric('focus')}px ${env.c('brass')}` } : {}), ...style }}>
      {value || placeholder || ' '}
      {focus && <Part name="Caret" color="line_edit_caret" style={{ display: 'inline-block', width: 1, height: '1em', background: env.c(colorOf('line_edit_caret')), verticalAlign: 'text-bottom', marginLeft: 1 }} />}
    </Part>
  )
}

/** A check box: its row lights under the pointer; its box is Godot's own icon
 * unless `lookIcon` (the Cockpit dossier draws its own). */
export function Check({ label, checked, hover, lookIcon }: { label: string; checked?: boolean; hover?: boolean; lookIcon?: boolean }) {
  const env = useEnv()
  const sheet = useContext(SheetContext)
  const icon = lookIcon ? (
    <Part name="Check box (the dossier's own)" color="check_frame" extra={checked ? ['brass'] : undefined} style={{ width: 18, height: 18, border: `2px solid ${env.c('text')}`, padding: 2, boxSizing: 'border-box', flex: 'none' }}>
      {checked && <Part name="Tick" color="check_tick" style={{ width: '100%', height: '100%', background: env.c('brass') }} />}
    </Part>
  ) : (
    <FixedBox name="Check box icon" color={checked ? '#dfdfdf' : 'transparent'} note="Godot's own check box icon: the look does not draw it." style={{ width: 14, height: 14, border: '2px solid #dfdfdf', borderRadius: 3, flex: 'none', boxSizing: 'border-box' }} />
  )
  return (
    <Part
      name={`Check box${sheet ? ' on the order sheet' : ''}${hover ? ' (under the pointer)' : ''}`}
      box={hover ? (sheet ? 'sheet_check_hover' : 'check_hover') : 'check_bare'}
      color={sheet ? 'sheet_check_text' : 'button_text'}
      font="default"
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      {icon}
      <span>{label}</span>
    </Part>
  )
}

/** The brass rule (LookDivider / HSeparator): the rule texture, else a brass_dim line. */
export function Divider({ style }: { style?: CSSProperties }) {
  const env = useEnv()
  const tex = env.tex('rule')
  if (tex)
    return (
      <Part name="Divider (the rule texture)" tex="rule" style={{ height: tex.height, background: `url(${tex.url}) repeat-x left center`, margin: '3px 0', ...style }} />
    )
  return (
    <div style={{ padding: '3px 0', ...style }}>
      <Part name="Divider" color="rule" style={{ height: 1, background: env.c(colorOf('rule')) }} />
    </div>
  )
}

/** A VSeparator: a brass_dim upright, 6 px short at each end. */
export function VRule({ height = 24 }: { height?: number }) {
  const env = useEnv()
  return (
    <div style={{ width: 12, height, display: 'grid', justifyItems: 'center', padding: '6px 0', boxSizing: 'border-box', flex: 'none' }}>
      <Part name="Upright rule" color="upright" style={{ width: 1, height: '100%', background: env.c(colorOf('upright')) }} />
    </div>
  )
}

export function Progress({ value, style }: { value: number; style?: CSSProperties }) {
  return (
    <Part name="Progress bar" box="progress_bg" color="progress_text" style={{ height: 18, position: 'relative', overflow: 'hidden', ...style }}>
      <Part name="Progress fill" box="progress_fill" style={{ position: 'absolute', inset: 0, width: `${value}%` }} />
    </Part>
  )
}

/** A vertical scroll bar with its grabber. */
export function Scroll({ height = 120, hot }: { height?: number; hot?: boolean }) {
  return (
    <Part name="Scroll bar" box="scroll_track" style={{ width: 10, height, position: 'relative', flex: 'none' }}>
      <Part name={`Scroll grabber${hot ? ' (under the pointer)' : ''}`} box={hot ? 'scroll_grabber_hot' : 'scroll_grabber'} style={{ position: 'absolute', left: 0, right: 0, top: 8, height: '35%' }} />
    </Part>
  )
}

export function Chip({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return (
    <Part name={alert ? 'Alert chip' : 'Chip'} box={alert ? 'CHIP_ALERT' : 'CHIP'} color="label" font="default">
      {children}
    </Part>
  )
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

/** A document (Look.Paper): the paper_frame nine-slice when the look ships
 * one, else flat paper with a paper_edge border. `box` names the line that
 * asks for it (a dialog's order sheet: sheet_panel). */
export function Doc({ children, style, name = 'Document', box: boxId = 'DOCUMENT' }: { children: ReactNode; style?: CSSProperties; name?: string; box?: BoxId }) {
  const env = useEnv()
  const frame = env.tex('paper_frame')
  if (frame) {
    const m = frame.margin
    return (
      <Part
        name={`${name} (the paper_frame texture)`}
        tex="paper_frame"
        style={{
          borderStyle: 'solid',
          borderWidth: m,
          borderImage: `url(${frame.url}) ${m} fill / ${m}px stretch`,
          padding: Math.max(0, 14 - m),
          boxSizing: 'border-box',
          ...style
        }}
      >
        {children}
      </Part>
    )
  }
  return (
    <Part name={name} box={boxId} style={style}>
      {children}
    </Part>
  )
}

/** The desk: the look's desk and grain textures, over chassis_deep. */
export function Desk({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const env = useEnv()
  const desk = env.tex('desk')
  const grain = env.tex('grain')
  const layers = [grain, desk].filter(Boolean).map((t) => `url(${t!.url}) repeat`)
  return (
    <Part name="Desk" color="cockpit_background" style={{ background: [...layers, env.c('chassis_deep')].join(', '), color: undefined, ...style }}>
      {children}
    </Part>
  )
}

/** The dim laid over the screen behind a dialog (overlay at overlay_alpha). */
export function Dim({ children }: { children?: ReactNode }) {
  const env = useEnv()
  const hex = env.c(colorOf('dim'))
  const a = Math.round(Math.max(0, Math.min(1, env.overlayAlpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return (
    <Part name="Dim behind a dialog" color="dim" style={{ position: 'absolute', inset: 0, background: `${hex}${a}`, display: 'grid', placeItems: 'center' }}>
      {children}
    </Part>
  )
}

/** A game window in the window dress (look_window.gd Dress): the frame, the
 * dark title bar with its brass hairline, the title in the display face, the
 * minimise and close keys as console keys, the body in chassis; and inside,
 * the window's own colours traded for the look's (Remap). */
export function Win({ title, width, children, bodyPad = 8, style }: { title: string; width: number; children: ReactNode; bodyPad?: number; style?: CSSProperties }) {
  return (
    <Dressed>
      <WinFrame title={title} width={width} bodyPad={bodyPad} style={style}>
        {children}
      </WinFrame>
    </Dressed>
  )
}

function WinFrame({ title, width, children, bodyPad, style }: { title: string; width: number; children: ReactNode; bodyPad: number; style?: CSSProperties }) {
  const env = useEnv()
  return (
    <Part name="Window frame" box="window_frame" style={{ width, display: 'grid', ...style }}>
      <Part name="Title bar" color="window_bar" style={{ position: 'relative', minHeight: 26, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px 3px 8px', background: env.c(colorOf('window_bar')), color: undefined }}>
        <Part name="Window title" color="window_title_text" font="window_title_dress" style={{ textTransform: 'uppercase', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {title}
        </Part>
        <Cmd label="_" small style={{ padding: '0 7px', lineHeight: '18px' }} name="Minimise key" />
        <Cmd label="X" small style={{ padding: '0 7px', lineHeight: '18px' }} name="Close key" />
        <Part name="Title bar rule" color="window_rule" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: env.c(colorOf('window_rule')) }} />
      </Part>
      <Part name="Window body" color="window_body" style={{ background: env.c(colorOf('window_body')), color: env.c('text'), padding: bodyPad, display: 'grid', gap: 8, alignContent: 'start' }}>
        {children}
      </Part>
    </Part>
  )
}

/** An AcceptDialog / ConfirmationDialog as an order sheet (Look.SheetTheme,
 * dressed by Look.InstallPopups): the steel Window frame reaching 28 px above
 * for the title, the body parchment with its words in ink, OK and Cancel as
 * command keys. */
export function Dialog({ title, width, children, buttons }: { title: string; width: number; children: ReactNode; buttons: ReactNode }) {
  const f = box('dialog_frame')
  return (
    <Part name="Dialog frame" box="dialog_frame" style={{ width, display: 'grid' }}>
      <Part name="Dialog title" color="window_title" font="window_title" style={{ height: f.expand[1], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {title}
      </Part>
      <SheetContext.Provider value>
        <Doc name="Order sheet" box="sheet_panel" style={{ display: 'grid', gap: 12 }}>
          {children}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>{buttons}</div>
        </Doc>
      </SheetContext.Provider>
    </Part>
  )
}

export interface MenuItem {
  label?: string
  separator?: string | true
  disabled?: boolean
  hover?: boolean
  accel?: string
  sub?: boolean
  checked?: boolean
}

/** A popup menu (PopupMenu). */
export function Popup({ items, width = 200, style }: { items: MenuItem[]; width?: number; style?: CSSProperties }) {
  const env = useEnv()
  return (
    <Part name="Popup menu" box="popup" style={{ width, display: 'grid', ...style }}>
      {items.map((it, i) => {
        if (it.separator) {
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
              <Part name="Menu separator" color="popup_separator" style={{ flex: 1, height: 1, background: env.c(colorOf('popup_separator')) }} />
              {typeof it.separator === 'string' && (
                <>
                  <Part name="Menu separator text" color="popup_separator_text" font="default">
                    {it.separator}
                  </Part>
                  <Part name="Menu separator" color="popup_separator" style={{ flex: 1, height: 1, background: env.c(colorOf('popup_separator')) }} />
                </>
              )}
            </div>
          )
        }
        return (
          <Part key={i} name={`Menu item${it.hover ? ' (under the pointer)' : it.disabled ? ' (disabled)' : ''}`} box={it.hover ? 'popup_hover' : undefined} color={it.disabled ? 'popup_disabled' : 'popup_text'} font="default" pad={it.hover ? undefined : 2} style={{ display: 'flex', gap: 10, paddingLeft: 6 }}>
            <span style={{ width: 14 }}>{it.checked ? '✓' : ''}</span>
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.accel && (
              <Part name="Menu shortcut" color="popup_accelerator" font="default">
                {it.accel}
              </Part>
            )}
            {it.sub && <span>›</span>}
          </Part>
        )
      })}
    </Part>
  )
}

export function Tooltip({ text }: { text: string }) {
  return (
    <Part name="Tooltip" box="tooltip" color="tooltip_text" font="tooltip" style={{ maxWidth: 260 }}>
      {text}
    </Part>
  )
}

/** A Cockpit launch plate (LookLaunch) with its side's colour band. */
export function Launch({ label, factionId, hover }: { label: string; factionId: string; hover?: boolean }) {
  return (
    <Part name={`Launch plate${hover ? ' (under the pointer)' : ''}`} box={hover ? 'LAUNCH_hover' : 'LAUNCH'} color="button_text" font="LAUNCH" className="key" style={{ position: 'relative', minHeight: 74, display: 'grid', placeItems: 'center', flex: 1 }}>
      <SideBox name="Side band" factionId={factionId} style={{ position: 'absolute', left: 2, top: 2, bottom: 2, width: 10 }} />
      {label}
    </Part>
  )
}
