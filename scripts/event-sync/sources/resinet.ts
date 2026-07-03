/**
 * RESinet kalendarium — server-rendered event cards with title, date,
 * venue, type, hour and image in `.event-item` blocks. Verified live
 * 2026-07-03.
 */
import * as cheerio from 'cheerio'
import type { CheerioAPI } from 'cheerio'
import { inferYear } from './pl-dates.ts'
import { absoluteUrl, cleanText, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://www.resinet.pl/rozrywka/kalendarium'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const MONTHS: Record<string, number> = {
  sty: 1,
  lut: 2,
  mar: 3,
  kwi: 4,
  maj: 5,
  cze: 6,
  lip: 7,
  sie: 8,
  wrz: 9,
  paz: 10,
  lis: 11,
  gru: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')

function monthNumber(label: string): number | null {
  const key = cleanText(label).toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .slice(0, 3)
  return MONTHS[key] ?? null
}

export function parseListing(html: string, now: Date): RawEvent[] {
  const $ = cheerio.load(html)
  return parseListingDom($, now)
}

export function parseListingDom($: CheerioAPI, now: Date): RawEvent[] {
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('.event-item').each((_, el) => {
    const item = $(el)
    const titleLink = item.find('h3.name a[href]').first()
    const title = cleanText(titleLink.text() || titleLink.attr('title') || '')
    const href = titleLink.attr('href')
    const day = Number(cleanText(item.find('.date-cont strong').first().text()))
    const month = monthNumber(item.find('.date-cont span').first().text())
    const venueName = cleanText(item.find('.place .value').first().text())
    if (!title || !href || !day || !month || !venueName) return

    const date = `${inferYear(day, month, now)}-${pad(month)}-${pad(day)}`
    const sourceUrl = absoluteUrl(BASE, href)
    if (!sourceUrl) return

    const classId = (item.attr('class') ?? '').match(/event-item-(\d+)/)?.[1]
    const key = `${classId ?? sourceUrl}|${date}`
    if (seen.has(key)) return
    seen.add(key)

    const type = cleanText(item.find('.type a').first().text())
    const kids = item.find('.for-kids').text().toLowerCase().includes('dzieci') ? 'Dla dzieci' : ''
    const hour = cleanText(item.find('.hours .value').first().text())

    out.push({
      externalId: `resinet:${encodeURIComponent(key)}`,
      title,
      description: cleanText(item.text()).slice(0, 1500),
      date,
      startHour: /^\d{1,2}:\d{2}$/.test(hour) ? hour.padStart(5, '0') : null,
      endHour: null,
      venueName,
      city: venueName.toLowerCase().includes('łańcut') ? 'Łańcut' : 'Rzeszów',
      country: 'PL',
      categories: [type, kids].filter(Boolean),
      sourceUrl,
      imageUrl: absoluteUrl(BASE, item.find('img').first().attr('src')),
    })
  })

  return out
}

export class ResinetSource implements Source {
  readonly id = 'resinet'
  readonly name = 'RESinet kalendarium'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(BASE, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${BASE}`)
    return parseListing(await res.text(), new Date()).filter(e => inDateWindow(e.date, options))
  }
}
