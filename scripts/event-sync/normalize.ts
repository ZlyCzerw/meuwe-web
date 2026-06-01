import type { RawEvent } from './types.ts'

export interface NormalizeResult {
  /** null = dropped (only when the date is missing or invalid). */
  event: RawEvent | null
  warnings: string[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Fill missing fields with sensible defaults so events are never dropped for
 * incomplete data. The ONLY hard requirement is a valid 'YYYY-MM-DD' date,
 * because start_time/end_time are NOT NULL and place the event on the timeline.
 */
export function normalizeEvent(raw: RawEvent): NormalizeResult {
  if (!raw.date || !DATE_RE.test(raw.date)) {
    return { event: null, warnings: ['no-date'] }
  }

  const title = (raw.title ?? '').trim()
  if (!title) {
    return { event: null, warnings: ['no-title'] }
  }

  const warnings: string[] = []
  const city = (raw.city ?? '').trim()

  let description = (raw.description ?? '').trim()
  if (!description) {
    description = city ? `${title}. ${city}.` : `${title}.`
    warnings.push('empty-description')
  }

  let startHour = (raw.startHour ?? '').trim()
  if (!startHour) {
    startHour = '19:00'
    warnings.push('default-time')
  }

  let venueName = (raw.venueName ?? '').trim()
  if (!venueName) {
    venueName = city
    warnings.push('default-venue')
  }

  return {
    event: {
      ...raw,
      title,
      description,
      city,
      startHour,
      venueName,
      categories: raw.categories ?? [],
    },
    warnings,
  }
}
