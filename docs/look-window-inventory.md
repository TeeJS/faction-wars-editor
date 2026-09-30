# Faction Wars window inventory and colour-token map

Read from `TeeJS/faction-wars` `origin/main` at b21212c on 2026-09-28. Read-only.
The Look page's mock-ups (`src/renderer/src/look/mock`) and their token mapping come from this
file. It was written for the Faction Wars UI Builder, the app the Look page came from.

## Update: origin/main 4ad04bf (2026-09-29, the WWII look phase 8: the sector window)

The **Sector window (#29) is a theatre plate** for a pack with a look (`src/ui/look_sector.gd`,
one pass at the end of `sector_window.gd` Populate). It keeps every element where it was:
- the ground: the theatre cut from the sharpest picture that holds it (a look.json `map_insets`
  entry, else `textures.map_detail`, else the map picture) under a paper wash at 0.58, framed in
  brass_dim; a plotting sheet (paper, an ink_muted grid every 40 px) where the picture would need
  more than 4 times magnification;
- a system: its holder's factions.json colour with a 2 px ink rim, or a paper disc with an ink ring;
  the hidden HQ's ring in brass;
- its name: body_bold at 15 px, the holder's colour darkened until it reads 4.5:1 on paper (ink when
  unheld), with a paper halo;
- the corner icons: ink (an uprising's signal) on paper tabs edged in the icon's tint;
- the bars: energy ink, raw materials olive, free squares paper, all ink-edged; the loyalty bar in the
  sides' factions.json colours with an ink edge; the GID star rimmed in ink.

The Look page draws it from the game's own numbers and lines (`src/core/look/sector.ts`,
`theme.ts` SECTOR), with a picker for the theatre. Its layout and cut match the game's for all
twenty WWII theatres (`tests/look/sector.test.ts`).

## Update: origin/main a46c63f (2026-09-29, the WWII look finished: phases 4-6)

The look now reaches every window: see the game's `docs/ww2-look.md`. The "not in the game yet"
windows below all follow the look now, and the Look page draws them from the game's own code:
- **Every window** is dressed from one hook, `LookWindow.Install` (`src/ui/look_window.gd`):
  - a window with the scene template's `TitleBar` gets the steel frame;
  - every window has its plain palette traded for the look's tokens (`BG_MAP`, `EDGE_MAP` and
    `TEXT_MAP`, matched within 0.015);
  - colours with a meaning (damage red, ready green, gold, cyan) are kept.
- **Code-built windows without a title bar** get only the theme and the trade: Galaxy Overview,
  Objectives, Battle Alert, Battle Results, Game Options and Load Game. Battle Alert keeps its
  own dark red frame, because the tables do not list it.
- **Menus, dialogs and tooltips** are dressed by `Look.InstallPopups`:
  - a dialog is an order sheet (`Look.SheetTheme`): parchment, ink, OK and Cancel as command
    keys, and a dim when it is modal;
  - a menu is an instrument panel;
  - a tooltip is a field note.
- **The Message Index is dispatches** (`src/ui/look_dispatch.gd`): a ledger with category
  stamps and a parchment dispatch. Its words come from look.json `messages` (rule 31) and the
  `no_messages` term.
- **The four head-to-head screens** are dressed by `LookWindow.DressScreen`.
- **Build Selection and Create Mission** are framed windows (DraggableWindow), not dialogs.
- **Unchanged:** the stand-ins are still off for a pack with a look (`art_standins.gd:43`), and
  the opening briefing is not dressed.

## Update: origin/main 86d689b (2026-09-28, Plain Build Parity phases 1-3)

PRs #385-#387 added `src/ui/art_standins.gd` and `plain_icons.gd`. A pack with
no art set now draws our stand-ins in place of the original's pictures, so these
windows get the original's layout without the art:
- the Command Center frame (#22);
- the Message Index (#35);
- the Sector window (#29).

The stand-ins' palette is fixed in code (`plain_icons.gd`: Plate `#3b3b3b`, BevelLight `#5c5c5c`,
Well `#141414`, Band `#2d2d2d`, LabelColor `#dfdfdf`, Count `#ffff00`; sides red and green),
not read from `look.json`.

**`ArtStandins.Active()` is false for a pack with a look** (`art_standins.gd:43`). A pack
that ships `look.json` therefore does not get the stand-in windows: it keeps the look's map
shell and the plain windows. So giving the Star Wars pack a `look.json` today would turn its
new stand-in Command Center, Message Index and Sector window off.

None of the look files changed (`look.gd`, `look_hud.gd`, `pack_loader.gd`, `packs/ww2/look.json`,
SCHEMA.md).

**origin/main f09a97c (2026-09-29, parity phases 4-5, PRs #388-#389)** added stand-in forms
for more windows:
- the Status windows (#42-#46);
- Manufacturing and Production (#31);
- System Defenses (#32);
- the Fleet window (#33);
- Missions (#34).

The rule is unchanged (`art_standins.gd:43`): none of these stand-ins appear for a pack with a look.

**origin/main 248a69c (parity phase 6, #390)** added the finders (#38-#41) and the
Encyclopedia (#37). The look files are still unchanged.

## Key facts

1. **No `.tscn` file tags anything.** No scene sets `theme_type_variation` or defines a StyleBox.
   Every piece tag is set in GDScript, in four files: `cockpit_dossier.gd`, `credits_window.gd`,
   `look_hud.gd` and `gid_bar.gd`.
2. **The game never calls `Look.Install()`.** Only `tests/look_system.gd` and
   `tests/capture_look_specimen.gd` call it. The theme is attached locally in these places only:
   - `Menu` (`cockpit_dossier.gd:27`)
   - `gid_bar._panel` (`gid_bar.gd:117`)
   - the GID key (`gid_key.gd:44`)
   - the HUD nodes (`look_hud.gd:42,57,73,82,101,118`)
3. **Every in-game window, dialog and popup keeps its literal scene colours, even in WWII.**
   `look_hud.gd:14-16`: "The theme is put on these surfaces alone: the windows keep their own
   until their phase." Phases 4 (Messages), 5 (Menus, dialogs, tooltips) and 6 (Remaining
   windows) of `docs/ww2-look-plan.md` are not done.
4. **Six of the 16 pieces are defined but unused**: LookInset, LookTitleBar, LookTitle,
   LookChip, LookChipAlert and LookModal. The ten in use are Panel, Command, Rail, Row,
   Heading, Divider, Document, Ink, Typed and Launch.
5. **`src/ui/look_window.gd` is not on main.** It is on the paused `ww2-look-messages` branch
   (2bd1b98). Its `Dress(window)` does the following:
   - puts the theme on the window;
   - draws the frame as `Box(chassis, brass_dim, 1, 0, 0)`;
   - colours the title bar `chassis_deep`, with a 1 px `brass_dim` rule under it and a minimum height of 26;
   - sets the title in the `display` face at size `title`, colour `text`, upper case;
   - makes Minimise and Close into `LookCommand` keys at size `small`;
   - colours the body `chassis`.

## The shared window frame today (literal colours)

About 20 DraggableWindow scenes copy the same frame:
- a Godot-default PanelContainer;
- a `TitleBar` ColorRect `Color(0.18,0.22,0.28)`;
- the default "_" and "X" buttons;
- a body ColorRect `Color(0.121569,0.160784,0.215686)` (`(0.12,0.16,0.21)` in the finders and the Encyclopedia);
- field labels in `(0.6,0.7,0.8)`.

The code-built "blue panel" (the GID bar, GID key, Galaxy Overview and Objectives) has
background `(0.06,0.08,0.13,0.94-0.97)` and border `(0.40,0.62,0.92,0.85)`.

## Inventory

**Look:** Y = follows the look now, N = does not yet, never = cannot take a pack's look.
**Art:** whether the window has an original-look (art set) form.

| # | Name | Built by | Look | Art |
|---|---|---|---|---|
| 1 | Boot splash | `project.godot` | never | no |
| 2 | Pack Picker | `pack_picker.gd` (own palette :66-75, own tooltip theme :748) | never (runs before a pack loads) | no |
| 3 | Pack Picker dialogs: Remove pack, Import result, artwork and movies / Manage files, Importing | `pack_picker.gd` `_modal` :1118, `_confirm` :1231, `_tell` :1254, `_open_art_window` :1309, `_on_progress` :1674 | never | no |
| 4 | Movies | `movie_player.gd`, `movies.gd` | never | only with imported movies |
| 5 | Cockpit, button form | `Menu.tscn`, `menu.gd` (bg `(0.08,0.1,0.14)`, labels `(0.6,0.7,0.8)`, BtnAlliance `(1,.3,.3)`, BtnEmpire `(.3,.8,.3)`) | N (a pack with a look gets #6 instead) | picture form #7 |
| 6 | Cockpit, campaign dossier form | `cockpit_dossier.gd` | **Y**: Heading, Document, Typed, Ink, Panel, Command, Launch, Divider | n/a |
| 7 | Cockpit, picture form | `menu.gd` `_build_cockpit` | never (pack colours `Readout.ColorHex`, `SelectedColorHex`) | yes |
| 8 | Credits, plain | `credits_window.gd` `_init` | N | movie |
| 9 | Credits sheet | `credits_window.gd` `_build_sheet` | **Y**: Document, Typed, Command, Divider; overlay, ink, ink_muted | movie |
| 10 | Load Game | `load_game_window.gd` | partly: only when opened from the Cockpit (inherits its theme) | `original_options_screen.gd` |
| 11 | All Saved Games / Manage Games | `all_games_window.gd` | partly, as #10 | `original_all_games_screen.gd` |
| 12 | Game Options screen (original) | `original_options_screen.gd` | never | art only |
| 13 | See all games (original) | `original_all_games_screen.gd` | never | art only |
| 14 | Multiplayer Configuration | `mp/MultiplayerConfiguration.tscn` | N | `original_mp` |
| 15 | Host Game | `mp/HostGame.tscn` | N | `original_mp` |
| 16 | Locate Session | `mp/LocateSession.tscn` | N | `original_mp` |
| 17 | Multiplayer Options (pages 1-2) | `mp/MultiplayerOptions.tscn` | N | `original_mp` |
| 18 | MP bottom bar | `mp/MpBottomBar.tscn` | N | `original_mp` |
| 19 | MP notice; Get the pack | `mp/mp_screen.gd:30`, `mp/get_pack_dialog.gd` | N | no |
| 20 | Map screen HUD, plain | `Main.tscn`, `ui_manager.gd`, `game_manager.gd` | N (see #21) | Command Center #22 |
| 21 | Map screen HUD, look | `look_hud.gd` `Apply` | **Y**: Panel, Rail, Row, Command | skipped under #22 |
| 22 | Command Center frame | `command_frame.gd`, `ui_manager.gd` `BuildCommandFrame` :157 | never | art only |
| 23 | Galaxy map | `galaxy_map.gd` | **Y**: names, flares, HQ burst, bezel | yellow names |
| 24 | GID selector bar and mode name | `gid_bar.gd` `ApplyLook` :112 | **Y**: Command keys, `Edged(chassis,brass_dim)`, SideColor | hidden under art |
| 25 | Map key (GID key) | `gid_key.gd` | **Y**: `Box(chassis,brass_dim)`, heading, text | `original_gid_key.gd` |
| 26 | Galaxy Display menu; GID Control menu | `gid_menu.gd`, `gid_control_menu.gd` | never | art only |
| 27 | Opening briefing | `briefing.gd` | never | art only |
| 28 | Feedback box | `feedback_panel.gd` | partly (base styles; title `(0.6,0.7,0.8)` and status `(0.55,0.6,0.65)` stay) | no |
| 29 | Sector window | `SectorWindow.tscn`, `sector_window.gd` | N (**Y since 4ad04bf**: a theatre plate, `look_sector.gd`) | `_BuildOriginalChrome` :106 |
| 30 | Planet Data | `PlanetWindow.tscn` | N | no |
| 31 | Manufacturing and Production | `EconomyWindow.tscn` (queue header `(0.2,0.6,0.2)`, destination `(0.5,0.7,1)`) | N | `_BuildOriginal` :232 |
| 32 | System Defenses | `DefenseWindow.tscn` | N | `_BuildOriginal` :349 |
| 33 | Fleet window | `FleetWindow.tscn` | N | `_BuildOriginal` :811 |
| 34 | Missions | `MissionWindow.tscn` | N | `OriginalMissionWindow.tscn` |
| 35 | Message Index | `MessageWindow.tscn` (unread WHITE, read GRAY, subject `(0.6,0.9,0.6)`) | N | `_can_build_original` :730 |
| 36 | Compose Chat Message | `ComposeChatMessageWindow.tscn` | N | Message window compose view |
| 37 | Galactic Encyclopedia | `EncyclopediaWindow.tscn` | N | `_can_build_original` :324 |
| 38 | Planetary System Finder | `PlanetFinder.tscn` | N | `_BuildOriginal` :100 |
| 39 | Personnel Finder | `PersonnelFinder.tscn` | N | `_BuildOriginal` :223 |
| 40 | Fleet Finder | `FleetFinder.tscn` | N | `_BuildOriginal` :140 |
| 41 | Troop Finder | `TroopFinder.tscn` | N | `_BuildOriginal` :142 |
| 42 | Character Status | `CharacterStatusWindow.tscn` | N | Status plate |
| 43 | Unit Status | `UnitStatusWindow.tscn` | N | Status plate |
| 44 | Defense Facility Status | `DefenseFacilityStatusWindow.tscn` | N | Status plate |
| 45 | Fleet Status | `FleetStatusWindow.tscn` | N | Status plate |
| 46 | Status (mission, queue) | `StatusPlateWindow.tscn` `_paint_plain` | N | `OUI.StatusPlate` |
| 47 | Confirm Transit | `TransitConfirmWindow.tscn` | N | no |
| 48 | Game Menu | `InGameMenuWindow.tscn` | N | original Game Options |
| 49 | Save Game | `game_options_window.gd` | N | `original_options_screen.gd` |
| 50 | Scrap / Retire confirmation | `ConfirmationDialog` (`economy_window.gd:1178`, `fleet_window.gd:740,1288`, `draggable_window.gd:977`) | N | `ConfirmWindow.tscn` |
| 51 | Build Selection | `ConfirmationDialog` (`economy_window.gd:993`) | N | `BuildSelectionWindow.tscn` |
| 52 | Create Mission | `draggable_window.gd:316` | N | `CreateMissionWindow.tscn` |
| 53 | Galaxy Overview | `galaxy_overview_window.gd` (blue panel) | N | no |
| 54 | Objectives | `objectives_window.gd` (blue panel) | N | no |
| 55 | Battle Alert | `battle_alert_window.gd` (bg `(0.09,0.05,0.06,.98)`, border `(0.90,0.35,0.30,.95)`) | N | `original_battle.gd` |
| 56 | Battle Results / Assault / Bombardment | `battle_results_window.gd` (bg `(0.06,0.07,0.11,.98)`, border `(0.55,0.70,0.95,.9)`) | N | `_BuildOriginal` :395 |
| 57 | Tactical display | `tactical_view.gd` `_draw` | N | no |
| 58 | Pause | `game_manager.gd:442` | N | `_BuildOriginalPause` :597 |
| 59 | Leave Game; Waiting for opponent; Game can't continue | `game_manager.gd` :904, :952, :933 | N | `_OriginalAlert` :861 |
| 60 | Order Refused; Mission Refused; No Mission Available; Evacuation Losses | `ui_manager.gd:2164`, `draggable_window.gd:534,370`, `ui_manager.gd:2107` | N | advisor for No Mission |
| 61 | Popup menus (character, unit, fleet, ship, bombard, economy, planet, sector corner, mission tile, sector pin, Agent, Messenger, GID categories, Speed) | see `draggable_window.gd`, `fleet_window.gd`, `economy_window.gd`, `planet_window.gd`, `sector_window.gd`, `ui_manager.gd`, `gid_bar.gd`, `game_manager.gd` | N (Godot default PopupMenu) | `OriginalMenu.Style` |
| 62 | Tooltips | Godot | only under a themed node (#6, #9, #21, #24, #25) | no |

## Where each token shows (look.gd `_build` :297-518, plus direct calls)

- **chassis**: the Panel/PanelContainer body; disabled key; tab_disabled; LineEdit read_only;
  TabContainer panel; AcceptDialog panel; embedded Window frame; LookPanel; LookModal;
  `Edged` backing of the GID bar; GID key panel. Paused window dress: frame and body.
- **chassis_deep**: PopupMenu panel; LineEdit; ItemList; scroll track; ProgressBar background;
  LookInset; LookTitleBar; the Command key's bottom edge; LookChip; the Cockpit background
  and vignette; the ops strip and console backing; the running speed chip; the map bezel.
  Paused window dress: title bar.
- **chassis_raised**: key; tab_unselected; Command; Rail.
- **chassis_hover**: key hover; CheckBox hover; ItemList hovered; tab_hovered; Command, Rail
  and Row hover.
- **edge**: key borders; Panel; LineEdit; ItemList; TabContainer; ProgressBar; Inset; Command;
  the Row hairline; Chip.
- **brass**: pressed key border; focus ring; LineEdit focus and caret; selected ItemList, tab,
  rail and row edges; scrollbar grabber highlight; Command pressed; Launch plate border;
  the Cockpit checkbox tick; the unread count badge.
- **brass_dim**: key hover border; PopupMenu border and separator; TooltipPanel border;
  scrollbar grabber; VSeparator; the rule fallback; Window frame; LookPanel border;
  TitleBar edge; Command hover; Modal border; the ops strip, console, speed chip, GID bar
  and map key edges; the map bezel. Paused window dress: frame border and title-bar rule.
- **text**: all Button, Label, RichTextLabel, PopupMenu, LineEdit, ItemList, tab and
  ProgressBar text; the Window title; LookTitle; Row; resource readouts; map-key rows;
  the Cockpit checkbox frame. Paused window dress: window title.
- **text_muted**: PopupMenu accelerator; LineEdit placeholder; unselected tab; the speed
  readout; the Cockpit build version.
- **text_disabled**: disabled text on keys, menus and tabs.
- **heading**: PopupMenu separator text; LookHeading; the map-key title.
- **paper**, **paper_edge**: the flat document fallback (with a `paper_frame` texture the
  texture is used instead); the lamp glow; the map-name outline; the dossier map-plate frame.
- **ink**: LookInk; LookTyped; the credits text; the campaign name; the map names; the HQ
  burst; the flare rims; the bezel line.
- **ink_muted**: the dossier map plate and caption; the credits "what", changes and empty lines; link hover.
- **khaki**: ProgressBar fill (no themed progress bar is on screen yet).
- **olive**: Launch plate hover and pressed.
- **olive_deep**: pressed key; PopupMenu hover; LineEdit selection; selected ItemList, tab,
  rail and row fill; Command pressed; Launch plate.
- **signal**: LookChipAlert (unused); the paused speed chip.
- **signal_text**: contrast pairs only; nothing in the game uses it yet.
- **note**, **note_ink**: tooltip panel and text.
- **overlay** (with `overlay_alpha`): the dim behind the Credits sheet (`Look.Dim()`).
- **sides**: the Launch plate's side band; the GID mode name; the fallback is `factions.json`.

**Fonts:**
- `body`: the theme default and tooltips.
- `body_bold`: RichText bold and the credits asset titles.
- `display`: the Window title, Title, Command, Rail, Heading, the Day label, the GID mode
  name and the map-key title.
- `display_bold`: Launch, the campaign name, the credits title, the map names and the unread badge.
- `typed`: the dossier caption only.
- `typed_bold`: Typed.

**Sizes:**
- `body`: the default.
- `small`: tooltips, the speed readout and the dossier caption.
- `label`: Command, Rail, Typed and the readouts.
- `title`: the Window title and LookTitle.
- `heading`: Heading, Launch and the Day label.
- `display`: the campaign name only.
