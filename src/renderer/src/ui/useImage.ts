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

/** Where art-set previews come from: every art set found on this computer, a chosen one first. */
export async function artSetPaths(): Promise<string[]> {
  return (store.art ?? (await store.loadArt())).sources.map((s) => s.path)
}

/** A file from the first art set that has it. */
export async function artSetFile(rel: string): Promise<Uint8Array | null> {
  for (const setPath of await artSetPaths()) {
    const key = `${setPath}|${rel}`
    if (!artCache.has(key)) artCache.set(key, window.api.artSetFile(setPath, rel))
    const bytes = await artCache.get(key)!
    if (bytes) return bytes
  }
  return null
}

async function bytesFor(ref: string): Promise<Uint8Array | null> {
  const [set, rel] = splitArtRef(ref)
  if (!set) return store.doc?.fileBytes(ref) ?? null
  return artSetFile(rel)
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
