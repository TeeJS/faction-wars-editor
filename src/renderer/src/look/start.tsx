// A pack without a look: start one from a preset, or from another pack's look.json.

import type { LookPack } from '@core/look/pack'
import { PRESETS, lookFromOther, lookFromPreset } from '@core/look/presets'
import type { ColorToken } from '@core/look/vocab'
import { Chip } from './colors'

const STRIP: ColorToken[] = ['chassis_deep', 'chassis', 'chassis_raised', 'edge', 'brass', 'text', 'paper', 'ink', 'olive_deep', 'signal']

export function StartLook({ pack, onCreate }: { pack: LookPack; onCreate: (label: string, value: Record<string, unknown>, note?: string) => void }) {
  const borrow = async () => {
    const [picked] = await window.api.pickFiles("Choose another pack's look.json to start from", ['json'])
    if (!picked) return
    const text = new TextDecoder().decode(picked.bytes)
    let parsed: unknown
    try {
      parsed = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
    } catch (e) {
      onCreate('Start a look from Map room', lookFromPreset(PRESETS[0]), `${picked.name} is not JSON (${(e as Error).message}); started from Map room instead.`)
      return
    }
    const b = lookFromOther(parsed, pack.factions, (rel) => pack.ctx.hasFile(rel))
    const notes = [`Started from ${picked.name}.`]
    if (b.filled.length) notes.push(`It lacked ${b.filled.length} colour${b.filled.length === 1 ? '' : 's'} (${b.filled.join(', ')}), taken from Map room.`)
    if (b.dropped.length) notes.push(`Left behind, as this pack has no such side or file: ${b.dropped.join(', ')}.`)
    onCreate(`Start a look from ${picked.name}`, b.look, notes.join(' '))
  }

  return (
    <div className="content start">
      <div className="panel">
        <h2>This pack has no look</h2>
        <p>
          Without a <code>look.json</code> the game draws this pack in the colours written into each screen. Start one below; it becomes part of the pack
          like any other change, so Undo takes it back and Save writes it.
        </p>
        <p className="small">
          One thing changes in the game: for a player without the original's art, a pack with a look is drawn with the look's map screen instead of
          the stand-in windows (the Command Center, Message Index, Sector, Status, Manufacturing, Defenses, Fleet and Mission windows, the finders and the Encyclopedia).{' '}
          <code>art_standins.gd</code> turns those off for any pack with a look.
        </p>
      </div>
      <div className="presets">
        {PRESETS.map((p) => (
          <section key={p.id} className="group preset">
            <div className="strip" aria-hidden="true">
              {STRIP.map((t) => (
                <Chip key={t} hex={p.colors[t]} small />
              ))}
            </div>
            <h3>{p.name}</h3>
            <p className="muted small">{p.about}</p>
            <button type="button" className="primary" onClick={() => onCreate(`Start a look from ${p.name}`, lookFromPreset(p))}>
              Start from {p.name}
            </button>
          </section>
        ))}
        <section className="group preset">
          <h3>Another pack's look</h3>
          <p className="muted small">
            Its colours, sizes, corners and dim. Its side colours come too for the factions this pack shares; its faces, textures and map insets only
            where this pack carries the same files.
          </p>
          <button type="button" onClick={() => void borrow()}>
            Choose a look.json…
          </button>
        </section>
      </div>
    </div>
  )
}
