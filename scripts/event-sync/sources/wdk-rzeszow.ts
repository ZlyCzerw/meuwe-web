/**
 * Wojewódzki Dom Kultury in Rzeszów. The homepage exposes a small
 * server-rendered "Zapowiedzi" block with dated event announcements.
 * Verified from fixture fetched 2026-07-06.
 */
import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://wdk.kulturapodkarpacka.pl'
const VENUE_NAME = 'Wojewódzki Dom Kultury w Rzeszowie'
const VENUE_ADDRESS = 'ul. S. Okrzei 7'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function parsePolishDate(text: string): string | null {
  const m = cleanText(text).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function articleId(url: string): string {
  return new URL(url).pathname.match(/,([^/,]+)\/?$/)?.[1] ?? encodeURIComponent(url)
}

export function parseWdkRzeszow(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('article.topic').each((_, el) => {
    const article = $(el)
    const label = cleanText(article.find('.topic__p').first().text())
    if (label !== 'Zapowiedź wydarzenia') return

    const link = article.find('a.topic__link[href]').first()
    const sourceUrl = absoluteUrl(BASE, link.attr('href'))
    const title = cleanText(article.find('.topic__heading').first().text() || link.attr('title') || '')
    const date = parsePolishDate(article.find('.topic__date').first().text())
    if (!sourceUrl || !title || !date) return

    const id = articleId(sourceUrl)
    if (seen.has(id)) return
    seen.add(id)

    out.push({
      externalId: `wdk-rzeszow:${id}`,
      title,
      description: label,
      date,
      startHour: null,
      endHour: null,
      venueName: VENUE_NAME,
      city: 'Rzeszów',
      address: VENUE_ADDRESS,
      country: 'PL',
      categories: [label],
      sourceUrl,
      imageUrl: absoluteUrl(BASE, article.find('img.topic__img').first().attr('src')),
    })
  })

  return out
}

export class WdkRzeszowSource implements Source {
  readonly id = 'wdk-rzeszow'
  readonly name = 'WDK Rzeszów'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(BASE, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${BASE}`)
    return parseWdkRzeszow(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}
