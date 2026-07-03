/**
 * biletyna.pl — Polish ticketing platform, per-city listing pages
 * (https://biletyna.pl/{City}). The listing embeds a JSON-LD `ItemList` of
 * schema.org events (MusicEvent, TheaterEvent…) carrying venue name, street
 * address, city and start time — precise enough to geocode to venue level.
 * Verified live 2026-07-03 (see docs/event-sources-rzeszow.md).
 */
import { collectJsonLdEvents, parseJsonLdBlocks, type JsonLdEvent } from './jsonld.ts'
import { normalizeName } from '../geocoder.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const CITY_PATHS = ['Rzeszow', 'Lancut'] // biletyna has per-city pages; others 404
const REGION_CITIES = new Set([
  'rzeszow', 'lancut', 'jasionka', 'tyczyn', 'boguchwala',
  'trzebownisko', 'krasne', 'glogow malopolski', 'swilcza',
])
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** biletyna event ids live in the `eid` query param; fall back to the path. */
export function extractEid(url: string): string {
  const m = url.match(/[?&]eid=(\d+)/)
  if (m) return m[1]
  return url.replace(/^https?:\/\/[^/]+\//, '').split('?')[0]
}

export function toRawEvents(events: JsonLdEvent[], opts: ScrapeOptions): RawEvent[] {
  const from = opts.dateFrom.toISOString().slice(0, 10)
  const to = opts.dateTo.toISOString().slice(0, 10)
  const byId = new Map<string, RawEvent>()

  for (const e of events) {
    if (!e.startDate || !e.url) continue
    const date = e.startDate.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < from || date > to) continue
    const city = e.city ?? ''
    if (!city || !REGION_CITIES.has(normalizeName(city))) continue

    const externalId = `biletyna:${extractEid(e.url)}`
    if (byId.has(externalId)) continue

    byId.set(externalId, {
      externalId,
      title: e.name,
      description: e.description ?? '',
      date,
      startHour: /^\d{2}:\d{2}/.test(e.startDate.slice(11)) ? e.startDate.slice(11, 16) : null,
      endHour: null,
      venueName: e.venueName ?? '',
      city,
      address: e.street,
      country: 'PL',
      categories: e.types.filter(t => t !== 'Event'), // e.g. MusicEvent → music
      sourceUrl: e.url,
      imageUrl: e.imageUrl,
    })
  }
  return [...byId.values()]
}

export class BiletynaSource implements Source {
  readonly id = 'biletyna'
  readonly name = 'biletyna.pl'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const byId = new Map<string, RawEvent>()

    for (const path of CITY_PATHS) {
      try {
        const res = await fetch(`https://biletyna.pl/${path}`, {
          headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const html = await res.text()
        const events = parseJsonLdBlocks(html).flatMap(collectJsonLdEvents)
        for (const raw of toRawEvents(events, options)) byId.set(raw.externalId, raw)
      } catch (err) {
        console.warn(`  ⚠ biletyna: ${path} failed: ${(err as Error).message}`)
      }
      await new Promise(r => setTimeout(r, 400))
    }
    return [...byId.values()]
  }
}
