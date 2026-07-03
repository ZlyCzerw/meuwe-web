/**
 * Estrada Rzeszowska — the city's culture agency (estrada.rzeszow.pl).
 * The homepage is a server-rendered calendar: `.calendarSingleDay` blocks
 * (day + month, no year — inferred) with `article` cards. Venue comes from
 * the card's `.organizer` span; the detail page has a `.where` block with
 * `span.date` / `span.time` / `span.place` and description in
 * `.ArticleFull__text`. Verified live 2026-07-03.
 */
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import { inferYear } from './pl-dates.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://estrada.rzeszow.pl'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const MAX_DETAIL_FETCHES = 40

export interface EstradaListItem {
  url: string
  title: string
  /** 'YYYY-MM-DD' from the calendar day block */
  date: string
  venueHint: string
  imageUrl?: string
}

export interface EstradaDetail {
  time: string | null
  place: string
  description: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function parseListing($: CheerioAPI, now: Date): EstradaListItem[] {
  const items: EstradaListItem[] = []
  const seen = new Set<string>()

  $('.calendarSingleDay').each((_, dayEl) => {
    const day = parseInt($(dayEl).find('.calendar--left .day').first().text().trim(), 10)
    const month = parseInt($(dayEl).find('.calendar--left .month').first().text().trim(), 10)
    if (!day || !month) return
    const date = `${inferYear(day, month, now)}-${pad(month)}-${pad(day)}`

    $(dayEl).find('article').each((_, art) => {
      const a = $(art).find('a[href*="/wydarzenia/"][title]').first()
      const href = a.attr('href')
      const title = a.attr('title')?.trim()
      if (!href || !title) return
      const url = BASE + href.split('?')[0]
      const key = `${url}|${date}`
      if (seen.has(key)) return
      seen.add(key)

      const imgSrc = $(art).find('img').first().attr('src')
      items.push({
        url,
        title,
        date,
        venueHint: $(art).find('.organizer').first().text().trim(),
        imageUrl: imgSrc ? (imgSrc.startsWith('http') ? imgSrc : BASE + imgSrc) : undefined,
      })
    })
  })
  return items
}

export function parseDetail($: CheerioAPI): EstradaDetail {
  const timeText = $('.where .time').first().text().trim()
  const time = /^\d{1,2}:\d{2}$/.test(timeText) ? timeText.padStart(5, '0') : null
  const place = $('.where .place').first().text().trim()
  const description = $('.ArticleFull__text').first().text()
    .replace(/\s+/g, ' ').trim().slice(0, 1500)
  return { time, place, description }
}

export class EstradaSource implements Source {
  readonly id = 'estrada'
  readonly name = 'Estrada Rzeszowska'

  private async fetchHtml(url: string): Promise<CheerioAPI> {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${url}`)
    return cheerio.load(await res.text())
  }

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const from = options.dateFrom.toISOString().slice(0, 10)
    const to = options.dateTo.toISOString().slice(0, 10)

    const $ = await this.fetchHtml(`${BASE}/`)
    const items = parseListing($, new Date())
      .filter(i => i.date >= from && i.date <= to)
      .slice(0, MAX_DETAIL_FETCHES)

    // One event page can be listed on several days — fetch each detail once.
    const detailCache = new Map<string, EstradaDetail>()
    const out: RawEvent[] = []

    for (const item of items) {
      let d = detailCache.get(item.url)
      if (!d) {
        await new Promise(r => setTimeout(r, 300)) // politeness
        try {
          d = parseDetail(await this.fetchHtml(item.url))
        } catch {
          d = { time: null, place: '', description: '' }
        }
        detailCache.set(item.url, d)
      }

      const idMatch = item.url.match(/,wydarzenie(\d+)\/$/)
      out.push({
        externalId: `estrada:${idMatch ? idMatch[1] : item.url}:${item.date}`,
        title: item.title,
        description: d.description,
        date: item.date,
        startHour: d.time,
        endHour: null,
        venueName: d.place || item.venueHint,
        city: 'Rzeszów',
        country: 'PL',
        categories: [],
        sourceUrl: item.url,
        imageUrl: item.imageUrl,
      })
    }
    return out
  }
}
