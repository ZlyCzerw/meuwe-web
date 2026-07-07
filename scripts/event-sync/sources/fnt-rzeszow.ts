/**
 * FNT Rzeszów event listing. Cards are grouped by category and open Bootstrap
 * modals containing the canonical title, date/time, venue, image and long
 * description. Verified from fixture fetched 2026-07-06.
 */
import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://fnt-rzeszow.pl/wydarzenia'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function parseDateTime(text: string): { date: string; hour: string | null } | null {
  const m = cleanText(text).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null
  const hour = m[4] ? `${String(Number(m[4])).padStart(2, '0')}:${m[5]}` : null
  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    hour,
  }
}

function categoryFromHeading(text: string): string {
  return cleanText(text)
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim()
}

function modalId(target: string | undefined): string | null {
  return (target ?? '').match(/^#eventModal(\d+)$/)?.[1] ?? null
}

export function parseFntRzeszow(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('main .section > .row > .col-md-6').each((_, column) => {
    const category = categoryFromHeading($(column).find('h3').first().text())

    $(column).find('> .row > .col-12 > .card').each((_, card) => {
      const target = $(card).find('[data-bs-target^="#eventModal"]').first().attr('data-bs-target')
      const id = modalId(target)
      if (!id || seen.has(id)) return

      const modal = $(`#eventModal${id}`)
      if (!modal.length) return
      const dateTime = parseDateTime(modal.find('.modal-body h6:contains("Data wydarzenia")').next('span').text())
      if (!dateTime) return

      const title = cleanText(modal.find('.modal-title').first().text())
      const venueName = cleanText(modal.find('.modal-body h6:contains("Miejsce")').next('span').text())
      if (!title || !venueName) return

      seen.add(id)
      out.push({
        externalId: `fnt-rzeszow:${id}`,
        title,
        description: cleanText(modal.find('.event-description').first().text()).slice(0, 1500),
        date: dateTime.date,
        startHour: dateTime.hour,
        endHour: null,
        venueName,
        city: 'Rzeszów',
        country: 'PL',
        categories: [category].filter(Boolean),
        sourceUrl: `${BASE}#eventModal${id}`,
        imageUrl: absoluteUrl(BASE, modal.find('.modal-body img').first().attr('src')),
      })
    })
  })

  return out
}

export class FntRzeszowSource implements Source {
  readonly id = 'fnt-rzeszow'
  readonly name = 'FNT Rzeszów wydarzenia'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(BASE, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${BASE}`)
    return parseFntRzeszow(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}
