// Pictures for previews: a file in the pack, or "<set>:<path>" from the player's
// art set (read for display only, never copied into the pack).

import { useEffect, useState } from 'react'
import { splitArtRef } from '../../../core/validate'
import { store } from '../store'

export interface LoadedImage {
  url: string
  width: number
  height: number
}

const artCache = new Map<string, Promise<Uint8Array | null>>()
let defaultArtSet: Promise<string | null> | null = null

async function artSetPath(): Promise<string | null> {
  if (store.artSet) return store.artSet.path
  defaultArtSet ??= window.api.defaultArtSet()
  return defaultArtSet
}

async function bytesFor(ref: string): Promise<Uint8Array | null> {
  const [set, rel] = splitArtRef(ref)
  if (!set) return store.doc?.fileBytes(ref) ?? null
  const setPath = await artSetPath()
  if (!setPath) return null
  const key = `${setPath}|${rel}`
  if (!artCache.has(key)) artCache.set(key, window.api.artSetFile(setPath, rel))
  return artCache.get(key)!
}

function mimeFor(ref: string): string {
  const r = ref.toLowerCase()
  if (r.endsWith('.png')) return 'image/png'
  if (r.endsWith('.jpg') || r.endsWith('.jpeg')) return 'image/jpeg'
  if (r.endsWith('.bmp')) return 'image/bmp'
  if (r.endsWith('.webp')) return 'image/webp'
  if (r.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}

/** The picture at `ref` (re-read when the pack changes), or null while loading / when missing. */
export function useImage(ref: string | null | undefined, version: number): { image: LoadedImage | null; missing: boolean } {
  const [state, setState] = useState<{ image: LoadedImage | null; missing: boolean }>({ image: null, missing: false })
  useEffect(() => {
    let cancelled = false
    let url: string | null = null
    if (!ref) {
      setState({ image: null, missing: true })
      return
    }
    void bytesFor(ref).then((bytes) => {
      if (cancelled) return
      if (!bytes) {
        setState({ image: null, missing: true })
        return
      }
      url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeFor(ref) }))
      const img = new Image()
      img.onload = () => !cancelled && setState({ image: { url: url!, width: img.naturalWidth, height: img.naturalHeight }, missing: false })
      img.onerror = () => !cancelled && setState({ image: null, missing: true })
      img.src = url
    })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [ref, version])
  return state
}
