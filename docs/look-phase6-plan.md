# Look page update: the game's WWII look phases 4–6

Status: **signed off by TeeJ, 2026-09-29 ("go"), and built** on branch `look-phase6`. TeeJ:
"merge it, then update the Look page". Published as an Artifact; this file is the source of
record.

Changes beyond the plan, found while building it:
- **Build Selection and Create Mission** were drawn as dialogs; the game makes them framed
  windows.
- **The code-built windows** (Galaxy Overview, Objectives, the battle windows, Game Options,
  Load Game) have no title bar. They are drawn with their own frames, traded where the game's
  tables say.
- **Plain grey's paper** went from `#d9d9d9` to `#e4e4e4` for the new "signal on paper" pair
  (4.11:1 before, 4.56:1 now).

## What changed in the game (TeeJS/faction-wars main, a46c63f; `docs/ww2-look.md`)

- **The look now reaches every window.** `LookWindow.Install` gives each one the steel frame, then
  trades the plain palette for the look's tokens (`BG_MAP`, `EDGE_MAP`, `TEXT_MAP` in
  `look_window.gd`).
- **Menus, dialogs and tooltips** are dressed by `Look.InstallPopups`:
  - a dialog is a parchment "order sheet" with ink words (`Look.SheetTheme`), over a dim;
  - a menu is an instrument panel;
  - a tooltip is a field note.
- **The Message Index is dispatches** (`look_dispatch.gd`): a ruled ledger with category stamps,
  and the open message as a parchment dispatch. The words come from look.json's new `messages`
  block and the `no_messages` term.
- **The two head-to-head screens** are dressed too.
- **The game's contrast test gained three pairs**: `text_muted` and `heading` on
  `chassis_hover`, and `signal` on `paper`.
- **The capture script takes 23 pictures** (it took 8).
- **Unchanged:** a pack with a look still loses the Star Wars stand-in windows
  (`art_standins.gd:43`).

## The one thing

The Look page shows the game as it is now: every window that follows the look is marked so, and
each is drawn from the game's real code. The new dispatch words can be set on the page.

## Changes

1. **Statuses.** The 34 windows marked "not in the game yet", and Load Game ("partly"), become
   "follows the look now". The "never" list stays as it is: the pack picker, the splash, the
   button and picture Cockpits, the plain credits, the stand-ins, the original-look screens
   including the briefing, and the tactical display.
2. **Mock-ups re-pinned to the real code:**
   - the frame from `look_window.gd` on main (no longer the paused 2bd1b98 draft);
   - window insides through the game's own palette-trade tables, read from its source lines;
   - the Message Index as dispatches;
   - dialogs as parchment order sheets;
   - menus and tooltips as `look.gd` builds them;
   - the two head-to-head screens.
3. **New on the page: the look's `messages`.** You can set:
   - the word over each dispatch;
   - each category's stamp;
   - which categories carry the red band.

   The Message Index mock-up follows these. Rule 31 already checks them (#12). The empty
   category's words are the `no_messages` term on Display Settings.
4. **The three new contrast pairs** go into the contrast panel. Both presets are checked
   against them; if one fails, its colour is adjusted and the new value is shown.
5. **In the game** shows all 24 pictures (the specimen sheet plus the script's 23), each
   captioned.
6. **The word-list test also checks `look.gd`**: `CONTRAST_PAIRS`, `DEFAULT_SIZES` and
   `DEFAULT_METRICS`.

## Off-limits

- Editing TeeJS/faction-wars.
- Anything for the Star Wars game (on hold).
- Merging without TeeJ's word.

## Target

Branch `look-phase6` in `D:\Github\faction-wars-editor-look`, from the editor's main d3b939d.
One PR.

## Done when

1. Every part of every mock-up still names where its colour comes from (UI test).
2. Every source line the mock-ups use is in the game's main (theme test).
3. Edits to `messages` save byte-exact and pass rule 31.
4. The real render shows 24 pictures.
5. The full gamecheck still passes.
6. TeeJ looks.
