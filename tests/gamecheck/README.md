# gamecheck: the game itself checks what the editor writes

The editor's unit tests prove it mirrors the game's rules. This check goes further: **the game** validates, imports and plays packs the editor made.

```powershell
.\scripts\gamecheck.ps1
```

The script works on a temporary copy of `TeeJS/faction-wars` and never touches the checkout. Its `user://` is a throwaway folder, deleted afterwards. In order, it:

1. Has the editor write its packs (`tests/gamecheck.test.ts`):
   - the starter, with its sides renamed, through a zip export and back;
   - a WW2 clone with a planet moved and a unit and a faction renamed, the same way;
   - deliberately broken packs, each with the errors the editor reports for it (`parity/<id>.expected.txt`).
2. Runs the game's own validator, `tests/validate_pack.gd` (game PR #165), on the good packs.
3. Runs it on the broken packs. It must print exactly the editor's errors, in the same order.
4. Imports the zips with the game's own importer (`pack_import.gd`), then loads each pack from `user://packs` as the pack picker does (`import_check.gd`).
5. Plays each imported pack headless for `-Days` days, with the AI on both sides (`tests/soak.gd`).

`import_check.gd` is copied into the temporary game copy only.

First passing run: 2026-09-23. Godot 4.7.1, faction-wars `29ef088`, 20-60 day soaks, no script errors.
