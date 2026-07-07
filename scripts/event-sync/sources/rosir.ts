/**
 * ROSiR events archive. The `/wydarzenia/` page renders Kadence query cards
 * with title, source URL, start/end dates and category classes. Verified live
 * 2026-07-07.
 */
import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://rosir.pl/wydarzenia/'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export interface RosirRawEvent extends RawEvent {
  endDate: string | null
}

function text(input: string): string {
  return cleanText(input).replace(/[–—]/g, '-')
}

function parseDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function postId(classes: string): string | null {
  return classes.match(/\bpost-(\d+)\b/)?.[1] ?? null
}

function imageFromStyle(html: string): string | undefined {
  return absoluteUrl(BASE, html.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/)?.[1])
}

function venueFor(classes: string, title: string): string | null {
  const haystack = `${classes} ${title}`.toLowerCase()
  if (haystack.includes('category-hala-rcsw-podpromie') || haystack.includes('podpromie')) {
    return 'Hala Podpromie (RSCW)'
  }
  if (
    haystack.includes('category-baseny-otwarte-rosir') ||
    haystack.includes('basenach otwartych') ||
    haystack.includes('baseny otwarte')
  ) {
    return 'Baseny otwarte ROSIR'
  }
  return null
}

function categoriesFor(classes: string, title: string): string[] {
  const out = ['sport', 'rekreacja']
  const haystack = `${classes} ${title}`.toLowerCase()
  if (haystack.includes('szach')) out.push('szachy')
  if (haystack.includes('basen') || haystack.includes('plywack') || haystack.includes('pływack')) out.push('basen')
  return out
}

export function parseRosir(html: string): RosirRawEvent[] {
  const $ = cheerio.load(html)
  const out: RosirRawEvent[] = []
  const seen = new Set<string>()

  $('.kb-query-item.kb-query-block-post').each((_, el) => {
    const item = $(el)
    const classes = item.attr('class') ?? ''
    const link = item.find('a.kb-advanced-heading-link[href]').first()
    const title = text(link.text())
    const sourceUrl = absoluteUrl(BASE, link.attr('href'))
    const id = postId(classes)
    if (!title || !sourceUrl || !id) return

    const dates = item
      .find('p.wp-block-kadence-advancedheading')
      .toArray()
      .map(p => parseDate(cleanText($(p).text())))
      .filter((d): d is string => Boolean(d))
    const date = dates[0]
    if (!date) return

    const venueName = venueFor(classes, title)
    if (!venueName) return

    const key = `${id}:${date}`
    if (seen.has(key)) return
    seen.add(key)

    const endDate = dates.find(d => d !== date) ?? null
    out.push({
      externalId: `rosir:${key}`,
      title,
      description: cleanText(item.text()).slice(0, 1500),
      date,
      endDate,
      startHour: null,
      endHour: null,
      venueName,
      city: 'Rzeszów',
      country: 'PL',
      categories: categoriesFor(classes, title),
      sourceUrl,
      imageUrl: imageFromStyle(item.html() ?? ''),
    })
  })

  return out
}

export class RosirSource implements Source {
  readonly id = 'rosir'
  readonly name = 'ROSiR Rzeszów wydarzenia'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(BASE, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${BASE}`)
    return parseRosir(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}
