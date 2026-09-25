# Faction Wars Pack Editor — project charter

Signed off by TeeJ on 2026-09-23. The full plan it came from is summarised here; this file is the
contract every change is checked against.

## 0. Modding comes first (TeeJ, 2026-09-25, standing rule)

Star Wars: Rebellion has a **modding culture**, and the original game came with an editor. This
editor exists to give modders full control of their packs. **Never refuse, warn about, strip or
second-guess what a user puts in their pack**, the original game's pictures included. Checks are
only for things that would stop the game loading or playing the pack. If something has a hard
consequence outside the editor, say so once, then let the user decide.

## 1. The one thing it must do

Open any Faction Wars faction pack (a folder or a `.zip`), or start a new one. Edit every field
through forms. Save the pack as a folder, and export a `.zip` that the game's **Import** button
accepts and plays.

## 2. What would be wrong if it shipped "working" without that

- A save or export that the game refuses, or that plays differently from the source. The ways
  this happens:
  - unknown fields dropped;
  - order-sensitive lists reordered (weapons, sectors, planets, characters, factions, logistics
    entries);
  - untouched files reformatted, which matters because the game's pack hash covers raw bytes.
- An editor that only understands the Star Wars pack's shape.

## 3. Off-limits

- **Raw JSON as the only way to edit a field.** Raw JSON is an escape hatch; every schema field
  gets a form control.
- **Depending on Godot or the game's source at runtime.** Players won't have them.
- **Changing the `TeeJS/faction-wars` repo.** Changes it needs go into
  `docs/handoffs/faction-wars.md` for another agent.
- **Exporting while validation errors exist.**
- **Shipping LucasArts art in the editor itself.** The editor's repo and releases carry none. What a
  user's own pack carries is the user's call (section 0).
- **Silently rewriting files that weren't edited.** They are written back byte-for-byte.

## 4. Deployment and backup

- **Deployment:** GitHub Releases on `TeeJS/faction-wars-editor` (public).
  - **Windows x64:** installer and portable build, signed with Azure Trusted Signing (the same
    `sign.js` hook as Bedrock Panel).
  - **macOS arm64 and x64:** `.dmg`, signed and notarized with TeeJ's Apple Developer ID.
  - **Linux x64:** AppImage, `.deb` and `tar.gz`.
- **Backup:**
  - **Code:** git and GitHub.
  - **Pack folders:** before the editor first overwrites an existing pack folder in a session, it
    writes a timestamped backup zip to `Documents/Faction Wars/editor-backups/`.

## 5. How we verify it is done

- **Round-trip:** load each shipped pack and save it with no edits; the output is byte-identical.
  After an edit to one field, only that span differs.
- **Validator parity:** both shipped packs produce zero errors. Every broken-pack case from the
  game's `tests/pack_validation.gd` produces the same message.
- **Zip:** an exported zip passes a copy of the game's `pack_import.gd` checks.
- **End to end:**
  - A pack made from scratch is validated, exported, imported through the game's picker, gets an
    enabled Play button, and plays to day 1.
  - The same holds for the WW2 pack cloned under a new id and edited.
- **UI:** smoke tests (open, edit, save, export) run in CI on Windows, Linux and macOS.

## Stack

- Electron 44.3.0, pinned to match Bedrock Panel, which runs on the same machine.
- electron-builder 26.15.3, electron-vite 5, Vite 7, React 19, TypeScript 6.
- `jsonc-parser` for in-place JSON edits; `fflate` for zips.
- `src/core` is plain TypeScript with no Electron or DOM dependencies, so it can be tested in
  Node and reused elsewhere.
