// THE WINDOWS: every screen, window and dialog in the game
// (docs/look-window-inventory.md), each with its status and, where a look can
// reach it, a mock-up built from the kit. Names come from the pack itself.
// Drawn as the game draws them at TeeJS/faction-wars a46c63f, the WWII look
// finished (docs/ww2-look.md): every window, menu, dialog and tooltip, the
// dispatches and the head-to-head screens follow the look. The Sector window
// is the theatre plate of phase 8 (4ad04bf, look_sector.gd).
//
// Status:
//   now      the game draws it from the look
//   partly   some of it (the rest keeps its own colours; marked fixed)
//   not-yet  the game draws it in its own colours (none since phase 6)
//   never    a pack's look can never reach it; no mock-up

import type { CSSProperties, ReactNode } from 'react'
import { sectorNumber, type BoxId, type ColorId } from '@core/look/theme'
import { entryParts, entryRects, layoutTheatre, onPaper, plateOf, roomOf, sampleEntry, separateEntries, type Glyph, type Rect } from '@core/look/sector'
import {
  Check,
  Chip,
  Cmd,
  CodeWindow,
  colorOf,
  Desk,
  Dressed,
  Dialog,
  Dim,
  Divider,
  Doc,
  FixedBox,
  FixedText,
  Heading,
  Ink,
  ItemList,
  Key,
  Label,
  Launch,
  LineEdit,
  Part,
  Popup,
  Progress,
  RailItem,
  RowItem,
  Scroll,
  SideText,
  Tabs,
  Tooltip,
  Typed,
  VRule,
  Win,
  rgb,
  useChoice,
  useEnv,
  type Env
} from './kit'

export type Status = 'now' | 'partly' | 'not-yet' | 'never'

export interface WindowEntry {
  id: string
  name: string
  status: Status
  /** What the band over a mock-up says, beyond its status. */
  note?: string
  /** For `never`: why a look cannot reach it. */
  why?: string
  /** The drawing's size in game pixels (1440 x 850 is the whole screen). */
  size?: [number, number]
  Mock?: () => ReactNode
  /** A choice the stage offers above the mock-up (the Sector window's theatre); the mock-up reads it with useChoice. */
  choice?: { label: string; options: (env: Env) => { id: string; label: string }[] }
  /** The drawing's size for a choice, where it depends on one. */
  sizeOf?: (env: Env, choice: string | null) => [number, number]
}

// ---------------------------------------------------------------------------
// Fixed colours (Godot's named colours and the scenes' literals)
// ---------------------------------------------------------------------------

const GODOT = {
  WHITE: '#ffffff',
  GRAY: '#bebebe',
  DARK_GRAY: '#a9a9a9',
  LIGHT_GRAY: '#d3d3d3',
  RED: '#ff0000',
  LIGHT_GREEN: '#90ee90',
  LIME_GREEN: '#32cd32',
  GOLD: '#ffd700',
  GOLDENROD: '#daa520',
  INDIAN_RED: '#cd5c5c',
  ORANGE: '#ffa500',
  CYAN: '#00ffff'
}
const FIELD_KEY = rgb(0.6, 0.7, 0.8)
const PICTURE = rgb(0.08, 0.1, 0.14)
const PORTRAIT = rgb(0.2, 0.2, 0.2)
const SUBJECT = rgb(0.6, 0.9, 0.6)

const N = {
  literal: "The window's own colour, which the window dress's tables (look_window.gd BG_MAP, TEXT_MAP) do not list: kept as the window drew it.",
  status: 'A colour with a meaning (ready, damaged, blocked) the window picks itself: the look leaves it as drawn.',
  faction: "The side's own colour from factions.json, as the map shows it. A look's `sides` colour is for the chrome and for a side's name as text.",
  picture: "A picture's frame, written into the scene.",
  textEdit: "Godot's own text box: look.gd does not style TextEdit.",
  map: "The pack's map picture (pack.json map_image).",
  drawn: 'Drawn by the window itself in its own colours: the window dress does not reach it.'
}

const DRESS =
  'Dressed by the game’s window hook (LookWindow.Install): the steel frame and title bar, the look’s controls inside, and the window’s own colours traded for the look’s (look_window.gd BG_MAP, EDGE_MAP, TEXT_MAP). Colours with a meaning, such as damage red, ready green and gold, are kept.'
const CODE =
  'Built in code without the scene template’s title bar, so the hook gives it the look’s theme and trades its own colours: its frame and title are its script’s, in the look’s tokens where the dress’s tables list them and as drawn where they do not.'
const SHEET =
  'Dressed from Look.InstallPopups: a dialog is an order sheet (Look.SheetTheme). The frame and title stay steel, the body is parchment with its words in ink, OK and Cancel are command keys, and a modal one sits over the dim.'
const POPUPS = 'Dressed from Look.InstallPopups: a popup menu is an instrument panel, a tooltip a field note.'
const SCREEN =
  'A head-to-head screen (LookWindow.DressScreen): its title in the display face, its dialog a steel panel, the bottom bar’s keys command keys, and its own colours traded for the look’s.'
const DISPATCH =
  'The Message Index as dispatches (look_dispatch.gd): a ruled ledger with each category’s stamp, and the open message as a parchment dispatch. The words come from look.json `messages` (set on the Faces, sizes and corners tab); an empty category shows the pack’s `no_messages` term.'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' }
const col: CSSProperties = { display: 'grid', gap: 6, alignContent: 'start' }

function pick<T>(list: readonly T[], i: number): T {
  return list[i % list.length]
}

function sides(env: Env) {
  const f = env.pack.factions
  const a = f[0] ?? { id: 'a', name: 'Side A', shortName: 'Side A', color: '#d22a2a' }
  const b = f[1] ?? { id: 'b', name: 'Side B', shortName: 'Side B', color: '#2a62d2' }
  return [a, b] as const
}

function Field({ k, v, keyColor = FIELD_KEY }: { k: string; v: ReactNode; keyColor?: string }) {
  return (
    <>
      <FixedText color={keyColor} note={N.literal}>
        {k}
      </FixedText>
      <Label>{v}</Label>
    </>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'baseline' }}>{children}</div>
}

function Picture({ w, h, color = PICTURE, text }: { w: number; h: number; color?: string; text?: string }) {
  return (
    <FixedBox name="Picture area" color={color} note={N.picture} scene style={{ width: w, height: h, display: 'grid', placeItems: 'center', flex: 'none' }}>
      {text && (
        <FixedText color={rgb(0.4, 0.4, 0.4)} note={N.literal}>
          {text}
        </FixedText>
      )}
    </FixedBox>
  )
}

function FactionText({ env, i, children }: { env: Env; i: number; children: ReactNode }) {
  const s = sides(env)[i]
  return (
    <FixedText color={s.color} note={N.faction}>
      {children}
    </FixedText>
  )
}

const CATEGORIES = ['Loyalty', 'Fleets', 'Missions', 'Resources', 'Manufacturing', 'Defense', 'Conflict', 'Chat', 'Advice']

// ---------------------------------------------------------------------------
// Follows the look now
// ---------------------------------------------------------------------------

function Cockpit() {
  const env = useEnv()
  const [a, b] = sides(env)
  const { subtitle, mapRect, caption } = env.dossier
  const map = env.tex('__map')
  let mapStyle: CSSProperties = {}
  if (map) {
    if (mapRect && mapRect.length === 4 && mapRect[2] > 0 && mapRect[3] > 0) {
      const [x, y, w, h] = mapRect
      mapStyle = {
        backgroundImage: `url(${map.url})`,
        backgroundSize: `${(map.width / w) * 100}% auto`,
        backgroundPosition: `${map.width > w ? (x / (map.width - w)) * 100 : 0}% ${map.height > h ? (y / (map.height - h)) * 100 : 0}%`
      }
    } else mapStyle = { backgroundImage: `url(${map.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return (
    <Desk style={{ width: 1440, height: 850, padding: '24px 44px 20px', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}>
      <Part name="Heading" color="HEADING" font="cockpit_title" style={{ textTransform: 'uppercase' }}>
        New Game
      </Part>
      <Divider />
      <div style={{ display: 'flex', gap: 22, flex: 1, minHeight: 0 }}>
        <Doc name="Dossier" style={{ flex: 1.55, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {subtitle && <Typed>{subtitle.toUpperCase()}</Typed>}
          <Part name="Campaign name" color="campaign_name" font="campaign_name" style={{ lineHeight: 1.1 }}>
            {env.pack.name.toUpperCase()}
          </Part>
          <Divider />
          {env.pack.summary && <Ink>{env.pack.summary}</Ink>}
          {map && (
            <Part name="Map plate" box="map_plate" style={{ flex: 1, minHeight: 150, overflow: 'hidden', display: 'grid' }}>
              <FixedBox name="Map picture" color="transparent" note={N.map} style={{ ...mapStyle, minHeight: 150 }} />
            </Part>
          )}
          {map && caption && (
            <Part name="Map caption" color="map_caption" font="map_caption">
              {caption}
            </Part>
          )}
        </Doc>
        <Part name="Orders panel" box="PANEL" style={{ flex: 1, alignSelf: 'flex-start', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Part name="Heading" color="HEADING" font="cockpit_label" style={{ textTransform: 'uppercase' }}>
            Select Difficulty
          </Part>
          <div style={row}>
            {['Easy', 'Medium', 'Hard'].map((l, i) => (
              <Cmd key={l} label={l} state={i === 1 ? 'pressed' : 'normal'} style={{ flex: 1, minHeight: 40, textAlign: 'center' }} />
            ))}
          </div>
          <Part name="Heading" color="HEADING" font="cockpit_label" style={{ textTransform: 'uppercase' }}>
            {env.pack.samples.terms.galaxy_size ?? 'Galaxy Size'}
          </Part>
          <div style={row}>
            {['Small', 'Medium', 'Large'].map((l, i) => (
              <Cmd key={l} label={l} state={i === 2 ? 'pressed' : i === 0 ? 'hover' : 'normal'} style={{ flex: 1, minHeight: 40, textAlign: 'center' }} />
            ))}
          </div>
          <Part name="Heading" color="HEADING" font="cockpit_label" style={{ textTransform: 'uppercase' }}>
            Game Options
          </Part>
          <Check label="Headquarters Only Victory" lookIcon />
          <Check label="Provide feedback" checked lookIcon />
          <Check label="Reduce motion" lookIcon hover />
        </Part>
      </div>
      <Part name="Heading" color="HEADING" font="cockpit_label" style={{ textTransform: 'uppercase' }}>
        Select Faction to Begin
      </Part>
      <div style={{ display: 'flex', gap: 22 }}>
        <Launch label={`LAUNCH AS ${a.name.toUpperCase()}`} factionId={a.id} />
        <Launch label={`LAUNCH AS ${b.name.toUpperCase()}`} factionId={b.id} hover />
      </div>
      <Divider />
      <div style={row}>
        <Cmd label="Load Game" style={{ minWidth: 150, minHeight: 40 }} />
        <Cmd label="Multiplayer" style={{ minWidth: 150, minHeight: 40 }} />
        <Cmd label="View Credits" state="focus" style={{ minWidth: 150, minHeight: 40 }} />
        <span style={{ flex: 1 }} />
        <Part name="Build version" color="cockpit_version" font="default">
          v0.0.0
        </Part>
        <Cmd label="Exit to Faction Picker" style={{ minWidth: 150, minHeight: 40 }} />
      </div>
    </Desk>
  )
}

function Credits() {
  const env = useEnv()
  const p = env.pack
  const assets = p.assetCredits.slice(0, 3)
  return (
    <Desk style={{ width: 1440, height: 850, position: 'relative' }}>
      <Dim>
        <Doc name="Credits sheet" style={{ width: 880, display: 'grid', gap: 8 }}>
          <Typed>CREDITS</Typed>
          <Part name="Credits title" color="credits_title" font="credits_title">
            {p.name.toUpperCase()}
          </Part>
          <Divider />
          <div style={{ maxHeight: 540, overflow: 'hidden', display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 4 }}>
              {p.credits.length ? (
                p.credits.slice(0, 4).map((l, i) => (
                  <Part key={i} name="Credit line" color="credits_line" font="credits_body">
                    {l}
                  </Part>
                ))
              ) : (
                <Part name="No credits" color="credits_changes" font="credits_body">
                  (this pack declares no credits)
                </Part>
              )}
            </div>
            <Divider />
            <Part name="Section heading" color="credits_section" font="credits_section">
              ARTWORK AND FONTS
            </Part>
            {(assets.length ? assets : [{ title: 'A picture', what: 'The strategic map', author: 'Its author', licence: 'CC0 1.0', source: 'https://example.org/', changes: 'Cropped.' }]).map((a, i) => (
              <div key={i} style={{ display: 'grid', gap: 2 }}>
                <div style={row}>
                  <Part name="Asset title" color="credits_asset" font="credits_asset">
                    {a.title}
                  </Part>
                  {a.what && (
                    <Part name="What it is" color="credits_what" font="credits_body">
                      ·  {a.what}
                    </Part>
                  )}
                </div>
                <Part name="Credit line" color="credits_line" font="credits_body">
                  {a.author}
                </Part>
                <Part name="Credit line" color="credits_line" font="credits_body">
                  Licence: {a.licence}
                </Part>
                {a.source && (
                  <div style={row}>
                    <Part name="Credit line" color="credits_line" font="credits_body">
                      Source:
                    </Part>
                    <LineEdit value={a.source} readOnly style={{ flex: 1 }} />
                    <Cmd label="Copy" style={{ minWidth: 70 }} />
                  </div>
                )}
                {a.changes && (
                  <Part name="Changes" color="credits_changes" font="credits_body">
                    Changes: {a.changes}
                  </Part>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Cmd label="Close" style={{ minWidth: 130, minHeight: 40, textAlign: 'center' }} />
          </div>
        </Doc>
      </Dim>
    </Desk>
  )
}

function MapScreen() {
  const env = useEnv()
  const [a] = sides(env)
  const S = env.pack.samples
  const map = env.tex('__map')
  const pic = { left: 222, top: 50, width: 1060, height: 700 }
  return (
    <div style={{ width: 1440, height: 850, position: 'relative', overflow: 'hidden' }}>
      <Desk style={{ position: 'absolute', inset: 0 }} />
      {/* The map, its bezel, names and flares. */}
      <FixedBox
        name="Map picture"
        color={map ? 'transparent' : '#0b0b12'}
        note={N.map}
        style={{ position: 'absolute', ...pic, backgroundImage: map ? `url(${map.url})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <Part name="Map bezel (outer)" color="bezel_outer" style={{ position: 'absolute', left: pic.left - 4, top: pic.top - 4, width: pic.width + 8, height: pic.height + 8, border: `1px solid ${env.c('brass_dim')}`, boxSizing: 'border-box' }} />
      <Part name="Map bezel (inner)" color="bezel_inner" style={{ position: 'absolute', left: pic.left - 2, top: pic.top - 2, width: pic.width + 4, height: pic.height + 4, border: `2px solid ${env.c('chassis_deep')}`, boxSizing: 'border-box' }} />
      <Part name="Map bezel (line)" color="bezel_line" style={{ position: 'absolute', left: pic.left, top: pic.top, width: pic.width, height: pic.height, border: `1px solid ${env.c('ink')}b3`, boxSizing: 'border-box' }} />
      {S.sectors.slice(0, 6).map((s, i) => (
        <Part
          key={i}
          name="Sector name on the map"
          color="map_name"
          font="map_name"
          extra={['paper']}
          style={{ position: 'absolute', left: pic.left + 90 + (i % 3) * 330, top: pic.top + 140 + Math.floor(i / 3) * 260, fontSize: 15, textShadow: [-1, 1].flatMap((x) => [-1, 1].map((y) => `${x}px ${y}px 0 ${env.c('paper')}`)).join(', ') }}
        >
          {s}
        </Part>
      ))}
      {[0, 1, 2].map((i) => (
        <Part key={i} name="GID flare rim" color="flare_rim" style={{ position: 'absolute', left: pic.left + 200 + i * 290, top: pic.top + 330 + (i % 2) * 90, fontWeight: 700, color: env.c('paper'), textShadow: `0 0 2px ${env.c('ink')}` }}>
          +
        </Part>
      ))}
      <SideText factionId={a.id} name="Map mode name (the side's colour)" style={{ position: 'absolute', left: 0, right: 0, top: 58, textAlign: 'center', fontSize: 22, ...env.face('display') }}>
        Galaxy Display
      </SideText>

      {/* The top strip. */}
      <Part name="Day and speed chip" box="hud_chip" style={{ position: 'absolute', left: 4, top: 4, width: 208, height: 36, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Part name="Day" color="label" font="hud_day">
          Day 118
        </Part>
        <Part name="Speed" color="hud_speed" font="hud_speed" style={{ textTransform: 'uppercase' }}>
          Slow
        </Part>
      </Part>
      <Part name="Operations strip" box="hud_strip" style={{ position: 'absolute', left: 216, top: 4, width: 1070, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12 }}>
        {['Materials 1,240', 'Refined 318', 'Upkeep 96 / 140'].map((r, i) => (
          <div key={r} style={row}>
            {i > 0 && <VRule height={30} />}
            <Part name="Readout" color="hud_readout" font="hud_readout">
              {r}
            </Part>
          </div>
        ))}
      </Part>
      <Part name="Paused speed chip (while paused)" box="hud_chip_paused" color="label" font="hud_speed" style={{ position: 'absolute', left: 4, top: 800, width: 120, textTransform: 'uppercase', display: 'none' }}>
        Paused
      </Part>

      {/* The dispatch rail. */}
      <Part name="Dispatch rail panel" box="PANEL" style={{ position: 'absolute', left: 4, top: 46, width: 208, padding: 6, display: 'grid', gap: 4 }}>
        <RailItem label="All Messages" state="pressed" count={5} />
        {CATEGORIES.map((c, i) => (
          <RailItem key={c} label={c} state={i === 2 ? 'hover' : 'normal'} count={i === 1 ? 2 : i === 6 ? 1 : undefined} />
        ))}
      </Part>
      <div style={{ position: 'absolute', left: 4, top: 560, width: 208, display: 'grid', gap: 6 }}>
        <Key label="Map Key" />
        <Part name="Feedback box" box="panel" style={{ display: 'grid', gap: 4 }}>
          <FixedText color={FIELD_KEY} note={N.literal}>
            Feedback ▾
          </FixedText>
          <FixedBox name="Text box" color="#1d1d1d" note={N.textEdit} style={{ height: 40 }} />
          <Key label="Submit" />
        </Part>
      </div>

      {/* The map key. */}
      <Part name="Map key" box="gid_key" style={{ position: 'absolute', left: 236, top: 520, width: 230, display: 'grid', gap: 4 }}>
        <Part name="Map key title" color="gid_key_title" font="gid_key_title" style={{ fontSize: env.size('body') }}>
          Map Key
        </Part>
        {['Tier 1', 'Tier 2', 'Tier 3'].map((t) => (
          <Part key={t} name="Map key row" color="gid_key_row" font="default">
            ◆ {t}
          </Part>
        ))}
        <Divider />
        {env.pack.factions.map((f) => (
          <div key={f.id} style={row}>
            <FixedBox name="Faction swatch" color={f.color} note={N.faction} style={{ width: 12, height: 12 }} />
            <Part name="Map key row" color="gid_key_row" font="default">
              {f.name}
            </Part>
          </div>
        ))}
      </Part>

      {/* The theatre directory. */}
      <Part name="Theatre directory" box="PANEL" style={{ position: 'absolute', left: 1290, top: 46, width: 146, padding: 6, display: 'grid', gap: 0 }}>
        {S.sectors.slice(0, 8).map((s, i) => (
          <RowItem key={i} label={s} state={i === 1 ? 'pressed' : i === 4 ? 'hover' : 'normal'} style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden' }} />
        ))}
      </Part>

      {/* The mode bar and the console. */}
      <Part name="GID bar" box="gid_bar" style={{ position: 'absolute', left: 2, top: 764, width: 1287, display: 'flex', gap: 6 }}>
        {['Status', 'Resources', 'Defense', 'Missions', 'Fleets', 'Support'].map((k, i) => (
          <Cmd key={k} label={k} state={i === 0 ? 'pressed' : 'normal'} />
        ))}
        <Cmd label="Display Off" />
      </Part>
      <Part name="Console" box="hud_console" style={{ position: 'absolute', left: 2, top: 812, width: 1287, height: 38, display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        {['Menu', `${env.pack.samples.terms.system ?? 'System'} Finder`, 'Fleet Finder', 'Troop Finder', 'Personnel Finder'].map((k, i) => (
          <Cmd key={k} label={k} state={i === 1 ? 'hover' : 'normal'} />
        ))}
        <VRule height={30} />
        <Cmd label="Agent" />
        <VRule height={30} />
        <Cmd label="Encyclopedia" />
      </Part>
    </div>
  )
}

function LoadGame() {
  const S = useEnv().pack.samples
  return (
    <Desk style={{ width: 760, height: 520, display: 'grid', placeItems: 'center' }}>
      <Dressed>
      <Part name="Window body" box="panel" style={{ width: 520, display: 'grid', gap: 8, padding: 14 }}>
        <Label style={{ fontSize: 20 }}>Load Game</Label>
        {[3, 41, 118].map((d, i) => (
          <div key={d} style={row}>
            <Label style={{ flex: 1 }}>
              {pick(S.sectors, i)} campaign (Day {d})
            </Label>
            <Key label="Load" state={i === 1 ? 'hover' : 'normal'} />
          </div>
        ))}
        <FixedText color={rgb(0.6, 0.6, 0.6)} note={N.literal}>
          (older saves are in Manage Games)
        </FixedText>
        <div style={row}>
          <Key label="Import Game" />
          <Key label="Manage Games" />
          <span style={{ flex: 1 }} />
          <Key label="Cancel" />
        </div>
      </Part>
      </Dressed>
    </Desk>
  )
}

// ---------------------------------------------------------------------------
// Not in the game yet: the windows
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The sector window as a theatre plate (look_sector.gd, phase 8)
// ---------------------------------------------------------------------------

const PLATE_NOTE = {
  side: "The holder's colour from factions.json: the plate keeps the sides' map colours, as the strategic map does (the look's side colours are for the chrome).",
  neutral: "pack.json's neutral colour: the window tinted this unheld system's icon with it.",
  uprising: "The window's own uprising tint (sector_window.gd CUprising), kept.",
  picture: 'A picture, not a colour.'
}

/** Stand-ins for the engine's corner glyphs (assets/icons, which the editor cannot copy): 16 x 16, drawn in the glyph's colour. */
const GLYPH_PATHS: Record<Glyph, string> = {
  manufacturing: 'M1 15V7l4 2.5V7l4 2.5V2h3v13z',
  fleet: 'M8 1l6 13-6-3.5L2 14z',
  defenses: 'M4 15V6H3V2h2v1.5h1.5V2h3v1.5H11V2h2v4h-1v9z',
  mission: 'M3 15V1h1.5v1H13l-2.5 3.5L13 9H4.5v6z',
  uprising: 'M8 1c.5 3 4.5 4.5 4.5 8.5a4.5 4.5 0 0 1-9 0c0-2 1-3.5 2.5-4.5 0 2 .8 3 2 3.2C7.4 6 6.8 3.8 8 1z'
}

let measureCanvas: HTMLCanvasElement | null = null
/** A name's size in the window's face (Label min size): its width, and the face's line height. */
function nameSize(text: string, face: CSSProperties, size: number): { w: number; h: number } {
  const ctx = (measureCanvas ??= document.createElement('canvas')).getContext('2d')
  if (!ctx) return { w: text.length * size * 0.55, h: Math.ceil(size * 1.35) }
  ctx.font = `${face.fontWeight ?? 400} ${size}px ${face.fontFamily ?? 'sans-serif'}`
  return { w: Math.ceil(ctx.measureText(text).width), h: Math.ceil(size * 1.35) }
}

const withAlpha = (hex: string, a: number) => `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`
const at = (r: Rect): CSSProperties => ({ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, boxSizing: 'border-box' })
const SN = sectorNumber

/** The theatre to draw, its layout and plate, and every system's entry where the window leaves it. */
function sectorScene(env: Env, choice: string | null) {
  const data = env.pack.sector
  const t = data.theatres.find((x) => x.id === choice) ?? data.theatres[0]
  if (!t) return null
  const layout = layoutTheatre(t)
  const detail = env.tex('map_detail')
  const map = env.tex('__map')
  const plate = plateOf(layout, {
    detail,
    map,
    mapRect: data.mapRect,
    insets: env.insets.map((i) => ({ picture: i.tex, at: { x: i.at[0], y: i.at[1], w: i.at[2], h: i.at[3] } }))
  })
  const face = env.face('body')
  const states = t.systems.map((_, i) => sampleEntry(t, i, data))
  const entries = t.systems.map((s, i) => entryParts(layout.places[i], states[i], nameSize(s.name, face, SN('NAME_SIZE')), data.loyaltyOrder))
  const moves = separateEntries(entries.map(entryRects), roomOf(layout))
  return { t, layout, plate, detail, map, states, entries, moves }
}

function SectorWindow() {
  const env = useEnv()
  const scene = sectorScene(env, useChoice())
  if (!scene)
    return (
      <Win title="Sector" width={600}>
        <Label>This pack’s map.json has no theatre with a system in it.</Label>
      </Win>
    )
  const { t, layout, plate } = scene
  const data = env.pack.sector
  const paper = env.c(colorOf('plate_paper'))
  const ink = env.c(colorOf('mark_rim'))
  const sideColor = (id: string | null) => (id ? data.colors[id] || data.neutral : data.neutral)
  const cut = plate.cut
  const picture = cut ? (cut.from === 'detail' ? scene.detail : cut.from === 'map' ? scene.map : env.insets[cut.from].tex) : null
  const zoom = plate.zoom === null ? '' : ` Magnified ${plate.zoom.toFixed(1)}×; the game uses the plain sheet above ${SN('SHARP_ZOOM')}×.`
  const pictureName = !cut
    ? ''
    : cut.from === 'detail'
      ? 'The theatre, cut from the map’s detail copy (look.json textures.map_detail)'
      : cut.from === 'map'
        ? 'The theatre, cut from the pack’s map picture (pack.json map_image)'
        : `The theatre, cut from map inset ${cut.from + 1} (${env.insets[cut.from].file})`
  const grid = SN('GRID')
  const gridInk = withAlpha(env.c(colorOf('plate_grid')), SN('GRID_ALPHA'))
  return (
    <Win title={t.name} width={layout.w + 2} bodyPad={0}>
      <div data-plate={plate.kind} data-plate-from={cut ? String(cut.from) : ''} style={{ position: 'relative', width: layout.w, height: layout.h, overflow: 'hidden' }}>
        <Part name="Plate: the paper under it" color="plate_paper" style={{ position: 'absolute', inset: 0, background: paper }} />
        {cut && picture ? (
          <>
            <Part
              name={pictureName}
              tex={cut.from === 'detail' ? 'map_detail' : undefined}
              fixed={{ color: 'transparent', note: PLATE_NOTE.picture + zoom }}
              style={{
                ...at(cut.at),
                backgroundImage: `url(${picture.url})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${(picture.width * cut.at.w) / cut.region.w}px ${(picture.height * cut.at.h) / cut.region.h}px`,
                backgroundPosition: `${(-cut.region.x * cut.at.w) / cut.region.w}px ${(-cut.region.y * cut.at.h) / cut.region.h}px`
              }}
            />
            <Part name="Parchment wash over the map" color="plate_wash" style={{ position: 'absolute', inset: 0, background: withAlpha(paper, SN('WASH')) }} />
          </>
        ) : (
          <Part
            name="Plotting sheet (no picture holds this theatre sharply)"
            color="plate_grid"
            title={zoom.trim() || undefined}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${grid - 1}px, ${gridInk} ${grid - 1}px ${grid}px), repeating-linear-gradient(to bottom, transparent 0 ${grid - 1}px, ${gridInk} ${grid - 1}px ${grid}px)`
            }}
          />
        )}
        <Part name="Plate frame" box="plate_frame" style={{ position: 'absolute', inset: 0 }} />
        {t.systems.map((s, i) => {
          const p = scene.entries[i]
          const st = scene.states[i]
          const move = scene.moves[i]
          const held = s.holder !== null
          const hq = data.hiddenHq === s.id && s.holder === data.viewer
          const color = sideColor(s.holder)
          const rim = hq ? SN('HQ_RIM') : SN('RIM')
          return (
            <div key={s.id || i} data-system={s.name} style={{ position: 'absolute', left: move.x, top: move.y }}>
              {p.star && (
                <Part
                  name="GID star (the map's cross, rimmed in ink)"
                  color="star_rim"
                  fixed={{ color, note: held ? PLATE_NOTE.side : PLATE_NOTE.neutral }}
                  style={{ ...at(p.star.rect), display: 'grid', placeItems: 'center', fontSize: p.star.size, lineHeight: 1, color, WebkitTextStroke: `${SN('RIM') + 1}px ${ink}`, paintOrder: 'stroke fill', ...env.face('body') }}
                >
                  +
                </Part>
              )}
              {held ? (
                <Part
                  name={hq ? "System (its holder's map colour; the headquarters ring in brass)" : "System (its holder's map colour, rimmed in ink)"}
                  color={hq ? 'mark_hq' : 'mark_rim'}
                  fixed={{ color, note: PLATE_NOTE.side }}
                  style={{ ...at(p.disc), borderRadius: '50%', background: color, border: `${rim}px solid ${env.c(colorOf(hq ? 'mark_hq' : 'mark_rim'))}` }}
                />
              ) : (
                <Part name="System (unheld: an ink ring on the paper)" color="mark_unheld" extra={['ink']} style={{ ...at(p.disc), borderRadius: '50%', background: paper, border: `${rim}px solid ${ink}` }} />
              )}
              {p.corners.map((c) => {
                const tint = c.glyph === 'uprising' ? rgb(1, 0.55, 0.12) : c.glyph === 'mission' ? sideColor(data.viewer) : c.glyph === 'fleet' && !held ? sideColor(data.viewer) : color
                const own = env.icon(c.glyph)
                const glyphColor = env.c(colorOf(c.glyph === 'uprising' ? 'corner_uprising' : 'corner_glyph'))
                return (
                  <Part
                    key={c.slot}
                    name={`Corner icon: ${c.glyph} (${c.glyph === 'uprising' ? 'signal red' : 'ink'} on a paper tab edged in its tint)`}
                    box="corner_tab"
                    color={c.glyph === 'uprising' ? 'corner_uprising' : 'corner_glyph'}
                    fixed={{ color: tint, note: c.glyph === 'uprising' ? PLATE_NOTE.uprising : tint === data.neutral ? PLATE_NOTE.neutral : PLATE_NOTE.side }}
                    style={{ ...at(c.rect), border: `${SN('TAB_EDGE')}px solid ${tint}`, padding: 0, display: 'grid', placeItems: 'center' }}
                  >
                    {own ? (
                      <span style={{ width: '100%', height: '100%', background: glyphColor, maskImage: `url(${own.url})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                    ) : (
                      <svg viewBox="0 0 16 16" width="100%" height="100%" aria-hidden="true">
                        <path d={GLYPH_PATHS[c.glyph]} fill={glyphColor} />
                      </svg>
                    )}
                  </Part>
                )
              })}
              {p.rows.map((r) => (
                <div key={r.kind} style={at(r.rect)}>
                  {Array.from({ length: r.total }, (_, k) => {
                    const on = k < Math.min(r.filled, r.total)
                    const id = on ? (r.kind === 'energy' ? 'bar_energy' : 'bar_mines') : 'bar_free'
                    return (
                      <Part
                        key={k}
                        name={`${r.kind === 'energy' ? 'Energy' : 'Raw materials'} square (${on ? (r.kind === 'energy' ? 'used' : 'built') : 'free'})`}
                        color={id}
                        extra={['ink']}
                        style={{
                          position: 'absolute',
                          left: k * (SN('SQUARE') + SN('SQUARE_GAP')),
                          top: 0,
                          width: SN('SQUARE'),
                          height: SN('SQUARE'),
                          boxSizing: 'border-box',
                          background: env.c(colorOf(id)),
                          border: `1px solid ${env.c(colorOf('bar_edge'))}`,
                          borderRadius: SN('BAR_RADIUS')
                        }}
                      />
                    )
                  })}
                </div>
              ))}
              {p.loyalty && (
                <div style={at(p.loyalty.rect)}>
                  {p.loyalty.segs.map((g) => {
                    const r = SN('BAR_RADIUS')
                    return (
                      <Part
                        key={g.side}
                        name={`Loyalty bar: ${env.pack.factions.find((f) => f.id === g.side)?.name ?? g.side} ${st.support?.[g.side] ?? 0}%`}
                        color="bar_edge"
                        fixed={{ color: sideColor(g.side), note: PLATE_NOTE.side }}
                        style={{
                          position: 'absolute',
                          left: g.x,
                          top: 0,
                          width: g.w,
                          height: '100%',
                          boxSizing: 'border-box',
                          background: sideColor(g.side),
                          border: `1px solid ${env.c(colorOf('bar_edge'))}`,
                          borderRadius: `${g.first ? r : 0}px ${g.last ? r : 0}px ${g.last ? r : 0}px ${g.first ? r : 0}px`
                        }}
                      />
                    )
                  })}
                </div>
              )}
              <Part
                name={held ? "System name (its holder's colour, darkened to read on the paper)" : 'System name (ink: no side holds it)'}
                color={held ? 'name_on_paper' : 'name_unheld'}
                font="sector_name"
                extra={['paper']}
                fixed={held ? { color: onPaper(color, paper), note: PLATE_NOTE.side } : undefined}
                style={{
                  ...at(p.name),
                  fontSize: SN('NAME_SIZE'),
                  lineHeight: `${p.name.h}px`,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  color: held ? onPaper(color, paper) : env.c(colorOf('name_unheld')),
                  WebkitTextStroke: `${SN('HALO')}px ${env.c(colorOf('name_halo'))}`,
                  paintOrder: 'stroke fill'
                }}
              >
                {s.name}
              </Part>
            </div>
          )
        })}
      </div>
    </Win>
  )
}

function PlanetData() {
  const env = useEnv()
  const S = env.pack.samples
  const [a] = sides(env)
  return (
    <Win title={S.planets[0].name} width={440}>
      <Tabs tabs={[{ label: 'Information', state: 'selected' }]}>
        <div style={row}>
          <Picture w={96} h={96} />
          <div style={col}>
            <Label style={{ fontSize: 18 }}>{S.planets[0].name}</Label>
            <Label>
              Controlled by <FactionText env={env} i={0}>{a.name}</FactionText>
            </Label>
            <Label>Energy 6 · Raw materials 4</Label>
          </div>
        </div>
        <ItemList items={S.facilities.slice(0, 4).map((f, i) => ({ label: f, state: i === 0 ? 'selected' : 'normal' }))} style={{ height: 110 }} />
      </Tabs>
    </Win>
  )
}

function Manufacturing() {
  const S = useEnv().pack.samples
  return (
    <Win title={`Manufacturing at ${S.planets[0].name}`} width={660}>
      <Tabs tabs={['Manufacturing', 'Shipyards', 'Training Facilities', 'Construction Yards', 'Refineries', 'Mines'].map((l, i) => ({ label: l, state: i === 0 ? 'selected' : i === 2 ? 'hover' : 'normal' }))}>
        {[0, 1, 2].map((q) => (
          <div key={q} style={col}>
            <FixedBox name="Queue header" color={rgb(0.2, 0.6, 0.2)} note={N.literal} scene style={{ padding: '2px 8px', display: 'flex' }}>
              <FixedText color={GODOT.WHITE} note={N.literal} style={{ flex: 1 }}>
                {pick(S.facilities, q)}
              </FixedText>
              <FixedText color={GODOT.WHITE} note={N.literal}>
                {q + 1}:2
              </FixedText>
            </FixedBox>
            <Label>
              {pick(S.units, q).name} — 12 days
            </Label>
            <FixedText color={rgb(0.5, 0.7, 1)} note={N.literal}>
              To: {pick(S.planets, q + 1).name}
            </FixedText>
          </div>
        ))}
        <ItemList
          items={[
            { label: `${S.facilities[0]} — idle`, fixed: { color: GODOT.GRAY, note: N.status } },
            { label: `${pick(S.facilities, 1)} — building`, fixed: { color: GODOT.LIGHT_GREEN, note: N.status }, state: 'selected' },
            { label: `${pick(S.facilities, 2)} — blockaded`, fixed: { color: GODOT.RED, note: N.status } }
          ]}
          style={{ height: 90 }}
        />
      </Tabs>
    </Win>
  )
}

function Defenses() {
  const env = useEnv()
  const S = env.pack.samples
  return (
    <Win title={`Defenses at ${S.planets[1 % S.planets.length].name}`} width={560}>
      <Tabs tabs={['Personnel', 'Troops', 'Fighters', 'Planetary Shield', 'Planetary Battery'].map((l, i) => ({ label: l, state: i === 0 ? 'selected' : 'normal' }))}>
        <FixedText color={GODOT.GOLDENROD} note={N.literal}>
          Personnel on the planet
        </FixedText>
        <ItemList
          items={S.characters.slice(0, 4).map((c, i) => ({
            label: c.name,
            state: i === 1 ? 'selected' : 'normal',
            fixed: { color: pick(sides(env), i).color, note: N.faction }
          }))}
          style={{ height: 110 }}
        />
        <FixedText color={GODOT.LIGHT_GREEN} note={N.status}>
          Garrison: 3 of 2 needed
        </FixedText>
      </Tabs>
    </Win>
  )
}

function FleetWindow() {
  const env = useEnv()
  const S = env.pack.samples
  return (
    <Win title={S.terms.system_fleets ?? 'System Fleets'} width={640}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 10 }}>
        <div style={col}>
          <Label>{S.terms.fleets_here ?? 'Fleets in System'}</Label>
          <ItemList
            items={['Fleet 1', 'Fleet 2', 'Fleet 3 (en route)'].map((l, i) => ({ label: l, state: i === 0 ? 'selected' : 'normal', fixed: i === 2 ? { color: GODOT.DARK_GRAY, note: N.status } : { color: sides(env)[0].color, note: N.faction } }))}
            style={{ height: 200 }}
          />
        </div>
        <div style={col}>
          <Label style={{ fontSize: 18 }}>Fleet 1</Label>
          <Tabs tabs={[S.terms.capital_ships ?? 'Capital Ships', 'Fighters', 'Troops', 'Personnel'].map((l, i) => ({ label: l, state: i === 0 ? 'selected' : 'normal' }))}>
            <ItemList items={S.units.slice(0, 4).map((u, i) => ({ label: u.name, state: i === 0 ? 'hover' : 'normal' }))} style={{ height: 120 }} />
          </Tabs>
        </div>
      </div>
    </Win>
  )
}

function Missions() {
  const S = useEnv().pack.samples
  return (
    <Win title={`Missions at ${S.planets[0].name}`} width={580}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 10 }}>
        <div style={col}>
          <ItemList items={S.missions.slice(0, 3).map((m, i) => ({ label: m, state: i === 0 ? 'selected' : 'normal' }))} style={{ height: 120 }} />
          <Picture w={220} h={70} color={PORTRAIT} />
        </div>
        <div style={col}>
          <Label>Target</Label>
          <div style={row}>
            <Picture w={40} h={40} color={rgb(0.3, 0.4, 0.5)} />
            <Label>{S.planets[1 % S.planets.length].name}</Label>
          </div>
          <Tabs tabs={[{ label: 'Operatives', state: 'selected' }, { label: 'Decoys' }]}>
            <ItemList items={S.characters.slice(0, 2).map((c) => ({ label: c.name }))} style={{ height: 60 }} />
          </Tabs>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Key label="Abort" />
          </div>
        </div>
      </div>
    </Win>
  )
}

// ---------------------------------------------------------------------------
// The Message Index as dispatches (look_dispatch.gd)
// ---------------------------------------------------------------------------

interface Dispatch {
  title: string
  category: string
  /** The theatre, on a row; the world and theatre, on the dispatch ("" for none). */
  place: string
  full: string
  day: number
  read: boolean
  body: string
}

/** The capture script's four messages (tests/capture_look.gd), in the pack's names. */
function dispatches(env: Env): Dispatch[] {
  const S = env.pack.samples
  const home = S.planets[0]
  // A commander, not a head of state, reports (as the capture script picks).
  const mine = S.characters.filter((c) => c.faction === sides(env)[0].id)
  const who = mine.find((c) => !c.major) ?? mine[0] ?? S.characters[0]
  const at = { place: home.sector, full: `${home.name}, ${home.sector}` }
  return [
    { title: 'Supply convoy arrived', category: 'Resources', place: '', full: '', day: 12, read: true, body: 'Raw materials delivered to the depot.' },
    { title: 'Fleet awaiting orders', category: 'Fleets', ...at, day: 12, read: true, body: 'The fleet has arrived and awaits orders.' },
    { title: `${who.name} reports`, category: 'Missions', ...at, day: 12, read: false, body: 'The mission team has reached its destination and begun work.' },
    { title: `Battle at ${home.name}`, category: 'Conflict', ...at, day: 12, read: false, body: `Enemy forces have engaged our fleet ${env.pack.samples.terms.in_orbit ?? 'in orbit'}. Losses are being assessed.` }
  ]
}

/** LookDispatch.WhereWhen: "World, Theatre  ·  Day 12" on a dispatch, the theatre alone on a row. */
const whereWhen = (d: Dispatch, full: boolean) => {
  const place = full ? d.full : d.place
  return place ? `${place}  ·  Day ${d.day}` : `Day ${d.day}`
}

/** A category's stamp (Look.Stamp): an outline in the surface's muted ink; urgent, a
 * filled signal chip on the ledger and red ink on the parchment. None without a word. */
function Stamp({ category, paper, on }: { category: string; paper?: boolean; on?: boolean }) {
  const env = useEnv()
  const word = env.messages.stamp(category)
  if (!word) return null
  const urgent = env.messages.urgent(category)
  const shape: CSSProperties = { padding: '1px 6px', borderRadius: env.metric('radius'), textTransform: 'uppercase', whiteSpace: 'nowrap', lineHeight: 1.25, flex: 'none' }
  if (urgent && !paper)
    return (
      <Part name="Stamp (urgent)" box="stamp_urgent_ledger" color="stamp_urgent_ledger_text" font="stamp_ledger" style={shape}>
        {word}
      </Part>
    )
  const color: ColorId = paper ? (urgent ? 'stamp_paper_urgent' : 'stamp_paper') : on ? 'stamp_ledger_on' : 'stamp_ledger'
  return (
    <Part name={`Stamp${paper ? ' on the dispatch' : ''}${urgent ? ' (urgent)' : ''}`} color={color} font={paper ? 'stamp_paper' : 'stamp_ledger'} style={{ ...shape, border: `${paper ? 2 : 1}px solid ${env.c(colorOf(color))}` }}>
      {word}
    </Part>
  )
}

/** A ledger row (LookDispatch.Row): bold until read, where and when under it, the stamp, an urgent band. */
function LedgerRow({ d, on, hover }: { d: Dispatch; on?: boolean; hover?: boolean }) {
  const env = useEnv()
  const urgent = env.messages.urgent(d.category)
  const id: BoxId = on ? 'ROW_pressed' : hover ? 'ROW_hover' : 'ROW'
  return (
    <Part name={`Ledger row (${on ? 'picked' : hover ? 'under the pointer' : 'normal'})`} box={id} pad={0} style={{ position: 'relative', minHeight: 52, boxSizing: 'border-box', padding: '4px 8px 5px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
      {urgent && <Part name="Urgent band" color="row_band" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: env.c(colorOf('row_band')) }} />}
      <div style={{ flex: 1, minWidth: 0, display: 'grid' }}>
        <Part name={d.read ? 'Subject (read)' : 'Subject (unread)'} color={on || !d.read ? 'row_unread' : 'row_read'} font={d.read ? 'row_read' : 'row_unread'} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {d.title}
        </Part>
        <Part name="Where and when" color={on ? 'row_meta_on' : 'row_meta'} font="row_meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {whereWhen(d, false)}
        </Part>
      </div>
      <Stamp category={d.category} on={on} />
    </Part>
  )
}

/** The message read as a dispatch: parchment drawn under the detail column and past it,
 * the look's header word with the stamp, the subject, where and when, a rule, the text. */
function DispatchSheet({ d }: { d: Dispatch | null }) {
  const env = useEnv()
  const urgent = d ? env.messages.urgent(d.category) : false
  return (
    <div style={{ position: 'relative', alignSelf: 'stretch' }}>
      <Doc name="Dispatch (parchment under the detail column)" style={{ position: 'absolute', inset: -14 }}>
        {null}
      </Doc>
      {urgent && <Part name="Urgent band across the dispatch" color="dispatch_band" style={{ position: 'absolute', left: -14, right: -14, top: -14, height: 6, background: env.c(colorOf('dispatch_band')) }} />}
      <div style={{ position: 'relative', display: 'grid', gap: 8, alignContent: 'start' }}>
        <div style={row}>
          <Typed style={{ flex: 1 }}>{env.messages.header.toUpperCase() || ' '}</Typed>
          {d && <Stamp category={d.category} paper />}
        </div>
        <Part name="Subject" color="dispatch_subject" font="dispatch_subject">
          {d ? d.title : 'Select a message...'}
        </Part>
        {d && (
          <Part name="Where and when" color="dispatch_meta" font="dispatch_meta">
            {whereWhen(d, true)}
          </Part>
        )}
        <Part name="Rule" color="dispatch_rule" style={{ height: 1, background: env.c(colorOf('dispatch_rule')) }} />
        {d && (
          <Part name="The dispatch's text" color="dispatch_body" font="dispatch_body">
            {d.body}
          </Part>
        )}
        {d && (
          <div style={row}>
            <Cmd label="Go To" />
            <Cmd label="Delete" />
          </div>
        )}
      </div>
    </div>
  )
}

/** The Comms Center in the look: the ledger (a tab per category) and the dispatch. */
function Dispatches({ open, category = 'All', hover }: { open: number | null; category?: string; hover?: number }) {
  const env = useEnv()
  const all = dispatches(env)
  const list = category === 'All' ? all : all.filter((d) => d.category === category)
  const tabs = ['All', ...CATEGORIES].map((c) => ({ label: c, state: (c === category ? 'selected' : 'normal') as 'selected' | 'normal' }))
  return (
    <Win title="Message Index" width={900} bodyPad={20}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 29 }}>
        <div style={col}>
          <Tabs tabs={tabs} panelBox="dispatch_ledger">
            {list.length ? (
              list.map((d) => <LedgerRow key={d.title} d={d} on={open !== null && all[open] === d} hover={hover !== undefined && all[hover] === d} />)
            ) : (
              <Part name="An empty category" color="dispatch_empty" font="dispatch_empty" style={{ minHeight: 80, display: 'grid', placeItems: 'center' }}>
                {env.pack.samples.terms.no_messages ?? 'No transmissions.'}
              </Part>
            )}
          </Tabs>
          <div style={row}>
            <Cmd label="Select All" small />
            <Cmd label="Delete Selected Messages" small />
          </div>
        </div>
        <DispatchSheet d={open !== null ? all[open] : null} />
      </div>
    </Win>
  )
}

const MessageIndex = () => <Dispatches open={1} hover={0} />
const MessageUrgent = () => <Dispatches open={3} category="Conflict" />
const MessageEmpty = () => <Dispatches open={null} category="Chat" />

function ComposeChat() {
  return (
    <Win title="Compose Chat Message" width={460}>
      <div style={row}>
        <Picture w={72} h={72} color={rgb(0.06, 0.08, 0.11)} />
        <FixedText color={rgb(0.4, 0.45, 0.5)} note={N.literal}>
          To: your opponent
        </FixedText>
      </div>
      <FixedBox name="Message field" color="#1d1d1d" note={N.textEdit} style={{ height: 90 }} />
      <div style={row}>
        <Key label="Send message" />
        <Key label="Cancel" />
        <span style={{ flex: 1 }} />
        <Key label="Return to Display Message Index" />
      </div>
    </Win>
  )
}

function Encyclopedia() {
  const S = useEnv().pack.samples
  return (
    <Win title={S.terms.encyclopedia ?? 'Galactic Encyclopedia'} width={620}>
      <div style={row}>
        <Label>Topic</Label>
        <LineEdit value={S.characters[0].name} focus style={{ flex: 1 }} />
      </div>
      <div style={row}>
        {['All Databases', S.terms.system ?? 'System', S.terms.ship_database ?? 'Ship', 'Facilities', 'Mission', 'Troop', 'Personnel'].map((d, i) => (
          <Key key={d} label={d} state={i === 0 ? 'pressed' : 'normal'} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <ItemList items={S.characters.slice(0, 6).map((c, i) => ({ label: c.name, state: i === 0 ? 'selected' : i === 2 ? 'hover' : 'normal' }))} style={{ height: 150, flex: 1 }} />
        <Scroll height={150} hot />
      </div>
      <div style={row}>
        <Key label="<" />
        <Key label=">" />
        <span style={{ flex: 1 }} />
        <Key label="View Topic" />
        <Key label="Close" />
      </div>
    </Win>
  )
}

function Finder({ title, search, tabs, items, extra }: { title: string; search: string; tabs: string[]; items: { label: string; color?: string }[]; extra?: ReactNode }) {
  return (
    <Win title={title} width={380}>
      <LineEdit placeholder={search} />
      <Tabs tabs={tabs.map((t, i) => ({ label: t, state: i === 0 ? 'selected' : 'normal' }))} />
      <ItemList
        items={items.map((it, i) => ({ label: it.label, state: i === 1 ? 'selected' : 'normal', fixed: it.color ? { color: it.color, note: N.faction } : undefined }))}
        style={{ height: 170 }}
      />
      <div style={row}>
        {extra}
        <span style={{ flex: 1 }} />
        <Key label="Display" />
      </div>
    </Win>
  )
}

/** A System Finder row in the look (LookWindow.ListRow): a ruled ledger line in the
 * holder's look colour, or muted for a system no side is known to hold. */
function FinderRow({ label, factionId, state = 'normal' }: { label: string; factionId: string | null; state?: 'normal' | 'hover' | 'pressed' }) {
  const id: BoxId = state === 'pressed' ? 'ROW_pressed' : state === 'hover' ? 'ROW_hover' : 'ROW'
  return (
    <Part name={`Finder row (${state})`} box={id} font="default" className="key" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
      {factionId ? (
        <SideText factionId={factionId} name="A side's system (its look colour)">
          {label}
        </SideText>
      ) : (
        <Part name="A system no side is known to hold" color="finder_row_muted" style={{ display: 'inline' }}>
          {label}
        </Part>
      )}
    </Part>
  )
}

function SystemFinder() {
  const env = useEnv()
  const [a, b] = sides(env)
  return (
    <Win title={env.pack.samples.terms.system_finder ?? 'Planetary System Finder'} width={420}>
      <div style={row}>
        <Part name="Search label" color="HEADING" font="finder_search_label" style={{ flex: 'none' }}>
          {`${env.pack.samples.terms.system ?? 'System'} Name`}
        </Part>
        <LineEdit placeholder={env.pack.samples.terms.search_systems ?? 'Search galaxy...'} style={{ flex: 1 }} />
      </div>
      <Tabs tabs={[`All ${env.pack.samples.terms.systems ?? 'Systems'}`, a.shortName, b.shortName, 'Neutral', 'Unexplored'].map((t, i) => ({ label: t, state: i === 0 ? 'selected' : 'normal' }))}>
        {env.pack.samples.planets.slice(0, 7).map((p, i) => (
          <FinderRow key={i} label={p.name} factionId={i % 3 === 2 ? null : sides(env)[i % 2].id} state={i === 1 ? 'pressed' : i === 3 ? 'hover' : 'normal'} />
        ))}
      </Tabs>
    </Win>
  )
}

function PersonnelFinder() {
  const env = useEnv()
  const [a, b] = sides(env)
  return (
    <Finder
      title="Personnel Finder"
      search="Name"
      tabs={[a.shortName, b.shortName]}
      items={env.pack.samples.characters.slice(0, 7).map((c) => ({ label: c.name, color: (env.pack.factions.find((f) => f.id === c.faction) ?? a).color }))}
    />
  )
}

function FleetFinder() {
  const env = useEnv()
  const [a, b] = sides(env)
  return (
    <Finder
      title="Fleet Finder"
      search="Fleet name"
      tabs={[a.name, b.name]}
      items={['Fleet 1', 'Fleet 2', 'Fleet 3', 'Fleet 4'].map((l) => ({ label: `${l} at ${pick(env.pack.samples.planets, l.length).name}` }))}
      extra={
        <>
          <Key label="Fleet" state="pressed" />
          <Key label="Ship" />
        </>
      }
    />
  )
}

function TroopFinder() {
  const env = useEnv()
  const [a, b] = sides(env)
  const troops = env.pack.samples.units.filter((u) => /troop|regiment|division|army/i.test(u.kind + u.name))
  return <Finder title="Troop Finder" search="Troop Location" tabs={[a.name, b.name]} items={(troops.length ? troops : env.pack.samples.units).slice(0, 6).map((u) => ({ label: u.name }))} />
}

function CharacterStatus() {
  const env = useEnv()
  const S = env.pack.samples
  const c = S.characters[0]
  return (
    <Win title={c.name} width={480}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Picture w={80} h={80} text="Portrait" />
        <Grid>
          <Field k="Commanding" v="Fleet 1" />
          <Field k="Attached" v={S.planets[0].name} />
          <Field k="Status" v="Active" />
          <Field k="Force" v="—" />
        </Grid>
      </div>
      <Divider />
      <Grid>
        <Field k="Diplomacy" v={<Progress value={70} style={{ width: 200 }} />} />
        <Field k="Espionage" v={<Progress value={40} style={{ width: 200 }} />} />
        <Field k="Leadership" v={<Progress value={85} style={{ width: 200 }} />} />
      </Grid>
    </Win>
  )
}

function UnitStatus() {
  const S = useEnv().pack.samples
  const key = rgb(0.8, 0.8, 0.8)
  return (
    <Win title={S.units[0].name} width={440}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Grid>
          <Field k="Hull" v="1,200" keyColor={key} />
          <Field k="Shields" v="600" keyColor={key} />
          <Field k="Speed" v="6" keyColor={key} />
          <Field k="Cost" v="18" keyColor={key} />
        </Grid>
        <Picture w={140} h={100} text="[ 3D Model ]" />
      </div>
      <Label style={{ textAlign: 'center' }}>{S.units[0].name}</Label>
    </Win>
  )
}

function DefenseFacilityStatus() {
  const S = useEnv().pack.samples
  return (
    <Win title={S.facilities[0]} width={420}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Picture w={64} h={64} />
        <Grid>
          <Field k="Location" v={S.planets[0].name} />
          <Field k="Status" v={<FixedText color={GODOT.LIME_GREEN} note={N.status}>Operational</FixedText>} />
          <Field k="Maintenance" v="2" />
          <Field k="Tier" v="1" />
          <Field k="Bombardment" v={<FixedText color={GODOT.RED} note={N.status}>Blocked</FixedText>} />
        </Grid>
      </div>
    </Win>
  )
}

function FleetStatus() {
  const S = useEnv().pack.samples
  return (
    <Win title="Fleet 1" width={420}>
      <FixedText color={SUBJECT} note={N.literal}>
        Fleet
      </FixedText>
      <Grid>
        <Field k="Location" v={S.planets[0].name} />
        <Field k="Commander" v={S.characters[0].name} />
        <Field k="Capital ships" v={<FixedText color={GODOT.GOLDENROD} note={N.status}>4</FixedText>} />
        <Field k="Fighters" v={<FixedText color={GODOT.LIGHT_GREEN} note={N.status}>12 of 12</FixedText>} />
        <Field k="Troops" v={<FixedText color={GODOT.INDIAN_RED} note={N.status}>0 of 2</FixedText>} />
      </Grid>
    </Win>
  )
}

function StatusPlate() {
  const S = useEnv().pack.samples
  const key = rgb(0.8, 0.8, 0.8)
  return (
    <Win title={`${S.missions[0]} Status`} width={440}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Picture w={90} h={90} />
        <Grid>
          <Field k="Target" v={S.planets[0].name} keyColor={key} />
          <Field k="Team" v={S.characters[0].name} keyColor={key} />
          <Field k="Days left" v="6" keyColor={key} />
        </Grid>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Key label="Encyclopedia" />
      </div>
    </Win>
  )
}

function ConfirmTransit() {
  return (
    <Win title="Confirm Transit" width={320}>
      <Label>Transit time in days: 12</Label>
      <div style={{ ...row, justifyContent: 'center' }}>
        <Key label="Y" state="hover" />
        <Key label="N" />
      </div>
    </Win>
  )
}

/** The Game Menu: the window dress, and its column of choices as command keys (LookWindow.Commands). */
function GameMenu() {
  return (
    <Win title="Game Menu" width={280}>
      {['Resume Game', 'Game Options', 'Exit to Main Menu', 'Exit to Desktop'].map((k, i) => (
        <Cmd key={k} label={k} state={i === 0 ? 'focus' : i === 2 ? 'hover' : 'normal'} style={{ textAlign: 'center' }} />
      ))}
    </Win>
  )
}

/** Game Options - Save Game (game_options_window.gd): a panel of the look's theme, its title a plain label. */
function SaveGame() {
  const S = useEnv().pack.samples
  return (
    <Dressed>
    <Part name="Window body" box="panel" style={{ width: 560, display: 'grid', gap: 8, padding: 14 }}>
      <Label style={{ fontSize: 16 }}>Game Options - Save Game</Label>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={row}>
          <Label style={{ width: 90 }}>{i < 2 ? `Day ${40 + i * 30}` : 'Empty'}</Label>
          <LineEdit value={i < 2 ? `${pick(S.sectors, i)} campaign` : ''} placeholder="Name" focus={i === 2} style={{ flex: 1 }} />
          <Key label="Save" state={i === 4 ? 'disabled' : 'normal'} />
        </div>
      ))}
      <div style={row}>
        <Key label="Import Game" />
        <Key label="Manage Games" />
        <span style={{ flex: 1 }} />
        <Key label="Close" />
      </div>
    </Part>
    </Dressed>
  )
}

function GalaxyOverview() {
  const S = useEnv().pack.samples
  return (
    <CodeWindow frame="overview_panel" heading="overview_title" title={S.terms.galaxy_overview ?? 'Galaxy Overview'} width={420}>
      {S.units.slice(0, 5).map((u, i) => (
        <div key={i} style={row}>
          <FixedText color={rgb(0.62, 0.72, 0.88)} note={N.literal} style={{ flex: 1 }}>
            {u.name}
          </FixedText>
          <FixedText color={rgb(0.92, 0.94, 1)} note={N.literal}>
            {3 + i}
          </FixedText>
          <FixedText color={rgb(1, 0.85, 0.45)} note={N.literal}>
            {i + 1} upkeep
          </FixedText>
        </div>
      ))}
    </CodeWindow>
  )
}

function Objectives() {
  const env = useEnv()
  return (
    <CodeWindow frame="objectives_panel" heading="objectives_title" title="Objectives" width={440}>
      {sides(env).map((s, i) => (
        <div key={s.id} style={col}>
          <FixedText color={rgb(0.92, 0.94, 1)} note={N.literal} style={{ fontWeight: 600 }}>
            {s.name}
          </FixedText>
          {['Capture the enemy headquarters', 'Capture the enemy leaders', 'Hold the capital'].map((o, k) => (
            <FixedText key={k} color={k === i ? rgb(0.45, 1, 0.45) : rgb(0.55, 0.6, 0.7)} note={N.status}>
              {k === i ? '✓' : '○'} {o}
            </FixedText>
          ))}
        </div>
      ))}
    </CodeWindow>
  )
}

/** Its own dark red frame and title, kept: the window dress's tables do not list them. */
function BattleAlert() {
  const env = useEnv()
  const S = env.pack.samples
  return (
    <CodeWindow frame="alert_panel" heading="alert_title" title={`Conflict at ${S.planets[0].name}`} width={560}>
      <Tabs tabs={['Battle Summary', `${sides(env)[0].name} Forces`, `${sides(env)[1].name} Forces`, 'System Summary'].map((l, i) => ({ label: l, state: i === 0 ? 'selected' : 'normal' }))}>
        {S.units.slice(0, 4).map((u, i) => (
          <div key={i} style={row}>
            <FixedText color={i % 2 ? rgb(0.68, 0.74, 0.85) : rgb(0.92, 0.94, 1)} note={N.literal} style={{ flex: 1 }}>
              {u.name}
            </FixedText>
            <FixedText color={rgb(0.92, 0.94, 1)} note={N.literal}>
              {2 + i}
            </FixedText>
          </div>
        ))}
        <FixedText color={rgb(1, 0.55, 0.45)} note={N.literal}>
          Your fleet is outnumbered.
        </FixedText>
      </Tabs>
      <div style={row}>
        <Key label="Simulate Results" />
        <Key label="Take Command" />
        <Key label="Retreat" />
      </div>
    </CodeWindow>
  )
}

function BattleResults() {
  const S = useEnv().pack.samples
  return (
    <CodeWindow frame="results_panel" heading="results_title" title={`Battle at ${S.planets[0].name}`} width={600}>
      <FixedText color={rgb(0.55, 0.9, 0.6)} note={N.status}>
        Victory: the enemy fleet was destroyed.
      </FixedText>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 10 }}>
        <Tabs tabs={[{ label: 'Operational', state: 'selected' }, { label: 'Destroyed' }]}>
          {S.units.slice(0, 3).map((u, i) => (
            <div key={i} style={row}>
              <Label style={{ flex: 1 }}>{u.name}</Label>
              <FixedText color={i === 2 ? rgb(0.95, 0.5, 0.45) : rgb(0.95, 0.8, 0.45)} note={N.status}>
                {i === 2 ? 'lost' : `${3 - i} left`}
              </FixedText>
            </div>
          ))}
        </Tabs>
        <div style={col}>
          {['Close', 'Summary', 'Our Forces', 'Their Forces', 'Goto System'].map((k, i) => (
            <Key key={k} label={k} state={i === 1 ? 'pressed' : 'normal'} />
          ))}
        </div>
      </div>
    </CodeWindow>
  )
}

// ---------------------------------------------------------------------------
// Dialogs, menus, tooltips (Look.InstallPopups)
// ---------------------------------------------------------------------------

function Stage({ children, w = 760, h = 480 }: { children: ReactNode; w?: number; h?: number }) {
  return <Desk style={{ width: w, height: h, display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>{children}</Desk>
}

/** A confirmation (fleet_window.gd's Confirm Scrap, a ConfirmationDialog) and a refusal
 * (the AcceptDialog every refused order shows), over the dim. */
function Dialogs() {
  const S = useEnv().pack.samples
  return (
    <Desk style={{ width: 900, height: 480, position: 'relative' }}>
      <Dim>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Dialog title="Confirm Scrap" width={360} buttons={<><Cmd label="OK" state="focus" /><Cmd label="Cancel" /></>}>
            <Label>Are you sure you want to scrap the following units?</Label>
            <Label style={{ paddingLeft: 24 }}>{S.units[0].name}</Label>
          </Dialog>
          <Dialog title="Order Refused" width={360} buttons={<Cmd label="OK" />}>
            <Label>The mission cannot be launched: the team has no one able to perform it.</Label>
          </Dialog>
        </div>
      </Dim>
    </Desk>
  )
}

function BuildSelection() {
  const S = useEnv().pack.samples
  return (
    <Stage>
      <Win title="Build" width={420}>
        <Grid>
          <Label>Item</Label>
          <Label>{S.units[0].name}</Label>
          <Label>Cost</Label>
          <Label>18</Label>
          <Label>Time</Label>
          <Label>24 days</Label>
          <Label>Count</Label>
          <LineEdit value="2" />
          <Label>Deliver to</Label>
          <Key label={`${S.planets[0].name}  ▾`} name="Drop-down list" />
        </Grid>
        <div style={{ ...row, justifyContent: 'flex-end' }}>
          <Key label="OK" />
          <Key label="Cancel" />
        </div>
      </Win>
    </Stage>
  )
}

function CreateMission() {
  const S = useEnv().pack.samples
  return (
    <Stage>
      <Win title="Create Mission" width={460}>
        <Grid>
          <Label>Target</Label>
          <Label>{S.planets[0].name}</Label>
          <Label>Team</Label>
          <Label>{S.characters[0].name}</Label>
        </Grid>
        <div style={row}>
          <Picture w={80} h={60} />
          <Key label={`${S.missions[0]}  ▾`} name="Drop-down list" />
        </div>
        <Check label={`Decoy: ${pick(S.characters, 1).name}`} checked />
        <Check label={`Decoy: ${pick(S.characters, 2).name}`} hover />
        <FixedText color={GODOT.LIGHT_GRAY} note={N.literal}>
          Arrives in 6 days
        </FixedText>
        <div style={{ ...row, justifyContent: 'flex-end' }}>
          <Key label="Encyclopedia" />
          <Key label="OK" />
          <Key label="Cancel" />
        </div>
      </Win>
    </Stage>
  )
}

function Menus() {
  const S = useEnv().pack.samples
  return (
    <Stage>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
        <Popup
          items={[
            { separator: S.characters[0].name },
            { label: 'Status' },
            { label: 'Encyclopedia', accel: 'F1' },
            { label: 'Command', sub: true, hover: true },
            { separator: true },
            { label: 'Diplomacy mission' },
            { label: 'Retire', disabled: true }
          ]}
        />
        <Popup items={[{ label: 'Fleet 1', checked: true }, { label: 'Fleet 2' }, { label: 'New fleet' }]} width={150} style={{ marginTop: 60 }} />
      </div>
    </Stage>
  )
}

function Tooltips() {
  const T = useEnv().pack.samples.terms
  return (
    <Stage>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
        <Key label={`${T.system ?? 'System'} Finder`} state="hover" />
        <Tooltip text={`Find a ${T.system ? T.system.toLowerCase() : 'planetary system'} by name, side or state.`} />
      </div>
    </Stage>
  )
}

// ---------------------------------------------------------------------------
// The head-to-head screens (LookWindow.DressScreen)
// ---------------------------------------------------------------------------

const MP_BG = rgb(0.08, 0.1, 0.14)

/** A screen's title (any Label named Title): the display face, the text colour, capitals; its own size. */
function ScreenTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <Part name="Screen title" color="window_title_text" font="screen_title" style={{ textTransform: 'uppercase', ...style }}>
      {children}
    </Part>
  )
}

function MpScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Dressed>
      <FixedBox name="Screen background" color={MP_BG} note={N.literal} scene style={{ width: 1024, height: 600, padding: 40, boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 16 }}>
        <ScreenTitle style={{ fontSize: 28, textAlign: 'center' }}>{title}</ScreenTitle>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start', maxWidth: 640, justifySelf: 'center', width: '100%' }}>{children}</div>
        <div style={{ ...row, justifyContent: 'flex-end' }}>
          <Cmd label="Previous" />
          <Cmd label="Proceed" state="focus" />
          <Cmd label="Cancel" />
        </div>
      </FixedBox>
    </Dressed>
  )
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <FixedText color={FIELD_KEY} note={N.literal}>
      {children}
    </FixedText>
  )
}

function MpConfig() {
  return (
    <MpScreen title="Multiplayer Configuration">
      <Caption>How do you want to play?</Caption>
      <ItemList items={[{ label: 'Internet (relay)', state: 'selected' }, { label: 'Local network' }]} style={{ height: 80 }} />
      <div style={row}>
        <Key label="Connect To Game" />
        <Key label="Setup Game" state="hover" />
      </div>
    </MpScreen>
  )
}

function MpHost() {
  return (
    <MpScreen title="Host Game">
      <Caption>What is your name?</Caption>
      <LineEdit value="Commander" />
      <Caption>What do you want to call this game?</Caption>
      <LineEdit placeholder="Game name" focus />
    </MpScreen>
  )
}

/** Its dialog (a PanelContainer named Dialog) is a steel panel (LookModal). */
function MpLocate() {
  return (
    <Dressed>
    <FixedBox name="Screen background" color={MP_BG} note={N.literal} scene style={{ width: 1024, height: 600, display: 'grid', placeItems: 'center' }}>
      <Part name="Dialog panel" box="MODAL" style={{ width: 460, display: 'grid', gap: 8 }}>
        <div style={row}>
          <ScreenTitle style={{ flex: 1, fontSize: 18 }}>Locate Session</ScreenTitle>
          <Key label="X" />
        </div>
        <Caption>Player name</Caption>
        <LineEdit value="Commander" />
        <Caption>Enter the game code</Caption>
        <LineEdit placeholder="ABCD-1234" />
        <FixedText color={GODOT.GRAY} note={N.status}>
          Looking for games…
        </FixedText>
        <ItemList items={[{ label: 'Game at the front', state: 'selected' }, { label: 'Evening match' }]} style={{ height: 70 }} />
        <div style={{ ...row, justifyContent: 'flex-end' }}>
          <Key label="OK" />
          <Key label="Cancel" />
        </div>
      </Part>
    </FixedBox>
    </Dressed>
  )
}

function MpOptions() {
  const env = useEnv()
  const [a, b] = sides(env)
  return (
    <MpScreen title="Multiplayer Options">
      <div style={row}>
        <Caption>Side</Caption>
        <Key label={<FixedText color={rgb(1, 0.3, 0.3)} note={N.literal}>{a.name}</FixedText>} state="pressed" />
        <Key label={<FixedText color={rgb(0.3, 0.85, 0.3)} note={N.literal}>{b.name}</FixedText>} />
      </div>
      <div style={row}>
        <Caption>Galaxy size</Caption>
        <Key label="Small" />
        <Key label="Medium" state="pressed" />
        <Key label="Large" />
      </div>
      <div style={row}>
        <Key label="Standard" state="pressed" />
        <Key label="HQ Only" />
        <span style={{ flex: 1 }} />
        <Key label="Load Game" />
      </div>
      <div style={row}>
        <Caption>Game code</Caption>
        <LineEdit value="QX7P-22LM" readOnly style={{ flex: 1 }} />
        <Key label="Copy Code" />
      </div>
      <LineEdit placeholder="Say something" />
    </MpScreen>
  )
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const WINDOWS: WindowEntry[] = [
  { id: 'cockpit', name: 'Cockpit (campaign dossier)', status: 'now', size: [1440, 850], Mock: Cockpit, note: 'For a pack with a look and no Cockpit picture.' },
  { id: 'map', name: 'Map screen', status: 'now', size: [1440, 850], Mock: MapScreen, note: 'The top strip, dispatch rail, theatre directory, mode bar, console, map key and map. The Feedback box keeps two colours of its own.' },
  { id: 'credits', name: 'Credits sheet', status: 'now', size: [1440, 850], Mock: Credits },
  { id: 'load', name: 'Load Game, Manage Games', status: 'now', size: [760, 520], Mock: LoadGame, note: 'A panel of the look’s theme (it has no title bar), its own colours traded for the look’s by the window hook.' },

  { id: 'messages', name: 'Message Index (dispatches)', status: 'now', size: [940, 470], Mock: MessageIndex, note: DISPATCH },
  { id: 'messages-urgent', name: 'Message Index: an urgent dispatch', status: 'now', size: [940, 470], Mock: MessageUrgent, note: DISPATCH },
  { id: 'messages-empty', name: 'Message Index: an empty category', status: 'now', size: [940, 470], Mock: MessageEmpty, note: DISPATCH },
  {
    id: 'sector',
    name: 'Sector window',
    status: 'now',
    size: [600, 420],
    Mock: SectorWindow,
    note:
      'A theatre plate (look_sector.gd): the theatre cut from the sharpest picture that holds it (a map inset, else textures.map_detail, else the map) under a parchment wash, or a plotting sheet where none is sharp enough; each system where the pack puts it. Holders are the starting ones; the corner icons and bars are a sample. ' +
      DRESS,
    choice: { label: 'Theatre', options: (env) => env.pack.sector.theatres.map((t) => ({ id: t.id, label: t.name })) },
    sizeOf: (env, choice) => {
      const t = env.pack.sector.theatres.find((x) => x.id === choice) ?? env.pack.sector.theatres[0]
      if (!t) return [600, 420]
      const l = layoutTheatre(t)
      return [Math.ceil(l.w) + 4, Math.ceil(l.h) + 34]
    }
  },
  { id: 'planet', name: 'Planet Data', status: 'now', size: [520, 420], Mock: PlanetData, note: DRESS },
  { id: 'manufacturing', name: 'Manufacturing and Production', status: 'now', size: [740, 560], Mock: Manufacturing, note: DRESS },
  { id: 'defenses', name: 'System Defenses', status: 'now', size: [640, 380], Mock: Defenses, note: DRESS },
  { id: 'fleet', name: 'Fleet window', status: 'now', size: [720, 360], Mock: FleetWindow, note: DRESS },
  { id: 'missions', name: 'Missions', status: 'now', size: [660, 340], Mock: Missions, note: DRESS },
  { id: 'compose', name: 'Compose Chat Message', status: 'now', size: [540, 300], Mock: ComposeChat, note: DRESS },
  { id: 'encyclopedia', name: 'Galactic Encyclopedia', status: 'now', size: [700, 420], Mock: Encyclopedia, note: DRESS },
  { id: 'system-finder', name: 'Planetary System Finder', status: 'now', size: [500, 560], Mock: SystemFinder, note: DRESS + ' Its rows are ledger lines in the holder’s look colour, its search label a heading, its tabs the sides’ short names, and its search hint the pack’s `search_systems` term.' },
  { id: 'personnel-finder', name: 'Personnel Finder', status: 'now', size: [460, 400], Mock: PersonnelFinder, note: DRESS + ' Its tabs are the sides’ short names.' },
  { id: 'fleet-finder', name: 'Fleet Finder', status: 'now', size: [460, 400], Mock: FleetFinder, note: DRESS },
  { id: 'troop-finder', name: 'Troop Finder', status: 'now', size: [460, 400], Mock: TroopFinder, note: DRESS },
  { id: 'character-status', name: 'Character Status', status: 'now', size: [560, 360], Mock: CharacterStatus, note: DRESS },
  { id: 'unit-status', name: 'Unit Status', status: 'now', size: [520, 280], Mock: UnitStatus, note: DRESS },
  { id: 'facility-status', name: 'Defense Facility Status', status: 'now', size: [500, 260], Mock: DefenseFacilityStatus, note: DRESS },
  { id: 'fleet-status', name: 'Fleet Status', status: 'now', size: [500, 280], Mock: FleetStatus, note: DRESS },
  { id: 'status', name: 'Status (missions, queues)', status: 'now', size: [520, 260], Mock: StatusPlate, note: DRESS },
  { id: 'transit', name: 'Confirm Transit', status: 'now', size: [400, 200], Mock: ConfirmTransit, note: DRESS },
  { id: 'build', name: 'Build Selection', status: 'now', size: [760, 480], Mock: BuildSelection, note: DRESS },
  { id: 'create-mission', name: 'Create Mission', status: 'now', size: [760, 480], Mock: CreateMission, note: DRESS },
  { id: 'game-menu', name: 'Game Menu', status: 'now', size: [360, 280], Mock: GameMenu, note: DRESS + ' Its choices are command keys (LookWindow.Commands).' },
  { id: 'save', name: 'Game Options, Save Game', status: 'now', size: [620, 380], Mock: SaveGame, note: 'A panel of the look’s theme (it has no title bar), its own colours traded for the look’s by the window hook.' },
  { id: 'overview', name: 'Galaxy Overview', status: 'now', size: [500, 300], Mock: GalaxyOverview, note: CODE },
  { id: 'objectives', name: 'Objectives', status: 'now', size: [520, 340], Mock: Objectives, note: CODE },
  { id: 'battle-alert', name: 'Battle Alert', status: 'now', size: [640, 380], Mock: BattleAlert, note: CODE + ' Its dark red frame and title are its own and are kept.' },
  { id: 'battle-results', name: 'Battle Results, Assault, Bombardment', status: 'now', size: [680, 400], Mock: BattleResults, note: CODE },
  { id: 'dialogs', name: 'Dialogs (Confirm Scrap, Retire, Leave Game, Pause, refusals…)', status: 'now', size: [900, 480], Mock: Dialogs, note: SHEET },
  { id: 'menus', name: 'Popup menus', status: 'now', size: [760, 480], Mock: Menus, note: POPUPS },
  { id: 'tooltips', name: 'Tooltips', status: 'now', size: [760, 480], Mock: Tooltips, note: POPUPS },
  { id: 'mp-config', name: 'Multiplayer Configuration', status: 'now', size: [1024, 600], Mock: MpConfig, note: SCREEN },
  { id: 'mp-host', name: 'Host Game', status: 'now', size: [1024, 600], Mock: MpHost, note: SCREEN },
  { id: 'mp-locate', name: 'Locate Session', status: 'now', size: [1024, 600], Mock: MpLocate, note: SCREEN },
  { id: 'mp-options', name: 'Multiplayer Options', status: 'now', size: [1024, 600], Mock: MpOptions, note: SCREEN },

  { id: 'picker', name: 'Pack Picker and its dialogs', status: 'never', why: 'It runs before any pack is loaded, so no pack’s look can reach it. It has its own palette.' },
  { id: 'splash', name: 'Boot splash, movies', status: 'never', why: 'Pictures and films only.' },
  { id: 'cockpit-buttons', name: 'Cockpit (button form)', status: 'never', why: 'Only a pack without a look shows it; a pack with a look gets the campaign dossier instead.' },
  { id: 'cockpit-picture', name: 'Cockpit (picture form)', status: 'never', why: 'Drawn from the pack’s own Cockpit picture, with its own readout and bracket colours in pack.json.' },
  { id: 'credits-plain', name: 'Credits (plain)', status: 'never', why: 'A pack with a look gets the Credits sheet instead.' },
  { id: 'standins', name: 'Stand-in windows (Command Center, Message Index, Sector, Status, Manufacturing, Defenses, Fleet, Missions, finders, Encyclopedia)', status: 'never', why: 'Plain Build Parity: drawn for a pack with no art set and NO look, in the palette in plain_icons.gd. The game turns them off for any pack with a look (art_standins.gd:43).' },
  { id: 'original', name: 'Original-look screens', status: 'never', why: 'The Command Center frame, the original Game Options and saved-games screens, the Galaxy Display and GID Control menus, the opening briefing and the original form of each window are drawn from the player’s art set.' },
  { id: 'tactical', name: 'Tactical display', status: 'never', why: 'Drawn directly by the game in its own colours; no plan names it.' }
]
