// What a person types into a hex field, as the #rrggbb the game requires.

/** "#A88A4E", "a88a4e", "#abc" or " abc " -> "#a88a4e" / "#aabbcc"; null when it is not a colour. */
export function normalizeHex(input: string): string | null {
  let s = input.trim()
  if (s.startsWith('#')) s = s.slice(1)
  if (/^[0-9a-fA-F]{3}$/.test(s)) s = [...s].map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null
  return '#' + s.toLowerCase()
}
