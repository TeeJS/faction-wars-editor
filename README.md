# Faction Wars Pack Editor

A desktop editor for [Faction Wars](https://github.com/TeeJS/faction-wars) **faction packs**. It runs on Windows, Linux and macOS.

With it you can:

- open **any** pack, from a folder or a `.zip`;
- start a **new pack from scratch** from a built-in starter that is already valid and playable;
- edit every field through forms;
- **save** a pack as a folder;
- **export** the `.zip` that the game's pack picker imports.

It follows the tradition of [REBED](https://swrebellion.net/files/file/2-rebed/) and [StarWarsRebellionEditor.NET](https://github.com/MetasharpNet/StarWarsRebellionEditor.NET). The difference is that it edits the Faction Wars pack format (SCHEMA.md), not the original game's `.DAT` files.

## What it does

- **A form for every pack file**
  - Covers factions, galaxy (sectors and planets), characters, units, weapons, facilities, missions, mission tables, rules, side lottery, logistics (day-zero seeding), GID display modes, display settings, and the Cockpit menu.
  - A field that points at another record is a picker, never free text.
  - Every record also has a **Raw JSON** tab for fields the form doesn't know.
- **The galaxy map**
  - The pack's picture is drawn at `map_image_rect`, with sectors and planets on top.
  - Drag a planet to move it. Drag a sector to move it along with all its planets.
  - Shift-click a second planet to see the travel days between them, calculated the way the engine does.
- **Cockpit menu editor:** draw and resize the clickable regions on the menu picture.
- **Rename with references:** renaming an id (a faction, planet, unit, weapon, logistics table and so on) updates every place that uses it. Deleting a record first shows where it is used.
- **The game's own validator, ported line for line**
  - Errors read exactly as the game's pack picker would show them.
  - Warnings cover engine requirements the validator does not check, such as named tables, galaxy sizes, missing matrix cells, and ids the importer refuses.
- **Lossless editing**
  - An untouched file is written back **byte for byte**, and an edit changes only the edited text.
  - Key order, number spelling, unknown fields and line endings are all kept.
  - This matters because the game's multiplayer pack hash covers the raw bytes.
- **Order-aware:** weapon, planet, sector, character and faction order affect the game (combat sums, day-zero random draws), so moving one of them warns you.
- **Safe export**
  - Uses the game's zip layout, with a `manifest.json` that lists a SHA-256 for every file.
  - Checks the result against a copy of the game's importer before writing it.
  - Refuses anything under `original/`, and any file identical to a picture in your art set, so the original game's art never ships in a pack.
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

Packages for your operating system are written to `dist/`:

```powershell
npm run dist:win
```

## Layout

| Path | What |
|---|---|
| `src/core/` | Plain TypeScript with no Electron or DOM: the document model, the validator port, the zip reader and writer, the reference graph, and the New Pack starter |
| `src/core/starter/` | The starter pack, generated from the WW2 pack's numbers by `scripts/make-starter.mjs` |
| `src/main/` | Electron main process: dialogs, file I/O, backups, the menu |
| `src/renderer/` | The React UI |
| `tests/` | Vitest unit tests and Playwright Electron tests (`tests/e2e`) |
| `docs/handoffs/` | Changes the game repo needs, written for another agent to make |

## Versions

Electron is pinned to **44.3.0** and electron-builder to **26.15.3**, matching Bedrock Panel on the same machine. Upgrade both projects together.
