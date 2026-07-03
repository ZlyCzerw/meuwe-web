/**
 * Official Miasto Rzeszow calendar. The listing has event dates and detail
 * URLs; detail pages carry hour and venue in the article body. Verified live
 * 2026-07-03.
 */
import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, extractHour, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://erzeszow.pl/41-miasto-rzeszow/6241-kalendarz-imprez.html'
const ORIGIN = 'https://erzeszow.pl'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const MAX_DETAIL_FETCHES = 60

export interface ErzeszowListItem {
  date: string
  title: string
  url: string
}

export interface ErzeszowDetail {
  description: string
  venueName: string
  startHour: string | null
  imageUrl?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

function parseDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

function isLikelyVenue(text: string): boolean {
  const lower = text.toLowerCase()
  if (/^(bilety|zasady|wstęp|wstep|udział|udzial|bezpłatnie|bezplatnie)/.test(lower)) return false
  return /ul\.|ulica|skwer|sala|filharmon|galeria|park|rynek|zamek|bulwar|hala|stadion|plac|ogr[oó]d|amfiteatr|kino|teatr|dworek/i.test(text)
}

export function parseListing(html: string): ErzeszowListItem[] {
  const $ = cheerio.load(html)
  const items: ErzeszowListItem[] = []
  const seen = new Set<string>()

  $('#events-list li').each((_, el) => {
    const date = parseDate(cleanText($(el).find('.events-date').first().text()))
    const a = $(el).find('.events-link a[href]').first()
    const title = cleanText(a.text())
    const url = absoluteUrl(ORIGIN, a.attr('href')?.split('#')[0])
    if (!date || !title || !url) return
    const key = `${date}|${url}`
    if (seen.has(key)) return
    seen.add(key)
    items.push({ date, title, url })
  })

  return items
}

export function parseDetail(html: string): ErzeszowDetail {
  const $ = cheerio.load(html)
  const body = $('#akapitBody').first()
  const description = cleanText(body.text()).slice(0, 1500)
  const imageUrl = absoluteUrl(ORIGIN, body.closest('.row').find('.images img').first().attr('src'))

  let venueName = ''
  let startHour = extractHour(description)
  const detailHtml = body.html() ?? ''
  const strongAfterDate = detailHtml.match(/<strong>\s*\d{1,2}\s+[a-ząćęłńóśźż]+\s+\d{4}\s*\|\s*godz\.\s*\d{1,2}:\d{2}\s*<\/strong>\s*<br\s*\/?>\s*<strong>(.*?)<\/strong>/i)
  if (strongAfterDate) {
    const candidate = cleanText(cheerio.load(strongAfterDate[1]).text())
    if (isLikelyVenue(candidate)) venueName = candidate
  }

  if (!venueName) {
    body.find('p').each((_, p) => {
      if (venueName) return
      const text = cleanText($(p).text())
      const hour = extractHour(text)
      if (hour && !startHour) startHour = hour
      const lines = ($(p).html() ?? '')
        .split(/<br\s*\/?>/i)
        .map(line => cleanText(cheerio.load(line).text()))
        .filter(Boolean)
      const dateLine = lines.findIndex(line => extractHour(line) !== null)
      if (dateLine >= 0 && lines[dateLine + 1] && isLikelyVenue(lines[dateLine + 1])) {
        venueName = lines[dateLine + 1]
      }
    })
  }

  return { description, venueName, startHour, imageUrl }
}

function toRaw(item: ErzeszowListItem, detail: ErzeszowDetail): RawEvent | null {
  if (!detail.venueName) return null
  const id = item.url.match(/\/(\d+)-[^/]+\.html/)?.[1] ?? encodeURIComponent(item.url)
  return {
    externalId: `erzeszow:${id}:${item.date}`,
    title: item.title,
    description: detail.description,
    date: item.date,
    startHour: detail.startHour,
    endHour: null,
    venueName: detail.venueName,
    city: 'Rzeszów',
    country: 'PL',
    categories: [],
    sourceUrl: item.url,
    imageUrl: detail.imageUrl,
  }
}

export class ErzeszowSource implements Source {
  readonly id = 'erzeszow'
  readonly name = 'Miasto Rzeszów kalendarz imprez'

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${url}`)
    return res.text()
  }

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const items = parseListing(await this.fetchText(BASE))
      .filter(i => inDateWindow(i.date, options))
      .slice(0, MAX_DETAIL_FETCHES)
    const out: RawEvent[] = []

    for (const item of items) {
      await new Promise(r => setTimeout(r, 250))
      try {
        const raw = toRaw(item, parseDetail(await this.fetchText(item.url)))
        if (raw) out.push(raw)
      } catch (err) {
        console.warn(`  [${this.name}] detail failed: ${(err as Error).message}`)
      }
    }

    return out
  }
}
