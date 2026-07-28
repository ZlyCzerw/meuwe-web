import { describe, it, expect } from 'vitest'
import {
  buildIcs, toIcsUtc, escapeIcsText, foldIcsLine, icsFileName,
  googleCalendarUrl, eventUrl, REMINDER_MINUTES, type IcsEvent,
} from './ics'

const event: IcsEvent = {
  id: 'abc-123',
  title: 'Koncert w knajpie',
  description: 'Gramy od 21:00',
  place_name: 'Bar Rynek 4',
  lat: 50.0413,
  lng: 21.999,
  start_time: '2026-08-01T19:00:00+02:00',
  end_time: '2026-08-01T23:30:00+02:00',
}

const NOW = new Date('2026-07-28T10:00:00Z')

describe('toIcsUtc', () => {
  it('converts a zoned instant to a UTC stamp', () => {
    expect(toIcsUtc('2026-08-01T19:00:00+02:00')).toBe('20260801T170000Z')
  })

  it('keeps an already-UTC instant', () => {
    expect(toIcsUtc('2026-01-05T08:07:06Z')).toBe('20260105T080706Z')
  })

  it('refuses a broken date instead of emitting a bad stamp', () => {
    expect(() => toIcsUtc('not a date')).toThrow(/invalid date/)
  })
})

describe('escapeIcsText', () => {
  it('escapes the RFC 5545 specials', () => {
    expect(escapeIcsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d')
  })

  it('turns real newlines into the literal escape', () => {
    expect(escapeIcsText('line1\nline2')).toBe('line1\\nline2')
    expect(escapeIcsText('line1\r\nline2')).toBe('line1\\nline2')
  })
})

describe('foldIcsLine', () => {
  it('leaves short lines alone', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds long lines with a leading space on continuations', () => {
    const folded = foldIcsLine('DESCRIPTION:' + 'x'.repeat(200))
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.slice(1).every(p => p.startsWith(' '))).toBe(true)
    // Unfolding must give the original back.
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe('DESCRIPTION:' + 'x'.repeat(200))
  })

  it('measures octets, not characters, so accents cannot overflow a line', () => {
    const folded = foldIcsLine('SUMMARY:' + 'ą'.repeat(60))
    for (const part of folded.split('\r\n')) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    }
  })
})

describe('buildIcs', () => {
  const ics = buildIcs(event, NOW)

  it('is a single well-formed VEVENT', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('UID:abc-123@meuwe.eu')
  })

  it('uses CRLF line endings', () => {
    expect(ics.split('\r\n').length).toBeGreaterThan(15)
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('writes the start and end as UTC instants', () => {
    expect(ics).toContain('DTSTART:20260801T170000Z')
    expect(ics).toContain('DTEND:20260801T213000Z')
    expect(ics).toContain('DTSTAMP:20260728T100000Z')
  })

  it('carries the title, place and coordinates', () => {
    expect(ics).toContain('SUMMARY:Koncert w knajpie')
    expect(ics).toContain('LOCATION:Bar Rynek 4')
    expect(ics).toContain('GEO:50.041300;21.999000')
  })

  it('puts the meuwe link in the description so the reminder leads back', () => {
    expect(ics).toContain('https://meuwe.eu/?event=abc-123')
    expect(ics).toContain('URL:https://meuwe.eu/?event=abc-123')
  })

  it('reminds 60 minutes before the start', () => {
    expect(REMINDER_MINUTES).toBe(60)
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT60M')
    expect(ics).toContain('ACTION:DISPLAY')
    expect(ics).toContain('END:VALARM')
  })

  it('falls back to coordinates when there is no place name', () => {
    const out = buildIcs({ ...event, place_name: null }, NOW)
    expect(out).toContain('LOCATION:50.04130\\, 21.99900')
  })

  it('still includes the link when the event has no description', () => {
    const out = buildIcs({ ...event, description: null }, NOW)
    expect(out).toContain('DESCRIPTION:https://meuwe.eu/?event=abc-123')
  })

  it('escapes a comma in the title instead of splitting the property', () => {
    const out = buildIcs({ ...event, title: 'Piknik, gry i muzyka' }, NOW)
    expect(out).toContain('SUMMARY:Piknik\\, gry i muzyka')
  })

  it('keeps every line within the 75 octet limit', () => {
    const out = buildIcs({
      ...event,
      title: 'Bardzo długi tytuł wydarzenia z polskimi znakami ąćęłńóśźż i jeszcze więcej tekstu',
      description: 'Opis '.repeat(60),
    }, NOW)
    for (const line of out.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })
})

describe('icsFileName', () => {
  it('slugifies the title', () => {
    expect(icsFileName({ id: 'x', title: 'Koncert w knajpie' })).toBe('meuwe-koncert-w-knajpie.ics')
  })

  it('strips diacritics and punctuation', () => {
    expect(icsFileName({ id: 'x', title: 'Piknik: Łąka & Grill!' })).toBe('meuwe-piknik-laka-grill.ics')
  })

  it('falls back to the id when nothing usable is left', () => {
    expect(icsFileName({ id: 'abc-123', title: '🎉🎉' })).toBe('meuwe-abc-123.ics')
  })
})

describe('googleCalendarUrl', () => {
  const url = new URL(googleCalendarUrl(event))

  it('targets the Google Calendar template form', () => {
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
  })

  it('passes the same instants and the meuwe link', () => {
    expect(url.searchParams.get('dates')).toBe('20260801T170000Z/20260801T213000Z')
    expect(url.searchParams.get('text')).toBe('Koncert w knajpie')
    expect(url.searchParams.get('details')).toContain(eventUrl('abc-123'))
  })
})
