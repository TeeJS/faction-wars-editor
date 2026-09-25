// The player's art sets on this computer, for previews of the pictures a pack
// names from them ("<set>:<path>").

/** One art set found on this computer: its id, where, and path -> sha256 from its manifest. */
export interface ArtSetSource {
  id: string
  path: string
  files: Record<string, string>
}

export interface ArtSets {
  /** Where each set was found (a chosen one first). */
  sources: { id: string; path: string }[]
}

export function indexArtSets(sources: ArtSetSource[]): ArtSets {
  return { sources: sources.map((s) => ({ id: s.id, path: s.path })) }
}
