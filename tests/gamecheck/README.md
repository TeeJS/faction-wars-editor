# gamecheck: the game itself checks what the editor writes

The editor's unit tests prove it mirrors the game's rules. This check goes further: **the game** validates, imports and plays packs the editor made.

```powershell
.\scripts\gamecheck.ps1
```

The script works on a temporary copy of `TeeJS/faction-wars` and never touches the checkout. Its `user://` is a throwaway folder, deleted afterwards. In order, it:

1. Has the editor write two packs, each through a zip export and back (`tests/gamecheck.test.ts`):
   - the starter, with its sides renamed;
   - a WW2 clone with a planet moved and a unit and a faction renamed.
2. Runs the game's `PackLoader` on the folders (`validate_pack.gd`).
3. Imports the zips with the game's own importer (`pack_import.gd`), then loads each pack from `user://packs` as the pack picker does (`import_check.gd`).
4. Plays each imported pack headless for `-Days` days, with the AI on both sides (`tests/soak.gd`).

`validate_pack.gd` and `import_check.gd` are copied into the temporary game copy only. The handoff (`docs/handoffs/faction-wars.md`, item 1) proposes adding a validator like this to the game repo, so the editor's CI can run it.

First passing run: 2026-09-23. Godot 4.7.1, faction-wars `29ef088`, 20-60 day soaks, no script errors.
