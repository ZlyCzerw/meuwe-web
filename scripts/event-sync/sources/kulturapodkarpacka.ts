/**
 * Podkarpacki Informator Kulturalny. The homepage mixes regional event cards,
 * venue cards and articles, so this source keeps only event-box cards that can
 * be assigned to a known Rzeszów venue from title/description text.
 * Verified from fixture fetched 2026-07-06.
 */
import * as cheerio from 'cheerio'
import { absoluteUrl, cleanText, inDateWindow } from './source-helpers.ts'
import type { RawEvent, ScrapeOptions, Source } from '../types.ts'

const BASE = 'https://kulturapodkarpacka.pl/'
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

interface VenueHint {
  name: string
  address: string
}

const VENUE_HINTS: Array<[RegExp, VenueHint]> = [
  [/kini[eo] za rogiem/i, { name: 'Kino za Rogiem Café', address: 'ul. Świętego Mikołaja 6' }],
  [/filharmonia podkarpacka/i, { name: 'Filharmonia Podkarpacka', address: 'ul. Fryderyka Chopina 30' }],
  [/wojewodzki dom kultury|\bwdk\b/i, { name: 'Wojewódzki Dom Kultury w Rzeszowie', address: 'ul. S. Okrzei 7' }],
  [/biuro wystaw artystycznych.*rzeszow|bwa rzeszow/i, { name: 'Biuro Wystaw Artystycznych w Rzeszowie', address: 'ul. Jana III Sobieskiego 18' }],
  [/muzeum etnograficzne/i, { name: 'Muzeum Etnograficzne im. Franciszka Kotuli', address: 'Rynek 6' }],
  [/plac farny/i, { name: 'Plac Farny', address: 'Plac Farny' }],
]

function normalizeText(text: string): string {
  return cleanText(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function startDateFromRange(text: string): string | null {
  const value = cleanText(text)
  const full = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (full) return formatDate(Number(full[3]), Number(full[2]), Number(full[1]))

  const sameMonth = value.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (sameMonth) return formatDate(Number(sameMonth[4]), Number(sameMonth[3]), Number(sameMonth[1]))

  const crossMonth = value.match(/^(\d{1,2})\.(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (crossMonth) return formatDate(Number(crossMonth[5]), Number(crossMonth[2]), Number(crossMonth[1]))

  return null
}

function formatDate(year: number, month: number, day: number): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function slugFromUrl(url: string): string {
  const pathname = new URL(url).pathname.replace(/\/+$/g, '')
  return pathname.split('/').filter(Boolean).pop() ?? encodeURIComponent(url)
}

function venueFromText(text: string): VenueHint | null {
  const normalized = normalizeText(text)
  for (const [pattern, venue] of VENUE_HINTS) {
    if (pattern.test(normalized)) return venue
  }
  return null
}

export function parseKulturaPodkarpacka(html: string): RawEvent[] {
  const $ = cheerio.load(html)
  const out: RawEvent[] = []
  const seen = new Set<string>()

  $('a.event-box[href]').each((_, el) => {
    const card = $(el)
    const sourceUrl = absoluteUrl(BASE, card.attr('href'))
    const title = cleanText(card.find('.title-attr').first().text())
    const date = startDateFromRange(card.find('.date-attr').first().text())
    if (!sourceUrl || !title || !date) return

    const description = cleanText(card.find('.info-attr').first().text())
    const venue = venueFromText(`${title} ${description}`)
    if (!venue) return

    const id = slugFromUrl(sourceUrl)
    if (seen.has(id)) return
    seen.add(id)

    const category = cleanText(card.find('.category-title span').first().text())

    out.push({
      externalId: `kulturapodkarpacka:${id}`,
      title,
      description,
      date,
      startHour: null,
      endHour: null,
      venueName: venue.name,
      city: 'Rzeszów',
      address: venue.address,
      country: 'PL',
      categories: [category].filter(Boolean),
      sourceUrl,
      imageUrl: absoluteUrl(BASE, card.find('img').first().attr('src')),
    })
  })

  return out
}

export class KulturaPodkarpackaSource implements Source {
  readonly id = 'kulturapodkarpacka'
  readonly name = 'Podkarpacki Informator Kulturalny'

  async scrape(options: ScrapeOptions): Promise<RawEvent[]> {
    const res = await fetch(BASE, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'pl' },
    })
    if (!res.ok) throw new Error(`${res.status} for ${BASE}`)
    return parseKulturaPodkarpacka(await res.text()).filter(e => inDateWindow(e.date, options))
  }
}
