// The look as the mock-ups draw it: colours (magenta when missing, as the
// game), metrics and sizes (the game's defaults when unset), the pack's own
// faces and textures (as the pack carries them now, unsaved ones included),
// and the map picture.

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { LookPack } from '@core/look/pack'
import type { LookFile } from '@core/look/lookfile'
import { isDict } from '@core/look/godot'
import { parseHex } from '@core/look/contrast'
import type { Metric } from '@core/look/theme'
import type { ColorToken } from '@core/look/vocab'
import { DEFAULT_METRICS, DEFAULT_OVERLAY_ALPHA, DEFAULT_SIZES, type Env, type TexInfo } from './kit'

interface Assets {
  /** Font file (relative) -> the CSS family it is loaded as. */
  fonts: Record<string, string>
  /** Texture name (and "__map") -> its picture. */
  tex: Record<string, TexInfo>
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

const hashes = new WeakMap<Uint8Array, number>()
/** FNV-1a of the bytes: a replaced face is a new face, even at the same size.
 * Kept per array: the pack holds a file's bytes as one array until it changes. */
function fnv(bytes: Uint8Array): number {
  let h = hashes.get(bytes)
  if (h === undefined) {
    h = 0x811c9dc5
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193)
    h >>>= 0
    hashes.set(bytes, h)
  }
  return h
}

let familyCount = 0
const loadedFamilies = new Map<string, string>() // "<file>|<size>|<fnv>" -> family

/** Loads the faces, textures and map picture the look names, from the pack. */
export function useAssets(pack: LookPack | null, look: LookFile | null): Assets {
  const [assets, setAssets] = useState<Assets>({ fonts: {}, tex: {} })
  const v = look?.value
  const fonts = isDict(v?.fonts) ? v!.fonts : {}
  const textures = isDict(v?.textures) ? v!.textures : {}
  const fontFiles = [...new Set(Object.values(fonts).map((f) => (isDict(f) ? String(f.file ?? '') : '')).filter(Boolean))].sort()
  const texFiles = Object.entries(textures)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, t]) => [k, isDict(t) ? String(t.file ?? '') : String(t), isDict(t) && typeof t.margin === 'number' ? t.margin : 0] as const)
  // Which files, and which bytes: a face replaced under the same name loads again.
  const bytesOf = (rel: string) => (pack ? pack.file(rel) : undefined)
  const sig = (rel: string) => {
    const b = bytesOf(rel)
    return b ? `${b.length}:${fnv(b)}` : 'none'
  }
  const key = JSON.stringify([pack?.id, pack?.mapImage, fontFiles.map((f) => [f, sig(f)]), texFiles.map(([k, f, m]) => [k, f, m, sig(f)]), pack?.mapImage ? sig(pack.mapImage) : ''])

  useEffect(() => {
    if (!pack) return
    let cancelled = false
    const urls: string[] = []
    void (async () => {
      const out: Assets = { fonts: {}, tex: {} }
      for (const file of fontFiles) {
        const bytes = bytesOf(file)
        if (!bytes) continue
        const id = `${file}|${bytes.length}|${fnv(bytes)}`
        let family = loadedFamilies.get(id)
        if (!family) {
          family = `fwe-face-${++familyCount}`
          try {
            const face = new FontFace(family, new Uint8Array(bytes), { weight: '100 900' })
            await face.load()
            document.fonts.add(face)
            loadedFamilies.set(id, family)
          } catch {
            continue
          }
        }
        out.fonts[file] = family
      }
      const pictures: [string, string, number][] = texFiles.map(([k, f, m]) => [k, f, m])
      if (pack.mapImage) pictures.push(['__map', pack.mapImage, 0])
      for (const [name, file, margin] of pictures) {
        if (!file) continue
        const bytes = bytesOf(file)
        if (!bytes) continue
        const ext = file.split('.').pop()?.toLowerCase() ?? ''
        const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[ext] ?? 'application/octet-stream' }))
        urls.push(url)
        const { width, height } = await imageSize(url)
        out.tex[name] = { url, width, height, margin }
      }
      if (!cancelled) setAssets(out)
    })()
    return () => {
      cancelled = true
      // Revoked once the next set is in: the old pictures stay up until then.
      setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 5000)
    }
    // `key` names everything the loading reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return assets
}

export function makeEnv(pack: LookPack, look: LookFile, assets: Assets): Env {
  const v = look.value ?? {}
  const num = (d: unknown, k: string): number | undefined => {
    const x = isDict(d) ? d[k] : undefined
    return typeof x === 'number' ? x : undefined
  }
  const fonts = isDict(v.fonts) ? v.fonts : {}
  const dossier = isDict(v.dossier) ? v.dossier : {}
  const rect = dossier.map_rect
  // Look.DispatchHeader / Stamp / Urgent: exact keys, "" when absent.
  const messages = isDict(v.messages) ? v.messages : {}
  const stamps = isDict(messages.stamps) ? messages.stamps : {}
  const urgent = Array.isArray(messages.urgent) ? messages.urgent : []
  const text = (x: unknown) => (x === undefined || x === null ? '' : String(x))
  const face = (role: string | null): CSSProperties => {
    const r = role ?? 'body'
    const f = fonts[r]
    if (isDict(f)) {
      const family = assets.fonts[String(f.file ?? '')]
      if (family)
        return {
          fontFamily: `"${family}", "Segoe UI", system-ui, sans-serif`,
          fontWeight: typeof f.weight === 'number' ? f.weight : 400,
          fontVariantNumeric: f.tabular === true ? 'tabular-nums' : undefined
        }
    }
    if (r !== 'body') return face('body')
    return { fontFamily: '"Segoe UI", system-ui, sans-serif', fontWeight: 400 }
  }
  return {
    c: (t: ColorToken) => {
      const hex = look.color(t)
      return parseHex(hex) ? hex! : '#ff00ff'
    },
    metric: (m: Metric) => {
      const x = num(v.metrics, m)
      return x !== undefined && x >= 0 ? x : DEFAULT_METRICS[m]
    },
    size: (name: string, plus = 0) => {
      const x = num(v.sizes, name)
      const base = x !== undefined && x > 0 ? x : (DEFAULT_SIZES as Record<string, number>)[name] ?? 16
      return base + plus
    },
    face,
    tex: (name: string) => assets.tex[name] ?? null,
    side: (id: string) => {
      const own = look.side(id)
      if (parseHex(own)) return own!
      return pack.factions.find((f) => f.id === id)?.color ?? '#ffffff'
    },
    overlayAlpha: typeof v.overlay_alpha === 'number' ? v.overlay_alpha : DEFAULT_OVERLAY_ALPHA,
    pack,
    mapUrl: assets.tex.__map?.url ?? null,
    dossier: {
      subtitle: typeof dossier.subtitle === 'string' ? dossier.subtitle : '',
      mapRect: Array.isArray(rect) && rect.every((n) => typeof n === 'number') ? (rect as number[]) : null,
      caption: typeof dossier.map_caption === 'string' ? dossier.map_caption : ''
    },
    messages: {
      header: text(messages.header),
      stamp: (category: string) => text(Object.prototype.hasOwnProperty.call(stamps, category) ? stamps[category] : ''),
      urgent: (category: string) => urgent.includes(category)
    }
  }
}

/** The mock-ups' look for the pack as it stands (`pack` is rebuilt on every pack change). */
export function useEnvFor(pack: LookPack | null): Env | null {
  const assets = useAssets(pack, pack?.look ?? null)
  return useMemo(() => (pack?.look ? makeEnv(pack, pack.look, assets) : null), [pack, assets])
}
