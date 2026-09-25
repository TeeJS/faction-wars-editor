// A record's pictures and Encyclopedia text, where the game finds them: the
// pack's own art/ first, then the player's art set. A mod adds its own to override.

import { useEffect, useState, type ReactNode } from 'react'
import { ci, isDict } from '../../../core/model'
import { alias, DESCRIPTIONS, pictureSlots, pngSize, readDescription, writeDescription, type PictureKind, type PictureSlot } from '../../../core/pictures'
import { CommitInput } from '../forms/fields'
import type { Ctx, Dict } from '../forms/types'
import { store } from '../store'
import { alertDialog, confirmDialog } from '../ui/Modal'
import { artSetFile, useImage } from '../ui/useImage'

export function PicturesPanel(props: { c: Ctx; kind: PictureKind; rec: Dict }): ReactNode {
  const { c, kind, rec } = props
  const id = String(ci(rec, 'id') ?? '')
  const artRef = String(ci(rec, 'art') ?? '')
  const artworkId = Number(ci(rec, 'artwork_id') ?? 0) || 0
  if (!id) return null
  const slots = pictureSlots(c.pack, kind, id, artRef, artworkId)
  return (
    <section className="pictures" aria-label="Pictures">
      <header className="pictures-head">
        <h3>Pictures</h3>
        <span className="muted">
          The game uses this pack's own picture first, then {c.pack.manifest.artSets.length ? 'your art set' : 'the engine\'s own art'}. Adding your own
          overrides it. To show a different original picture, set the Art reference.
        </span>
      </header>
      <div className="picture-slots">
        {slots.map((s) => (
          <PictureCard key={s.key} c={c} slot={s} />
        ))}
      </div>
      <Description c={c} kind={kind} id={id} artRef={artRef} />
    </section>
  )
}

function PictureCard({ c, slot }: { c: Ctx; slot: PictureSlot }): ReactNode {
  const own = c.doc.hasFile(slot.own)
  const ownImg = useImage(own ? slot.own : null, c.doc.version)
  const setImg = useImage(!own && slot.set.length ? slot.set[0] : null, 0)
  const shown = own ? ownImg.image : setImg.image
  const noArtHere = !!store.art && store.art.sources.length === 0
  const source = own
    ? 'this pack'
    : setImg.image
      ? 'from your art set'
      : slot.set.length && noArtHere
        ? 'from the art set, not on this computer'
        : 'none'
  const sizeOff = own && shown && slot.size && (shown.width !== slot.size[0] || shown.height !== slot.size[1])

  const choose = async () => {
    const picked = await window.api.pickFiles(`${slot.label}`, ['png'])
    if (!picked.length) return
    const f = picked[0]
    const size = pngSize(f.bytes)
    if (!size) {
      await alertDialog('Not a PNG', `The game reads ${slot.own} as a PNG image, and ${f.name} is not one. Save it as .png first.`)
      return
    }
    c.doc.edit(`${own ? 'Replace' : 'Add'} ${slot.own}`, (e) => e.setFile(slot.own, f.bytes))
    if (slot.size && (size[0] !== slot.size[0] || size[1] !== slot.size[1]))
      store.notify('info', `${f.name} is ${size[0]}×${size[1]}; the original's are ${slot.size[0]}×${slot.size[1]}, and the game scales it to fit.`)
  }
  const remove = async () => {
    if (!(await confirmDialog('Remove picture', `Remove ${slot.own} from the pack? The game then falls back to ${setImg.image || slot.set.length ? 'the art set\'s picture' : 'no picture'}.`, 'Remove', true))) return
    c.doc.edit(`Remove ${slot.own}`, (e) => e.removeFile(slot.own))
  }

  return (
    <figure className={`picture-card ${own ? 'own' : ''}`}>
      <div className={`picture-frame ${slot.size && slot.size[0] < 100 ? 'small' : ''}`}>
        {shown ? <img src={shown.url} alt={slot.label} /> : <span className="muted">no picture</span>}
      </div>
      <figcaption>
        <strong>{slot.label}</strong>
        <span className={`source ${own ? 'own' : ''}`}>
          {source}
          {shown ? ` · ${shown.width}×${shown.height}` : ''}
          {slot.size ? ` (original ${slot.size[0]}×${slot.size[1]})` : ''}
        </span>
        {sizeOff && <span className="warn-text">Different size from the original's; the game scales it.</span>}
        {slot.note && <span className="muted">{slot.note}</span>}
        <code className="muted" title="Where your own picture goes">
          {slot.own}
        </code>
        <span className="row-actions">
          <button onClick={() => void choose()}>{own ? 'Replace…' : 'Add my own…'}</button>
          {own && (
            <button className="danger" onClick={() => void remove()}>
              Remove
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  )
}

/** Encyclopedia text: this pack's art/descriptions.json; the art set's shown for reference. */
function Description({ c, kind, id, artRef }: { c: Ctx; kind: PictureKind; id: string; artRef: string }): ReactNode {
  const text = readDescription(c.doc, kind, id)
  const [original, setOriginal] = useState<string | null>(null)
  const [aSet, aKind, aId] = alias(c.pack, kind, id, artRef)
  const sets = aSet ? [aSet] : c.pack.manifest.artSets
  useEffect(() => {
    let cancelled = false
    setOriginal(null)
    void (async () => {
      if (!sets.length) return
      const bytes = await artSetFile('descriptions.json')
      if (!bytes || cancelled) return
      try {
        const all = JSON.parse(new TextDecoder().decode(bytes)) as unknown
        const t = isDict(all) && isDict(all[aKind]) ? (all[aKind] as Dict)[aId] : undefined
        if (!cancelled) setOriginal(typeof t === 'string' ? t : null)
      } catch {
        /* not our file to fix */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [aKind, aId, sets.join(',')])
  return (
    <div className="description">
      <div className="field-label">
        <span>Encyclopedia text</span>
        <code title="Stored in">{DESCRIPTIONS}</code>
      </div>
      <CommitInput
        multiline
        value={text}
        placeholder={original ? 'Empty: the game shows the original text from your art set.' : 'Empty: no Encyclopedia text.'}
        ariaLabel="Encyclopedia text"
        onCommit={(t) => c.doc.edit('Edit Encyclopedia text', (e) => writeDescription(c.doc, e, kind, id, t))}
      />
      {original && (
        <details>
          <summary className="muted">The original's text (from your art set)</summary>
          <p className="original-text">{original}</p>
        </details>
      )}
    </div>
  )
}
