/**
 * eBilet — Polish ticketing platform, Rzeszów-region city landing pages.
 *
 * The landing HTML (https://www.ebilet.pl/miasto/{slug}) embeds URLs of an
 * internal JSON API: /api/LandingPage/group/{uuid}/event. Each returns
 * { events: [...] } with per-event date, city, venue name and street address
 * — far more accurate than the page's JSON-LD, which mixes multi-city tours.
 * Verified live 2026-07-03 (see docs/event-sources-rzeszow.md).
 */
import { normalizeName } from '../geocoder.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const CITY_SLUGS = ['rzeszow', 'lancut', 'jasionka'] // boguchwala/tyczyn: no city page (404)
const REGION_CITIES = new Set([
  'rzeszow', 'lancut', 'jasionka', 'tyczyn', 'boguchwala',
  'trzebownisko', 'krasne', 'glogow malopolski', 'swilcza',
])
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export interface EbiletApiEvent {
  date: string
  city: string | null
  placeName: string | null
  street: string | null
  postalCode: string | null
  titleTitle: string
  titleId: string
  organizerName?: string | null
  uniqueId: string
  isCancelled: boolean
  soldOut: boolean
}

export function extractGroupApiUrls(html: string): string[] {
  const re = /https:\/\/www\.ebilet\.pl\/api\/LandingPage\/group\/[0-9a-f-]{36}\/event/g
  return [...new Set(html.match(re) ?? [])]
}

export function toRawEvents(events: EbiletApiEvent[], opts: ScrapeOptions): RawEvent[] {
  const from = opts.dateFrom.toISOString().slice(0, 10)
  const to = opts.dateTo.toISOString().slice(0, 10)
  const out: RawEvent[] = []

  for (const e of events) {
    if (!e?.date || !e.uniqueId || e.isCancelled) continue
    if (!e.city || !REGION_CITIES.has(normalizeName(e.city))) continue
    const date = e.date.slice(0, 10)
    if (date < from || date > to) continue

    out.push({
      externalId: `ebilet:${e.uniqueId}`,
      title: e.titleTitle,
      description: [e.titleTitle, e.placeName, e.city, e.organizerName]
        .filter(Boolean).join(' — '),
      date,
      startHour: /^\d{2}:\d{2}/.test(e.date.slice(11)) ? e.date.slice(11, 16) : null,
      endHour: null,
      venueName: e.placeName ?? '',
      city: e.city,
      address: e.street ?? undefined,
      country: 'PL',
      categories: [],
    })
  }
  return out
}

export class EbiletSource implements Source {
  readonly id = 'ebilet'
  readonly name = 'eBilet (PL ticketing API)'

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${url}`)
    return res.text()
  }

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const byId = new Map<string, RawEvent>()

    for (const slug of CITY_SLUGS) {
      let html: string
      try {
        html = await this.fetchText(`https://www.ebilet.pl/miasto/${slug}`)
      } catch (err) {
        console.warn(`  ⚠ ebilet: city page ${slug} failed: ${(err as Error).message}`)
        continue
      }

      for (const apiUrl of extractGroupApiUrls(html)) {
        await new Promise(r => setTimeout(r, 300)) // politeness
        try {
          const body = await this.fetchText(apiUrl)
          const parsed = JSON.parse(body) as { events?: EbiletApiEvent[] }
          for (const raw of toRawEvents(parsed.events ?? [], options)) {
            const prev = byId.get(raw.externalId)
            if (!prev || (!prev.venueName && raw.venueName)) byId.set(raw.externalId, raw)
          }
        } catch (err) {
          console.warn(`  ⚠ ebilet: group API failed: ${(err as Error).message}`)
        }
      }
    }
    return [...byId.values()]
  }
}
