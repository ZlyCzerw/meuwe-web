const CHAR_MAP: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'a', Ć: 'c', Ę: 'e', Ł: 'l', Ń: 'n', Ó: 'o', Ś: 's', Ź: 'z', Ż: 'z',
  á: 'a', é: 'e', í: 'i', ú: 'u', ñ: 'n', ü: 'u',
  Á: 'a', É: 'e', Í: 'i', Ú: 'u', Ñ: 'n', Ü: 'u',
  ä: 'a', ö: 'o', Ä: 'a', Ö: 'o', ß: 'ss',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function toSlug(text: string): string {
  return text
    .split('').map(c => CHAR_MAP[c] ?? c).join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildEventPath(event: { id: string; title: string; place_name: string | null }): string {
  const titleSlug = toSlug(event.title ?? '')
  const placeSlug = event.place_name ? toSlug(event.place_name) : ''
  const parts = [titleSlug, placeSlug].filter(Boolean)
  if (parts.length === 0) return `/e/${event.id}`
  return `/e/${parts.join('--')}--${event.id}`
}

export function extractEventId(path: string): string | null {
  if (!path.startsWith('/e/')) return null
  const segment = path.slice(3)
  const parts = segment.split('--')
  for (let i = parts.length - 1; i >= 0; i--) {
    if (UUID_RE.test(parts[i])) return parts[i]
  }
  return null
}
