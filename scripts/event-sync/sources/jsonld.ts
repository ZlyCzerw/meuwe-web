/**
 * Shared JSON-LD (schema.org) helpers for sources that embed events as
 * structured data — extract every Event (and its subtypes) from a page's
 * ld+json blocks, wherever they sit (top level, arrays, @graph, ItemList).
 */

const EVENT_TYPES = new Set([
  'Event', 'MusicEvent', 'TheaterEvent', 'ComedyEvent', 'Festival',
  'DanceEvent', 'ScreeningEvent', 'ExhibitionEvent', 'ChildrensEvent',
  'SportsEvent', 'EducationEvent', 'SocialEvent', 'LiteraryEvent',
  'VisualArtsEvent', 'FoodEvent', 'BusinessEvent',
])

export interface JsonLdEvent {
  name: string
  /** ISO-ish string exactly as the source provides it */
  startDate: string
  endDate?: string
  description?: string
  url?: string
  imageUrl?: string
  venueName?: string
  city?: string
  street?: string
  /** All schema.org @type strings on the node (for category mapping) */
  types: string[]
}

/** Parse every `<script type="application/ld+json">` block; skip malformed ones. */
export function parseJsonLdBlocks(html: string): unknown[] {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []
  const out: unknown[] = []
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
    try { out.push(JSON.parse(json)) } catch { /* skip malformed */ }
  }
  return out
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node['@type']
  if (typeof t === 'string') return [t]
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string')
  return []
}

function first<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v
}

function toEvent(node: Record<string, unknown>): JsonLdEvent | null {
  const name = typeof node.name === 'string' ? node.name.trim() : ''
  if (!name) return null

  const loc = first(node.location) as Record<string, unknown> | undefined
  const addr = loc && typeof loc === 'object'
    ? first(loc.address) as Record<string, unknown> | undefined
    : undefined
  const image = first(node.image)

  return {
    name,
    startDate: typeof node.startDate === 'string' ? node.startDate.trim() : '',
    endDate: typeof node.endDate === 'string' ? node.endDate.trim() : undefined,
    description: typeof node.description === 'string' ? node.description.trim() : undefined,
    url: typeof node.url === 'string' ? node.url.trim() : undefined,
    imageUrl: typeof image === 'string' ? image
      : (image && typeof image === 'object' && typeof (image as Record<string, unknown>).url === 'string'
          ? (image as Record<string, string>).url : undefined),
    venueName: loc && typeof loc.name === 'string' ? loc.name.trim() : undefined,
    city: addr && typeof addr.addressLocality === 'string' ? addr.addressLocality.trim() : undefined,
    street: addr && typeof addr.streetAddress === 'string' ? addr.streetAddress.trim() : undefined,
    types: typesOf(node),
  }
}

/** Recursively collect every Event-typed node (deduped by name+startDate). */
export function collectJsonLdEvents(root: unknown): JsonLdEvent[] {
  const found: JsonLdEvent[] = []
  const seen = new Set<string>()

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    if (typesOf(obj).some(t => EVENT_TYPES.has(t))) {
      const ev = toEvent(obj)
      if (ev) {
        const key = `${ev.name}|${ev.startDate}`
        if (!seen.has(key)) { seen.add(key); found.push(ev) }
      }
    }
    for (const v of Object.values(obj)) walk(v)
  }

  walk(root)
  return found
}
