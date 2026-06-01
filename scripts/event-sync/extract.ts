import type { CheerioAPI } from 'cheerio'

/** First non-empty, trimmed string from the candidates; '' if none. */
function firstNonEmpty(...vals: Array<string | undefined | null>): string {
  for (const v of vals) {
    const t = (v ?? '').trim()
    if (t) return t
  }
  return ''
}

/** og:title → itemprop="name" → first h1 → listing title. */
export function extractTitle($: CheerioAPI, listingTitle: string): string {
  return firstNonEmpty(
    $('meta[property="og:title"]').attr('content'),
    $('h1[itemprop="name"] span').first().text(),
    $('h1').first().text(),
    listingTitle,
  )
}

/** og:description → group-datos paragraphs → any long <p> → fallback. */
export function extractDescription($: CheerioAPI, fallback: string): string {
  const og = ($('meta[property="og:description"]').attr('content') ?? '').trim()
  if (og.length > 20) return og.slice(0, 1200)

  const parts: string[] = []
  $('div.group-datos p').each((_, el) => {
    const t = $(el).text().trim()
    if (t.length > 20 && parts.length < 3) parts.push(t)
  })
  if (!parts.length) {
    $('p').each((_, el) => {
      const t = $(el).text().trim()
      if (t.length > 40 && parts.length < 2) parts.push(t)
    })
  }
  const joined = parts.join(' ').slice(0, 1200).trim()
  return joined || fallback
}

/** og:image → itemprop="image" (content or src) → null. */
export function extractImage($: CheerioAPI): string | null {
  const img = firstNonEmpty(
    $('meta[property="og:image"]').attr('content'),
    $('[itemprop="image"]').attr('content'),
    $('[itemprop="image"]').attr('src'),
    $('[itemprop="image"]').attr('href'),
  )
  return img || null
}

/** BreadcrumbList JSON-LD (items linking to /categoria/) → /categoria/ links. */
export function extractCategories($: CheerioAPI): string[] {
  const cats: string[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text())
      if (json['@type'] === 'BreadcrumbList') {
        for (const it of json.itemListElement ?? []) {
          const name: string | undefined = it?.item?.name
          const id: string = it?.item?.['@id'] ?? ''
          if (name && id.includes('/categoria/') && !cats.includes(name)) {
            cats.push(name)
          }
        }
      }
    } catch {
      /* malformed JSON-LD — ignore and fall through */
    }
  })

  if (!cats.length) {
    $('div.s-tags a[href^="/categoria/"]').each((_, el) => {
      const c = $(el).text().trim()
      if (c && !cats.includes(c)) cats.push(c)
    })
  }

  return cats
}

export interface TimeVenue {
  startHour: string | null
  endHour: string | null
  venueName: string | null
}

/** Scan group-datos paragraphs for the first 'HH:MM ... venue' pattern. */
export function extractTimeVenue($: CheerioAPI): TimeVenue {
  let startHour: string | null = null
  let venueName: string | null = null

  $('div.group-datos p').each((_, el) => {
    if (startHour) return
    const text = $(el).text()
    const m = text.match(/[-–]?\s*(\d{1,2}:\d{2})\s*(?:h|:)?\s*([^-\n]{0,60})/)
    if (m) {
      const hm = m[1].match(/(\d{1,2}):(\d{2})/)
      if (hm) startHour = `${hm[1].padStart(2, '0')}:${hm[2]}`
      const venue = m[2].replace(/^\s*(en |el |la |los |las )/i, '').trim()
      if (venue.length > 3 && venue.length < 80) venueName = venue
    }
  })

  return { startHour, endHour: null, venueName }
}
