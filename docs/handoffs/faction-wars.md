# Handoff: changes the `TeeJS/faction-wars` repo needs

**Written:** 2026-09-23, by the agent building `TeeJS/faction-wars-editor`. That agent may not change `faction-wars` (TeeJ's rule), so everything below is for another agent.

**Before starting:** confirm each item against the current code; line numbers are as of `29ef088`. Get TeeJ's go-ahead per item. Use your own worktree, stage paths explicitly with `git add`, and put no session links anywhere.

## 1. A headless validator that takes a folder (recommended; highest value)

**Why:** the editor has a TypeScript port of `PackLoader._validate` (`src/core/validate.ts`) and a port of `tests/pack_validation.gd`. To prove the two stay in step, the editor's CI should run the game's real validator against packs the editor writes. Today nothing can:

- `tests/pack_loads.gd` only walks `res://packs` (`:9`).
- The game has no `--validate` flag.

**Change:** add `tests/validate_pack.gd`.

- `extends SceneTree`.
- Read `--dir=<absolute folder>` from `OS.get_cmdline_user_args()`.
- Call `PackLoader.Load(dir, errors)`.
- Print each error on its own line, prefixed `[validate_pack] `.
- `quit(0)` when there are no errors, `quit(1)` otherwise.

It is about 20 lines, and `PackLoader.Load` already accepts absolute OS paths. Usage:

```powershell
.\tools\run-gd.ps1 tests/validate_pack.gd -- --dir=D:\path\to\pack
```

The editor's CI would then do three things: check out this repo, download Godot 4.7.x headless, and run the script against the starter pack and an edited WW2 copy.

## 2. The importer installs packs the loader will refuse

In `src/ui/pack_import.gd`, `_import`, around `:161-189`:

- **It does not check that `manifest.id` equals `pack.json`'s `id`.** It installs to `user://packs/<manifest id>`, and rule 1 then fails on every load, so the pack shows up as a broken card with no explanation at import time.
- **It does not run `PackLoader.Load` before installing.**

**Suggested fix:** after the leak check, parse `contents["pack.json"]` and refuse when its `id` differs from the manifest's. Optionally, also validate from the `.importing` staging folder and refuse with the first errors. Note that rule 1 compares the id with the folder name, so staging would need to be named after the id.

**Minor:** the `original/` check is case-sensitive (`begins_with("original/")`), but `PackBuilder.cs` checks case-insensitively. `Original/x.png` gets past the importer.

## 3. The WW2 pack's credits are never shown

`packs/ww2/pack.json` has its credits at the top level (`"credits": [...]`). The game reads credits only from `menu.credits` (`menu.gd:163`), and WW2 has no `menu`, so the credits screen says "(this pack declares no credits)".

**Fix options:**

- read a top-level `credits` when there is no menu; or
- move WW2's credits under a `menu` (which WW2 doesn't have).

The first is the smaller change.

## 4. `_comment` keys inside keyed maps are read as data

`JsonUtil` skips `_`-prefixed keys only in `display.json` `terms` and `icons` (`pack_defs.gd:910, 925`). Anywhere else, a `_comment` becomes a stat, rating, weapon, flag, table or logistics entry. The worst case is `mission_tables.tables`, where `MissionTableDef.from_dict` expects a Dictionary.

**Suggested fix:** skip `_`-prefixed keys in every keyed-map hydrator. The editor already warns about them.

## 5. Stale parts of SCHEMA.md

| Where | What's wrong |
|---|---|
| Title | Still says "DRAFT". |
| §2 example (`:69-100`) | Uses `galaxyShaded.bmp` / `cockpit.png` and old rects, with no `art_sets`. The SWR pack now uses art-set references. |
| `:31-32` | Says "missing required fields are a load error". That is only true where a validator checks the field; elsewhere a missing key takes the default. |
| Facilities example | Shows `family: 34` (an int), but `family` is a **string**. A unit-roles row (`:289`) sits in the facilities table. |
| Units example | Shows `family`, `roles:["capital_ship"]`, and weapons inside `stats`. Real units use `kind`, `roles` limited to `superweapon`/`garrison_troop`, and a separate `weapons` map with `arcs`/`amount`/`range`. |
| Weapons | Documents a per-weapon `range`. Real data has `observed_ranges`, which nothing reads; range is set per unit. |
| `mission_tables.json` | Says "12 tables" with `{field1, entries_count, info}`. The real shape is `{"tables":{id:{source_file, description, entries:[{id, field2, threshold, value}]}}}`, with 20+ tables. |
| `rules.json` | Shows one row object; the file is a top-level array. |
| `setup.json` logistics | The entry fields are undocumented: `Type`, `Description`, `Entries`, `fixed_range`, `ParentId`, `ProbabilityThreshold`, `SpawnChancePercent`, `Multiplier`, `ChildrenCount`, `Asset`/`Assets`. |
| §11 | Rules 11 and 12 are defined inline (`:115`, `:513`) but missing from the numbered list. There is a stray `---` at `:729`. Rules 3 and 5 are marked "⚠ partial", but the code implements them fully. |

**Unwritten engine requirements the doc should state** (the editor warns on each):

- The logistics tables `core_system_facilities` and `rim_system_facilities`.
- The mission tables `foil`, `decoy`, `troop_decoy`, `evasion`, `escape`, `informants` and `uprising_start`.
- `galaxy_sizes` must have exactly three entries (they index `Enums.GalaxySize`).
- With `seed` present, `hq_facilities`, `hq_garrison` and `fleet` must all be filled.
- An empty `available_to` means nobody can run the mission.

## 6. Loader message nits (`src/data/pack_loader.gd`)

- `:5` says validation is "SCHEMA.md section 9"; it is section 11.
- `:191`: "hq.placement (a planet name or 'random_rim')" should say a planet **id**.

The editor copies these messages verbatim. Change both sides together; the editor's parity test will flag any difference.

## 7. Low priority: line endings and the pack hash

`FactionRegistry.ContentHash` hashes the raw bytes of the 12 JSON files. Packs are stored with LF in git, but with `core.autocrlf=true` a Windows checkout has CRLF. So a build exported on Windows and one built on Linux CI hash the same pack differently.

**Fix:** a `.gitattributes` line such as `packs/**/*.json text eol=lf` makes the bytes identical everywhere. Check first whether multiplayer ever mixes builds from different machines.
