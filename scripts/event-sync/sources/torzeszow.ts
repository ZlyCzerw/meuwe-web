/**
 * toRzeszow.pl events page. The site renders Custom Event Plugin cards in
 * HTML (`.cep-event`) with title, date/time, venue, category, excerpt and image.
 * Verified from fixture fetched 2026-07-06.
 */
import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://torzeszow.pl/wydarzenia/'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function slugFromUrl(url: string): string {
  const pathname = new URL(url).pathname.replace(/\/+$/g, '')
  return pathname.split('/').filter(Boolean).pop() ?? encodeURIComponent(url)
}

function dateFromDateTime(value: string | undefined): string | null {
  const m = (value ?? '').match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{1,2}):(\d{2}))?/)
  return m?.[1] ?? null
}

function hourFromDateTime(value: string | undefined): string | null {
  const m = (value ?? '').match(/^\d{4}-\d{2}-\d{2}T(\d{1,2}):(\d{2})/)
  if (!m) return null
  const hour = Number(m[1])
  if (hour < 0 || hour > 23) return null
  return `${String(hour).padStart(2, '0')}:${m[2]}`
}

export function parseTorzeszow(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('.cep-events > .cep-event').each((_, el) => {
    const item = $(el)
    const link = item.find('.cep-event__title a[href]').first()
    const title = cleanText(link.text())
    const sourceUrl = absoluteUrl(BASE, link.attr('href'))
    const dateTime = item.find('time.cep-event__date').first().attr('datetime')
    const date = dateFromDateTime(dateTime)
    const venueName = cleanText(item.find('.cep-event__venue').first().text())
    if (!title || !sourceUrl || !date || !venueName) return

    const key = `${slugFromUrl(sourceUrl)}:${date}`
    if (seen.has(key)) return
    seen.add(key)

    const categories = item
      .find('.cep-event__category')
      .toArray()
      .map(c => cleanText($(c).text()))
      .filter(Boolean)
    const description = cleanText(item.find('.cep-event__excerpt').first().text() || item.text()).slice(0, 1500)

    out.push({
      externalId: `torzeszow:${key}`,
      title,
      description,
      date,
      startHour: hourFromDateTime(dateTime),
      endHour: null,
      venueName,
      city: 'Rzeszów',
      country: 'PL',
      categories,
      sourceUrl,
      imageUrl: absoluteUrl(BASE, item.find('img.cep-event__image').first().attr('data-src')),
    })
  })

  return out
}

export class TorzeszowSource implements Source {
  readonly id = 'torzeszow'
  readonly name = 'toRzeszow.pl wydarzenia'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(BASE, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${BASE}`)
    return parseTorzeszow(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}
