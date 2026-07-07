/**
 * Rzeszow sports sources. First integrated source: H69 speedway schedule,
 * a static table where the Rzeszow team cell has class `active`.
 */
import * as cheerio from 'cheerio'
import { cleanText, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const H69_URL = 'https://www.h69.pl/terminarz'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function slug(input: string): string {
  return input.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseH69(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('.games-page table tr').each((_, tr) => {
    const cells = $(tr).find('td')
    const date = cleanText(cells.eq(0).text())
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    const home = cells.eq(1)
    const away = cells.eq(3)
    if (!home.hasClass('active')) return

    const homeTeam = cleanText(home.text())
    const awayTeam = cleanText(away.text())
    if (!homeTeam || !awayTeam) return

    const key = `${date}|${awayTeam}`
    if (seen.has(key)) return
    seen.add(key)

    out.push({
      externalId: `h69:${date}:${slug(awayTeam)}`,
      title: `${homeTeam} vs ${awayTeam}`,
      description: `Mecz żużlowy: ${homeTeam} vs ${awayTeam}`,
      date,
      startHour: null,
      endHour: null,
      venueName: 'Stadion Stal Rzeszów',
      city: 'Rzeszów',
      country: 'PL',
      categories: ['sport', 'żużel'],
      sourceUrl: H69_URL,
      imageUrl: home.find('img').first().attr('src'),
    })
  })

  return out
}

export class H69Source implements Source {
  readonly id = 'h69'
  readonly name = 'H69 speedway'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(H69_URL, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${H69_URL}`)
    return parseH69(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}
