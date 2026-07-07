/**
 * Co Jest Grane city listing. The Rzeszów page exposes schema.org Event cards
 * in server-rendered HTML, with one or more ticket-hour anchors per event.
 * Verified from fixture fetched 2026-07-06.
 */
import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, extractHour, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://cojestgrane.pl/polska/podkarpackie/rzeszow'
const ORIGIN = 'https://cojestgrane.pl'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function nativeIdFromUrl(url: string): string | null {
  return new URL(url).pathname.match(/\/wydarzenie\/([^/]+)\//)?.[1] ?? null
}

function normalizeKey(text: string): string {
  return cleanText(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function imageUrl(src: string | undefined): string | undefined {
  const raw = (src ?? '').trim()
  if (!raw || raw.includes('undefined') || raw.includes('/i/event-medium.png') || raw.includes('/i/event-small.png')) {
    return undefined
  }
  return absoluteUrl(ORIGIN, raw)
}

function pageUrls(html: string): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()
  $('[data-role="paginator"] a.ui-pagine[href]').each((_, link) => {
    const href = $(link).attr('href')
    const url = absoluteUrl(ORIGIN, href)
    if (url) urls.add(url)
  })
  return [...urls]
}

export function parseCoJestGraneRzeszow(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('.ui-events > li[itemtype="http://schema.org/Event"]').each((_, el) => {
    const item = $(el)
    const link = item.find('a[itemprop="url"][href]').first()
    const sourceUrl = absoluteUrl(ORIGIN, link.attr('href'))
    if (!sourceUrl) return

    const nativeId = nativeIdFromUrl(sourceUrl)
    const title = cleanText(item.find('[itemprop="name"]').first().text())
    const date = (item.find('time[itemprop="startDate"]').first().attr('datetime') ?? '').slice(0, 10)
    const venueName = cleanText(item.find('[itemprop="location"] [itemprop="name"]').first().text())
    if (!nativeId || !title || !date || !venueName) return

    const address = cleanText(item.find('[itemprop="streetAddress"]').first().text())
    const city = cleanText(item.find('[itemprop="addressLocality"]').first().text()) || 'Rzeszów'
    const category = cleanText(item.find('.ui-item-toolbox a.extra').first().text())
    const img = imageUrl(item.find('img[itemprop="image"], img.lazyload').first().attr('data-original'))

    const hourLinks = item.find('.ui-hours a[data-hour], .ui-hours a[data-track]').toArray()
    const hours = hourLinks.length
      ? hourLinks.map(h => cleanText($(h).attr('data-hour') ?? '') || extractHour($(h).attr('data-track') ?? '')).filter(Boolean)
      : [extractHour(item.find('.ui-hours').text())].filter(Boolean)

    for (const hour of hours.length ? hours : [null]) {
      const dedupeKey = `${normalizeKey(title)}|${date}|${hour ?? ''}|${normalizeKey(venueName)}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      out.push({
        externalId: `cojestgrane:${nativeId}:${date}${hour ? `:${hour}` : ''}`,
        title,
        description: title,
        date,
        startHour: hour,
        endHour: null,
        venueName,
        city,
        address: address || undefined,
        country: 'PL',
        categories: [category].filter(Boolean),
        sourceUrl,
        imageUrl: img,
      })
    }
  })

  return out
}

export class CoJestGraneRzeszowSource implements Source {
  readonly id = 'cojestgrane'
  readonly name = 'Co Jest Grane Rzeszów'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const first = await fetch(BASE, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!first.ok) throw new Error(`${first.status} for ${BASE}`)

    const firstHtml = await first.text()
    const pages = await Promise.all(
      pageUrls(firstHtml).map(async url => {
        const res = await fetch(url, {
          headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
        })
        if (!res.ok) throw new Error(`${res.status} for ${url}`)
        return res.text()
      }),
    )

    return [firstHtml, ...pages]
      .flatMap(page => parseCoJestGraneRzeszow(page))
      .filter(e => inDateWindow(e.date, options))
  }
}
