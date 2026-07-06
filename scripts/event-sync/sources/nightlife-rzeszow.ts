import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, inDateWindow, venueOwnedRaw } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const STREFA57_URL = 'https://strefa57.com/'
const UNDERGROUND_URL = 'https://undergroundpub.pl/'

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
  const key = cleanText(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .slice(0, 3)
  return MONTHS[key] ?? null
}

function slugFromUrl(url: string): string {
  const path = new URL(url).pathname.replace(/\/+$/g, '')
  return path.split('/').filter(Boolean).pop() ?? encodeURIComponent(url)
}

function normalizeDash(text: string): string {
  return cleanText(text).replace(/[–—]/g, '-')
}

function stripTitleDate(title: string): string {
  return normalizeDash(title).replace(/\s*\|\s*[A-Z]{2}\.\d{1,2}\.\d{1,2}\.\d{2}\s*$/u, '')
}

function dottedDate(text: string): string | null {
  const match = cleanText(text).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!match) return null
  return `${match[3]}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`
}

export function parseStrefa57(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('.e-loop-item.type-wydarzenia').each((_, el) => {
    const item = $(el)
    const postId = (item.attr('class') ?? '').match(/\bpost-(\d+)\b/)?.[1]
    const dateParts = item.find('.ud-wydarzenia-date .elementor-widget-text-editor')
    const day = Number(cleanText(dateParts.eq(0).text()))
    const month = monthNumber(dateParts.eq(1).text())
    const year = Number(cleanText(dateParts.eq(2).text()))
    const rawTitle = cleanText(item.find('h3.elementor-heading-title').first().text())
    const detailsUrl = absoluteUrl(
      STREFA57_URL,
      item.find('a[aria-label*="Zobacz"]').first().attr('href') ??
        item.find('a[href*="/wydarzenia/"]').first().attr('href'),
    )

    if (!postId || !day || !month || !year || !rawTitle || !detailsUrl) return
    if (seen.has(postId)) return
    seen.add(postId)

    out.push(
      venueOwnedRaw({
        sourceId: 'strefa57',
        nativeId: postId,
        title: stripTitleDate(rawTitle),
        description: rawTitle,
        date: `${year}-${pad(month)}-${pad(day)}`,
        startHour: null,
        venueName: 'Strefa 57',
        city: 'Rzeszów',
        country: 'PL',
        categories: ['music', 'nightlife'],
        sourceUrl: detailsUrl,
        imageUrl: absoluteUrl(STREFA57_URL, item.find('img').first().attr('src')),
      }),
    )
  })

  return out
}

export function parseUnderground(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('.events-row').each((_, el) => {
    const item = $(el)
    const title = normalizeDash(item.find('h2').first().text())
    const date = dottedDate(item.find('h3').first().text())
    const sourceUrl = absoluteUrl(
      UNDERGROUND_URL,
      item.find('a[href*="/kalendarium/"]').first().attr('href'),
    )

    if (!title || !date || !sourceUrl) return

    const nativeId = slugFromUrl(sourceUrl)
    if (seen.has(nativeId)) return
    seen.add(nativeId)

    out.push(
      venueOwnedRaw({
        sourceId: 'undergroundpub',
        nativeId,
        title,
        description: title,
        date,
        startHour: null,
        venueName: 'Underground Pub',
        city: 'Rzeszów',
        country: 'PL',
        categories: ['nightlife'],
        sourceUrl,
        imageUrl: absoluteUrl(UNDERGROUND_URL, item.find('img').first().attr('src')),
      }),
    )
  })

  return out
}

export class Strefa57Source implements Source {
  readonly id = 'strefa57'
  readonly name = 'Strefa 57'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(STREFA57_URL, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${STREFA57_URL}`)
    return parseStrefa57(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}

export class UndergroundPubSource implements Source {
  readonly id = 'undergroundpub'
  readonly name = 'Underground Pub'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(UNDERGROUND_URL, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${UNDERGROUND_URL}`)
    return parseUnderground(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}
