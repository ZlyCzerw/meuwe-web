import type { RawEvent, ScrapeOptions } from '../types.ts'

export function cleanText(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&hellip;/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
}

export function absoluteUrl(base: string, href: string | undefined | null): string | undefined {
  const h = (href ?? '').trim()
  if (!h) return undefined
  return new URL(h, base).toString()
}

export function extractHour(text: string): string | null {
  const m = text.match(/\b(?:godz\.?\s*)?(\d{1,2}):(\d{2})(?!\d)/i)
  if (!m) return null
  const hour = Number(m[1])
  if (hour < 0 || hour > 23) return null
  return `${String(hour).padStart(2, '0')}:${m[2]}`
}

export function inDateWindow(date: string, options: ScrapeOptions): boolean {
  const from = options.dateFrom.toISOString().slice(0, 10)
  const to = options.dateTo.toISOString().slice(0, 10)
  return date >= from && date <= to
}

export interface VenueOwnedRawParams {
  sourceId: string
  nativeId: string
  title: string
  description: string
  date: string
  startHour: string | null
  endHour?: string | null
  venueName: string
  city: string
  address?: string
  country: string
  categories?: string[]
  sourceUrl?: string
  imageUrl?: string
}

export function venueOwnedRaw(params: VenueOwnedRawParams): RawEvent {
  return {
    externalId: `${params.sourceId}:${params.nativeId}`,
    title: cleanText(params.title),
    description: cleanText(params.description),
    date: params.date,
    startHour: params.startHour,
    endHour: params.endHour ?? null,
    venueName: params.venueName,
    city: params.city,
    address: params.address,
    country: params.country,
    categories: params.categories ?? [],
    sourceUrl: params.sourceUrl,
    imageUrl: params.imageUrl,
  }
}
