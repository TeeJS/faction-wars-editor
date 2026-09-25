# Faction Wars Pack Editor

A desktop editor for [Faction Wars](https://github.com/TeeJS/faction-wars) **faction packs**. It runs on Windows, Linux and macOS.

With it you can:

- open **any** pack, from a folder or a `.zip`;
- start a **new pack from scratch** from a built-in starter that is already valid and playable;
- edit every field through forms;
- **save** a pack as a folder;
- **export** a `.zip` to add to the game: drag it onto the game's first screen, or use the **+** card (Add your own pack).

**Modding comes first.** Star Wars: Rebellion has always had a modding culture, and the original game came with an editor. Your pack is yours: the editor never refuses, strips or second-guesses what you put in it. The only thing it stops is an export the game couldn't load.

It follows the tradition of [REBED](https://swrebellion.net/files/file/2-rebed/) and [StarWarsRebellionEditor.NET](https://github.com/MetasharpNet/StarWarsRebellionEditor.NET). The difference is that it edits the Faction Wars pack format (SCHEMA.md), not the original game's `.DAT` files.

## Download

Get the latest version from the [Releases page](https://github.com/TeeJS/faction-wars-editor/releases/latest).

| System | File | Notes |
|---|---|---|
| Windows | `faction-wars-editor-<version>-setup.exe` | Installer. Or `-portable.exe` to run without installing. Signed. |
| macOS, Apple Silicon (M1 and later) | `faction-wars-editor-<version>-mac-arm64.dmg` | Signed and notarized. |
| macOS, Intel | `faction-wars-editor-<version>-mac-x64.dmg` | Signed and notarized. |
| Linux | `.AppImage` (any distribution), `.deb` (Debian, Ubuntu) or `.tar.gz` | Not signed. |

## What it does

- **A form for every pack file**
  - Covers the pack itself (including its launch screen card picture), factions, galaxy (sectors and planets), characters, units, weapons, facilities, missions, mission tables, rules, side lottery, logistics (day-zero seeding), GID display modes, display settings, and the Cockpit menu.
  - A field that points at another record is a picker, never free text.
  - Every record also has a **Raw JSON** tab for fields the form doesn't know.
- **The galaxy map**
  - The pack's picture is drawn at `map_image_rect`, with sectors and planets on top.
  - Drag a planet to move it. Drag a sector to move it along with all its planets.
  - Shift-click a second planet to see the travel days between them, calculated the way the engine does.
- **Cockpit menu editor:** draw and resize the clickable regions on the menu picture, and drag the four corners of a screen seen at an angle so the selection brackets follow it. The monitor pictures (animated strips) have their own form, with a preview of each strip's first frame.
- **Modding the built-in packs:** "Make my own copy" copies the open pack under an id of your own and saves it as a new folder. The copy sits beside the original in the game's launch screen and exports as a zip anyone can add. (The game always uses its built-in pack when two share an id, so a mod needs its own.)
- **Pictures on every character, unit, facility, mission and planet**
  - Each picture slot (Encyclopedia, portrait, miniature, mission pictures per side, planet sprite) shows the picture the game would use and whether it comes from this pack or from your art set.
  - **Add my own** puts a PNG where the game looks first (`art/…`), overriding the art set's picture.
  - Encyclopedia text is edited beside the pictures (`art/descriptions.json`).
  - Any picture can go in a pack. What a pack carries is its author's call; the editor doesn't check pictures. (The game's own importer currently refuses a zip that carries the original game's pictures. That rule is the game's, not the editor's.)
  - The editor finds your art set in `Documents/Faction Wars` and in the game's own data folder, or wherever you point it on the Pack page.
- **Rename with references:** renaming an id (a faction, planet, unit, weapon, logistics table and so on) updates every place that uses it. Deleting a record first shows where it is used.
- **The game's own validator, ported line for line**
  - Errors read exactly as the game's own validator prints them. The editor's tests check this against the real game.
  - Warnings cover things the game accepts but that play wrong, such as missing mission tables, missing matrix cells, and ids the importer refuses.
  - Keys starting with `_` (`"_comment"`) are notes, never data, anywhere in a pack, as in the game.
- **Lossless editing**
  - An untouched file is written back **byte for byte**, and an edit changes only the edited text.
  - Key order, number spelling, unknown fields and line endings are all kept.
  - This matters because the game's multiplayer pack hash covers the raw bytes.
- **Order-aware:** weapon, planet, sector, character and faction order affect the game (combat sums, day-zero random draws), so moving one of them warns you.
- **Safe export**
  - Uses the game's zip layout, with a `manifest.json` that lists a SHA-256 for every file.
  - Runs the game's import checks before writing it, including its validator pass, so an export the editor calls good is one the game loads.
- **Backups:** before the editor first overwrites a pack folder in a session, it saves a zip copy to `Documents/Faction Wars/editor-backups/`.

## Build from source

You need Node 22.12 or newer (developed on Node 24 and 26), and a checkout of `TeeJS/faction-wars` next to this repo for the tests that use the shipped packs.

```powershell
npm install
```

```powershell
npm run dev
```

Tests: unit tests (core, validator parity, zip, starter), then the UI smoke tests, which drive the built app.

```powershell
npm test
```

```powershell
npm run build; npx playwright test
```

Packages are written to `dist/`. Run the one for your operating system: `npm run dist:win`, `npm run dist:mac` or `npm run dist:linux`.

```powershell
npm run dist:win
```

**The game itself checks the editor's output.** This script has the real game validate, import and play (headless, AI on both sides) packs the editor wrote. It also has the game's validator check deliberately broken packs and print exactly the errors the editor shows. It works on a temporary copy of the game project and never touches your checkout; `tests/gamecheck/README.md` has the details. CI runs it too.

```powershell
.\scripts\gamecheck.ps1
```

## Releases

1. Bump `version` in `package.json`, then push a tag with the same number, e.g. `v0.1.3`. The Release workflow builds and signs all three platforms (macOS notarized, Windows with Azure Artifact Signing), then creates a **draft** release.
2. Review the draft on GitHub and publish it.

`docs/RELEASING.md` has the details, including the one-time setup and a fallback for signing Windows on a PC.

## Layout

| Path | What |
|---|---|
| `src/core/` | Plain TypeScript with no Electron or DOM: the document model, the validator port, the zip reader and writer, the reference graph, and the New Pack starter |
| `src/core/starter/` | The starter pack, generated from the WW2 pack's numbers by `scripts/make-starter.mjs` |
| `src/main/` | Electron main process: dialogs, file I/O, backups, the menu |
| `src/renderer/` | The React UI |
| `tests/` | Vitest unit tests, Playwright Electron tests (`tests/e2e`) and the game check (`tests/gamecheck`) |
| `scripts/` | The game check, the starter and icon generators, and the fallback Windows release script |
| `build/` | Packaging: the icon, macOS entitlements and the notarization check |
| `PROJECT.md` | The project charter: what the editor must do, and what is off-limits |
| `docs/RELEASING.md` | How releases are built, signed and published |
| `docs/handoffs/` | Changes the game repo needs, written for another agent to make |

## Versions

Electron is pinned to **44.3.0** and electron-builder to **26.15.3**, matching Bedrock Panel on the same machine. Upgrade both projects together.

## License

[MIT](LICENSE).
