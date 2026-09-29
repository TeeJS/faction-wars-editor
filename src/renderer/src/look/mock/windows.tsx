// THE WINDOWS: every screen, window and dialog in the game
// (docs/window-inventory.md), each with its status and, where a look can
// reach it, a mock-up built from the kit. Names come from the pack itself.
//
// Status:
//   now      the game draws it from the look today
//   partly   some of it (the rest keeps its own colours; marked fixed)
//   not-yet  the game draws it in its own colours today; shown as the paused
//            plan (look_window.gd, phases 4-6) would dress it
//   never    a pack's look can never reach it; no mock-up

import type { CSSProperties, ReactNode } from 'react'
import {
  Check,
  Chip,
  Cmd,
  Desk,
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
  literal: 'Written into this window: the paused plan dresses the frame, title bar and body, and leaves this as it is.',
  status: 'A status colour the window picks itself; the look does not set it.',
  faction: "The side's own colour from factions.json, as the map shows it. A look's `sides` colour is for the chrome only.",
  picture: "A picture's frame, written into the scene.",
  textEdit: "Godot's own text box: look.gd does not style TextEdit.",
  map: "The pack's map picture (pack.json map_image).",
  drawn: 'Drawn by the window itself in its own colours.'
}

const DRESS =
  'Not in the game yet. Today the game draws this window in its own colours. Shown as the paused WWII plan would dress it (look_window.gd, phases 4-6): the frame, title bar and body, with the look’s controls inside.'
const INSTALL =
  'Not in the game yet. Today the game draws this in its own colours. Shown as it would look once the look is put on the whole game (Look.Install, planned for phase 5): the look’s controls, with the colours written into the screen kept.'
const GUESS =
  'Not in the game yet, and the plan does not say how this window will be dressed. Shown in the window dress, with the look’s controls inside.'

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
  const a = f[0] ?? { id: 'a', name: 'Side A', color: '#d22a2a' }
  const b = f[1] ?? { id: 'b', name: 'Side B', color: '#2a62d2' }
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
    <FixedBox name="Picture area" color={color} note={N.picture} style={{ width: w, height: h, display: 'grid', placeItems: 'center', flex: 'none' }}>
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
        {['Menu', 'System Finder', 'Fleet Finder', 'Troop Finder', 'Personnel Finder'].map((k, i) => (
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
    </Desk>
  )
}

// ---------------------------------------------------------------------------
// Not in the game yet: the windows
// ---------------------------------------------------------------------------

function SectorWindow() {
  const env = useEnv()
  const S = env.pack.samples
  const sector = S.sectors[0]
  const planets = S.planets.filter((p) => p.sector === sector).slice(0, 5)
  const shown = planets.length ? planets : S.planets.slice(0, 5)
  return (
    <Win title={`${sector}`} width={520} bodyPad={0}>
      <div style={{ position: 'relative', height: 320 }}>
        {shown.map((p, i) => {
          const x = 60 + (i % 3) * 150
          const y = 50 + Math.floor(i / 3) * 150 + (i % 2) * 30
          const side = i % 3 === 2 ? null : sides(env)[i % 2]
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, display: 'grid', justifyItems: 'center', gap: 4 }}>
              <FixedBox name="World" color={side ? side.color : '#777777'} note={N.faction} style={{ width: 26, height: 26, borderRadius: '50%' }} />
              <FixedText color={side ? side.color : rgb(0.8, 0.8, 0.8)} note={N.drawn}>
                {p.name}
              </FixedText>
              <div style={{ display: 'flex', gap: 2 }}>
                {[0, 1, 2, 3].map((k) => (
                  <FixedBox key={k} name="Energy square" color={k < 2 ? GODOT.WHITE : rgb(0.3, 0.55, 1)} note={N.drawn} style={{ width: 6, height: 6 }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                {[0, 1, 2].map((k) => (
                  <FixedBox key={k} name="Mine square" color={k < 1 ? rgb(1, 0.9, 0.2) : rgb(0.9, 0.15, 0.1)} note={N.drawn} style={{ width: 6, height: 6 }} />
                ))}
              </div>
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
            <FixedBox name="Queue header" color={rgb(0.2, 0.6, 0.2)} note={N.literal} style={{ padding: '2px 8px', display: 'flex' }}>
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
    <Win title="System Fleets" width={640}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 10 }}>
        <div style={col}>
          <Label>Fleets in System</Label>
          <ItemList
            items={['Fleet 1', 'Fleet 2', 'Fleet 3 (en route)'].map((l, i) => ({ label: l, state: i === 0 ? 'selected' : 'normal', fixed: i === 2 ? { color: GODOT.DARK_GRAY, note: N.status } : { color: sides(env)[0].color, note: N.faction } }))}
            style={{ height: 200 }}
          />
        </div>
        <div style={col}>
          <Label style={{ fontSize: 18 }}>Fleet 1</Label>
          <Tabs tabs={['Capital Ships', 'Fighters', 'Troops', 'Personnel'].map((l, i) => ({ label: l, state: i === 0 ? 'selected' : 'normal' }))}>
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

function MessageIndex() {
  const S = useEnv().pack.samples
  const titles = [`Fleet arrived at ${S.planets[0].name}`, `${S.characters[0].name} recruited`, `Conflict at ${pick(S.planets, 2).name}`, 'Production complete']
  return (
    <Win title="Message Index" width={740}>
      <Tabs tabs={[{ label: 'All', state: 'selected' }, ...CATEGORIES.map((c, i) => ({ label: c, state: (i === 7 ? 'disabled' : 'normal') as 'disabled' | 'normal' }))]} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={col}>
          <ItemList
            items={titles.map((t, i) => ({
              label: `[Day ${112 + i}] ${t}`,
              state: i === 0 ? 'selected' : 'normal',
              fixed: { color: i < 2 ? GODOT.WHITE : GODOT.GRAY, note: 'Unread in white, read in grey: written into the window.' }
            }))}
            style={{ height: 160 }}
          />
          <div style={row}>
            <Key label="Select All" />
            <Key label="Delete Selected Messages" />
          </div>
        </div>
        <div style={col}>
          <div style={row}>
            <Picture w={56} h={56} color={PORTRAIT} />
            <FixedText color={SUBJECT} note={N.literal} style={{ fontWeight: 600 }}>
              {titles[0]}
            </FixedText>
          </div>
          <Label>
            The fleet has arrived and awaits orders. Its commander reports the system quiet.
          </Label>
          <div style={row}>
            <Key label="Go To" state="focus" />
            <Key label="Compose Chat Message" />
            <Key label="Delete" />
          </div>
        </div>
      </div>
    </Win>
  )
}

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
    <Win title="Galactic Encyclopedia" width={620}>
      <div style={row}>
        <Label>Topic</Label>
        <LineEdit value={S.characters[0].name} focus style={{ flex: 1 }} />
      </div>
      <div style={row}>
        {['Characters', 'Units', 'Facilities', 'Planets'].map((d, i) => (
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

function SystemFinder() {
  const env = useEnv()
  const [a, b] = sides(env)
  return (
    <Finder
      title="Planetary System Finder"
      search="System Name"
      tabs={['All', a.name, b.name, 'Neutral', 'Unexplored']}
      items={env.pack.samples.planets.slice(0, 7).map((p, i) => ({ label: p.name, color: i % 3 === 2 ? '#9a9a9a' : sides(env)[i % 2].color }))}
    />
  )
}

function PersonnelFinder() {
  const env = useEnv()
  const [a, b] = sides(env)
  return (
    <Finder
      title="Personnel Finder"
      search="Name"
      tabs={[a.name, b.name]}
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

function GameMenu() {
  return (
    <Win title="Game Menu" width={280}>
      {['Resume Game', 'Game Options', 'Exit to Main Menu', 'Exit to Desktop'].map((k, i) => (
        <Key key={k} label={k} state={i === 0 ? 'focus' : i === 2 ? 'hover' : 'normal'} style={{ textAlign: 'center' }} />
      ))}
    </Win>
  )
}

function SaveGame() {
  const S = useEnv().pack.samples
  return (
    <Win title="Save Game" width={540}>
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
    </Win>
  )
}

function GalaxyOverview() {
  const S = useEnv().pack.samples
  return (
    <Win title="Galaxy Overview" width={420}>
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
    </Win>
  )
}

function Objectives() {
  const env = useEnv()
  return (
    <Win title="Objectives" width={440}>
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
    </Win>
  )
}

function BattleAlert() {
  const env = useEnv()
  const S = env.pack.samples
  return (
    <Win title={`Conflict at ${S.planets[0].name}`} width={560}>
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
    </Win>
  )
}

function BattleResults() {
  const S = useEnv().pack.samples
  return (
    <Win title={`Battle at ${S.planets[0].name}`} width={600}>
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
    </Win>
  )
}

// ---------------------------------------------------------------------------
// Not in the game yet: dialogs, menus, tooltips
// ---------------------------------------------------------------------------

function Stage({ children, w = 760, h = 480 }: { children: ReactNode; w?: number; h?: number }) {
  return <Desk style={{ width: w, height: h, display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>{children}</Desk>
}

function Dialogs() {
  const S = useEnv().pack.samples
  return (
    <Stage w={900}>
      <Dialog title="Confirm Scrap" width={340} buttons={<><Key label="OK" state="focus" /><Key label="Cancel" /></>}>
        <Label>Scrap {S.units[0].name}? This cannot be undone.</Label>
      </Dialog>
      <Dialog title="Order Refused" width={340} buttons={<Key label="OK" />}>
        <Label>{S.characters[0].name} is on a mission and cannot take command.</Label>
      </Dialog>
    </Stage>
  )
}

function BuildSelection() {
  const S = useEnv().pack.samples
  return (
    <Stage>
      <Dialog title="Build" width={420} buttons={<><Key label="OK" /><Key label="Cancel" /></>}>
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
      </Dialog>
    </Stage>
  )
}

function CreateMission() {
  const S = useEnv().pack.samples
  return (
    <Stage>
      <Dialog title="Create Mission" width={460} buttons={<><Key label="Encyclopedia" /><Key label="OK" /><Key label="Cancel" /></>}>
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
      </Dialog>
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
  return (
    <Stage>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
        <Key label="System Finder" state="hover" />
        <Tooltip text="Find a planetary system by name, side or state." />
      </div>
    </Stage>
  )
}

// ---------------------------------------------------------------------------
// Not in the game yet: multiplayer (the look on the whole game)
// ---------------------------------------------------------------------------

const MP_BG = rgb(0.08, 0.1, 0.14)

function MpScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FixedBox name="Screen background" color={MP_BG} note={N.literal} style={{ width: 1024, height: 600, padding: 40, boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 16 }}>
      <Label style={{ fontSize: 28, textAlign: 'center' }}>{title}</Label>
      <div style={{ display: 'grid', gap: 12, alignContent: 'start', maxWidth: 640, justifySelf: 'center', width: '100%' }}>{children}</div>
      <div style={{ ...row, justifyContent: 'flex-end' }}>
        <Key label="Previous" />
        <Key label="Proceed" state="focus" />
        <Key label="Cancel" />
      </div>
    </FixedBox>
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

function MpLocate() {
  return (
    <FixedBox name="Screen background" color={MP_BG} note={N.literal} style={{ width: 1024, height: 600, display: 'grid', placeItems: 'center' }}>
      <Part name="Dialog panel" box="panel" style={{ width: 460, display: 'grid', gap: 8 }}>
        <div style={row}>
          <Label style={{ flex: 1, fontSize: 18 }}>Locate Session</Label>
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
  { id: 'load', name: 'Load Game, Manage Games', status: 'partly', size: [760, 520], Mock: LoadGame, note: 'Only when opened from the Cockpit, whose look they sit in.' },

  { id: 'sector', name: 'Sector window', status: 'not-yet', size: [600, 420], Mock: SectorWindow, note: DRESS },
  { id: 'planet', name: 'Planet Data', status: 'not-yet', size: [520, 420], Mock: PlanetData, note: DRESS },
  { id: 'manufacturing', name: 'Manufacturing and Production', status: 'not-yet', size: [740, 560], Mock: Manufacturing, note: DRESS },
  { id: 'defenses', name: 'System Defenses', status: 'not-yet', size: [640, 380], Mock: Defenses, note: DRESS },
  { id: 'fleet', name: 'Fleet window', status: 'not-yet', size: [720, 360], Mock: FleetWindow, note: DRESS },
  { id: 'missions', name: 'Missions', status: 'not-yet', size: [660, 340], Mock: Missions, note: DRESS },
  { id: 'messages', name: 'Message Index', status: 'not-yet', size: [820, 380], Mock: MessageIndex, note: DRESS },
  { id: 'compose', name: 'Compose Chat Message', status: 'not-yet', size: [540, 300], Mock: ComposeChat, note: DRESS },
  { id: 'encyclopedia', name: 'Galactic Encyclopedia', status: 'not-yet', size: [700, 420], Mock: Encyclopedia, note: DRESS },
  { id: 'system-finder', name: 'Planetary System Finder', status: 'not-yet', size: [460, 400], Mock: SystemFinder, note: DRESS },
  { id: 'personnel-finder', name: 'Personnel Finder', status: 'not-yet', size: [460, 400], Mock: PersonnelFinder, note: DRESS },
  { id: 'fleet-finder', name: 'Fleet Finder', status: 'not-yet', size: [460, 400], Mock: FleetFinder, note: DRESS },
  { id: 'troop-finder', name: 'Troop Finder', status: 'not-yet', size: [460, 400], Mock: TroopFinder, note: DRESS },
  { id: 'character-status', name: 'Character Status', status: 'not-yet', size: [560, 360], Mock: CharacterStatus, note: DRESS },
  { id: 'unit-status', name: 'Unit Status', status: 'not-yet', size: [520, 280], Mock: UnitStatus, note: DRESS },
  { id: 'facility-status', name: 'Defense Facility Status', status: 'not-yet', size: [500, 260], Mock: DefenseFacilityStatus, note: DRESS },
  { id: 'fleet-status', name: 'Fleet Status', status: 'not-yet', size: [500, 280], Mock: FleetStatus, note: DRESS },
  { id: 'status', name: 'Status (missions, queues)', status: 'not-yet', size: [520, 260], Mock: StatusPlate, note: DRESS },
  { id: 'transit', name: 'Confirm Transit', status: 'not-yet', size: [400, 200], Mock: ConfirmTransit, note: DRESS },
  { id: 'game-menu', name: 'Game Menu', status: 'not-yet', size: [360, 280], Mock: GameMenu, note: DRESS },
  { id: 'save', name: 'Save Game', status: 'not-yet', size: [620, 360], Mock: SaveGame, note: DRESS },
  { id: 'overview', name: 'Galaxy Overview', status: 'not-yet', size: [500, 300], Mock: GalaxyOverview, note: GUESS },
  { id: 'objectives', name: 'Objectives', status: 'not-yet', size: [520, 340], Mock: Objectives, note: GUESS },
  { id: 'battle-alert', name: 'Battle Alert', status: 'not-yet', size: [640, 360], Mock: BattleAlert, note: GUESS },
  { id: 'battle-results', name: 'Battle Results, Assault, Bombardment', status: 'not-yet', size: [680, 380], Mock: BattleResults, note: GUESS },
  { id: 'dialogs', name: 'Dialogs (Scrap, Retire, Pause, Leave, Refused…)', status: 'not-yet', size: [900, 480], Mock: Dialogs, note: INSTALL },
  { id: 'build', name: 'Build Selection', status: 'not-yet', size: [760, 480], Mock: BuildSelection, note: INSTALL },
  { id: 'create-mission', name: 'Create Mission', status: 'not-yet', size: [760, 480], Mock: CreateMission, note: INSTALL },
  { id: 'menus', name: 'Popup menus', status: 'not-yet', size: [760, 480], Mock: Menus, note: INSTALL },
  { id: 'tooltips', name: 'Tooltips', status: 'not-yet', size: [760, 480], Mock: Tooltips, note: 'Today a tooltip takes the look only over the screens that follow it (the Cockpit, the map screen). ' + INSTALL },
  { id: 'mp-config', name: 'Multiplayer Configuration', status: 'not-yet', size: [1024, 600], Mock: MpConfig, note: INSTALL },
  { id: 'mp-host', name: 'Host Game', status: 'not-yet', size: [1024, 600], Mock: MpHost, note: INSTALL },
  { id: 'mp-locate', name: 'Locate Session', status: 'not-yet', size: [1024, 600], Mock: MpLocate, note: INSTALL },
  { id: 'mp-options', name: 'Multiplayer Options', status: 'not-yet', size: [1024, 600], Mock: MpOptions, note: INSTALL },

  { id: 'picker', name: 'Pack Picker and its dialogs', status: 'never', why: 'It runs before any pack is loaded, so no pack’s look can reach it. It has its own palette.' },
  { id: 'splash', name: 'Boot splash, movies', status: 'never', why: 'Pictures and films only.' },
  { id: 'cockpit-buttons', name: 'Cockpit (button form)', status: 'never', why: 'Only a pack without a look shows it; a pack with a look gets the campaign dossier instead.' },
  { id: 'cockpit-picture', name: 'Cockpit (picture form)', status: 'never', why: 'Drawn from the pack’s own Cockpit picture, with its own readout and bracket colours in pack.json.' },
  { id: 'credits-plain', name: 'Credits (plain)', status: 'never', why: 'A pack with a look gets the Credits sheet instead.' },
  { id: 'standins', name: 'Stand-in windows (Command Center, Message Index, Sector, Status, Manufacturing, Defenses, Fleet, Missions, finders, Encyclopedia)', status: 'never', why: 'Plain Build Parity: drawn for a pack with no art set and NO look, in the palette in plain_icons.gd. The game turns them off for any pack with a look (art_standins.gd:43).' },
  { id: 'original', name: 'Original-look screens', status: 'never', why: 'The Command Center frame, the original Game Options and saved-games screens, the Galaxy Display and GID Control menus, the opening briefing and the original form of each window are drawn from the player’s art set.' },
  { id: 'tactical', name: 'Tactical display', status: 'never', why: 'Drawn directly by the game in its own colours; no plan names it.' }
]
