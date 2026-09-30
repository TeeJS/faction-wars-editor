# Plan: the Sector window mock-up as a theatre plate

TeeJ, 2026-09-29: "merge it, then update the sector window mock-up".
The game's WWII look phase 8 (game main 4ad04bf, `src/ui/look_sector.gd`) redrew the sector
window for a pack with a look. The Look page's mock-up still shows the old dark window.

## Charter

1. **The one thing:** the Look page's Sector window mock-up draws a theatre the way the game now
   does: the pack's own map (or its detail copy or inset) under a parchment wash, with every system
   in its place, all in the look's colours.
2. **Wrong without it:** a mock-up that looks right but ignores the pack's `map_detail` and
   `map_insets`, or puts systems where they aren't. A modder couldn't check their map on it.
3. **Off-limits:** a made-up layout; a screenshot or stored picture of the game; any change to the game.
4. **Target and backup:** faction-wars-editor, a new PR (branch `look-sector`). Git is the backup.
5. **Done when:**
   - a unit test ports the game's own `tests/look_sector.gd` check: WWII's 20 theatres are all maps, the 5 small European ones cut from the inset, the rest from the detail map;
   - a UI test shows the plate, and the theatre picker switches it;
   - it matches the game's own screenshots side by side (`docs/ww2-look/sectors-1.jpg`, `sectors-2.jpg`);
   - typecheck, unit tests, UI tests and the full gamecheck pass, and CI is green.

## What it draws (from `look_sector.gd`, one for one)

| Part | Drawn as | Colours |
|---|---|---|
| Size and places | the game's own layout: the theatre's spread scaled to 600 px on its long side, 60 px padding (92 below), each system at its map position; names nudged apart as the game does | none |
| Ground | the theatre cut from the sharpest picture that holds it: an inset, else `map_detail`, else the map picture | picture, then the paper colour over it at 58% |
| Ground, fallback | a plotting sheet (paper with a faint grid every 40 px) when there is no picture or it would need more than 4× magnification | paper, ink_muted |
| Plate frame | 1 px | brass_dim |
| A system | its holder's side colour with a 2 px rim; an unheld one a paper disc with an ink ring; the HQ ring in brass only where the game shows it (the player's hidden HQ) | side, ink, paper, brass |
| Its name | the look's body_bold face at 15 px, a 4 px paper halo | holder's colour darkened until it reads 4.5:1 on paper; ink when unheld |
| Corner icons | glyphs in ink on small paper tabs, edged in the tint; an uprising's glyph in red | ink, paper, signal |
| Bars | energy: used ink, free open; raw materials: built olive, free open; all with ink edges. Loyalty bar in the sides' colours, ink edge | ink, olive, paper, side |
| GID star | the "+" in the holder's colour with an ink rim | side, ink |

Hovering works as on the other mock-ups: each part names the colours it uses.

## What the editor needs to read (read-only)

- `map.json`: each system's map position and theatre;
- `factions.json` `starting_planets`: who holds each system at the start;
- `pack.json` `map_image_rect`;
- the pictures of `map_detail` and `map_insets` (the textures load already; the insets are new).

## Decisions I took (reversible, say if you want otherwise)

- **Which theatre:** a theatre picker above the mock-up, starting on the first theatre in `map.json`.
- **Game state:** the mock-up has none, so it uses the starting owners, seen by the first side, with the Huge galaxy (all of a theatre's systems). Corner icons and bar figures are a fixed sample, and one system is shown in uprising.
- **Corner glyphs:** the pack's own pictures when `display.json` `icons` names them. Otherwise simple stand-in glyphs, because the engine's own icons can't be copied into the editor (the game has no licence).

## Not in this plan

- Any other window. The real render ("In the game") already shows the new plate, because it runs the game.

## Result (built after TeeJ's "go", 2026-09-30)

- `src/core/look/sector.ts` ports the layout, PlateCut, SeparateEntries and OnPaper; `theme.ts`
  SECTOR holds every number as the game's own line, which `tests/look/theme.test.ts` finds in the game.
- `tests/look/sector.test.ts` compares every WWII theatre with what the game itself makes of it: the
  window's size, the plate, its zoom and the part of the picture it cuts, to a hundredth of a pixel.
  Those numbers were printed by a probe run on a scratch copy of game 4ad04bf.
- The game's `docs/ww2-look.md` gives the European theatres 1.4-2.5 times; Iberia is now 2.86,
  because #403 moved Gibraltar onto the Rock after that was written. The game prints 2.86 too.
