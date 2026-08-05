import { WEB_ORIGIN } from './appConfig'

// iCalendar (RFC 5545) generation. Pure string work — no DOM, no platform.
//
// Times: events carry timestamptz, i.e. absolute instants, and there is no venue
// timezone column. UTC stamps (the "Z" form) are therefore the correct and only
// honest encoding: every calendar renders them in the viewer's own zone, which
// is the same wall-clock moment the app shows.

export interface IcsEvent {
  id: string
  title: string
  description?: string | null
  place_name?: string | null
  lat: number
  lng: number
  start_time: string
  end_time: string
}

/** Minutes before the start at which the calendar should remind the user. */
export const REMINDER_MINUTES = 60

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 2026-07-28T18:30:00+02:00 → 20260728T163000Z */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) throw new Error(`invalid date: ${iso}`)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are special. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * RFC 5545 §3.1: content lines are folded at 75 octets, continuations start
 * with a space. Folding counts bytes, not characters, so a Polish or Slovenian
 * title must be measured after UTF-8 encoding.
 */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const out: string[] = []
  let chunk = ''
  let chunkBytes = 0
  let limit = 75
  for (const char of line) {
    const size = new TextEncoder().encode(char).length
    if (chunkBytes + size > limit) {
      out.push(chunk)
      chunk = char
      chunkBytes = size
      limit = 74 // continuation lines lose one octet to the leading space
    } else {
      chunk += char
      chunkBytes += size
    }
  }
  out.push(chunk)
  return out.join('\r\n ')
}

/** The link that brings the reminder back to meuwe. */
export function eventUrl(eventId: string): string {
  // Universal Links (iOS) and App Links (Android) are configured for meuwe.eu,
  // so on a device with the app installed this opens the event in the app and
  // only falls back to the browser when it is not.
  return `${WEB_ORIGIN}/?event=${eventId}`
}

export function buildIcs(event: IcsEvent, now: Date = new Date()): string {
  const link = eventUrl(event.id)
  const description = [event.description?.trim(), link].filter(Boolean).join('\n\n')
  const location = event.place_name?.trim() || `${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//meuwe//meuwe.eu//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@meuwe.eu`,
    `DTSTAMP:${toIcsUtc(now.toISOString())}`,
    `DTSTART:${toIcsUtc(event.start_time)}`,
    `DTEND:${toIcsUtc(event.end_time)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${link}`,
    `GEO:${event.lat.toFixed(6)};${event.lng.toFixed(6)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:-PT${REMINDER_MINUTES}M`,
    `DESCRIPTION:${escapeIcsText(event.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

/** File name offered to the OS. Kept ASCII-safe for shaky download handlers. */
export function icsFileName(event: { id: string; title: string }): string {
  // \u0142, \u00df and \u0111 are letters in their own right, not accented forms, so NFD leaves
  // them untouched and they would be dropped by the ASCII filter below.
  const transliterated = event.title
    .replace(/\u0142/g, 'l').replace(/\u0141/g, 'L')
    .replace(/\u00df/g, 'ss')
    .replace(/\u0111/g, 'd').replace(/\u0110/g, 'D')
  const slug = transliterated
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .toLowerCase()
  return `meuwe-${slug || event.id}.ics`
}

function eventPlace(event: IcsEvent): string {
  return event.place_name?.trim() || `${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}`
}

function eventNotes(event: IcsEvent): string {
  return [event.description?.trim(), eventUrl(event.id)].filter(Boolean).join('\n\n')
}

/**
 * Google Calendar's "template" form. On Android this address is claimed by the
 * installed Google Calendar, so it opens the app with the event already filled
 * in rather than a web page.
 */
export function googleCalendarUrl(event: IcsEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toIcsUtc(event.start_time)}/${toIcsUtc(event.end_time)}`,
    details: eventNotes(event),
    location: eventPlace(event),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Outlook's compose form. It wants ISO 8601 rather than the compact iCalendar
 * stamp — same instant, different spelling, and getting it wrong moves the
 * event without saying so.
 */
export function outlookCalendarUrl(event: IcsEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: new Date(event.start_time).toISOString(),
    enddt: new Date(event.end_time).toISOString(),
    body: eventNotes(event),
    location: eventPlace(event),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
