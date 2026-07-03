/**
 * MGOK Tyczyn — WordPress RSS (https://mgoktyczyn.pl/feed/).
 * The feed's description/content are EMPTY; the event date lives in the
 * post title ('23.06 | Wernisaż prac…', '… | 31.05.2026 r.'). Items without
 * a parseable date are news, not events — skipped. Venue defaults to MGOK
 * Tyczyn (resolved by the venue registry). Verified live 2026-07-03.
 */
import * as cheerio from 'cheerio'
import { parsePlDate } from './pl-dates.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const FEED_URL = 'https://mgoktyczyn.pl/feed/'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const DATE_FRAGMENT = /\s*\|?\s*\d{1,2}\.\d{1,2}(?:\.\d{4})?\s*r?\.?\s*\|?\s*/

export function parseFeed(xml: string, now: Date): RawEvent[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  const out: RawEvent[] = []

  $('item').each((_, el) => {
    const rawTitle = $(el).find('title').first().text().trim()
    const link = $(el).find('link').first().text().trim()
    const guid = $(el).find('guid').first().text().trim()

    const date = parsePlDate(rawTitle, now)
    if (!date) return // news post, not a dated event

    const title = rawTitle.replace(DATE_FRAGMENT, ' ').replace(/\s+/g, ' ').trim() || rawTitle
    const idMatch = guid.match(/p=(\d+)/)

    out.push({
      externalId: `mgoktyczyn:${idMatch ? idMatch[1] : encodeURIComponent(guid)}:${date}`,
      title,
      description: '',
      date,
      startHour: null,
      endHour: null,
      venueName: 'MGOK Tyczyn',
      city: 'Tyczyn',
      country: 'PL',
      categories: [rawTitle],
      sourceUrl: link,
    })
  })
  return out
}

export class MgokTyczynSource implements Source {
  readonly id = 'mgoktyczyn'
  readonly name = 'MGOK Tyczyn (RSS)'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${FEED_URL}`)
    const from = options.dateFrom.toISOString().slice(0, 10)
    const to = options.dateTo.toISOString().slice(0, 10)
    return parseFeed(await res.text(), new Date())
      .filter(e => e.date >= from && e.date <= to)
  }
}
