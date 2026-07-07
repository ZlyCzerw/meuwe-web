import { describe, expect, it } from 'vitest'
import { absoluteUrl, cleanText, extractHour, inDateWindow, venueOwnedRaw } from './source-helpers.ts'

const options = {
  dateFrom: new Date('2026-07-03T00:00:00Z'),
  dateTo: new Date('2026-07-24T00:00:00Z'),
}

describe('source helpers', () => {
  it('cleans text', () => {
    expect(cleanText('  Ala\n\tma&nbsp; kota  ')).toBe('Ala ma kota')
  })

  it('resolves absolute URLs', () => {
    expect(absoluteUrl('https://example.com/a/b/', '/event/1')).toBe('https://example.com/event/1')
    expect(absoluteUrl('https://example.com/a/b/', 'https://other.test/x')).toBe('https://other.test/x')
    expect(absoluteUrl('https://example.com/a/b/', '')).toBeUndefined()
  })

  it('extracts Polish-style hours', () => {
    expect(extractHour('start godz. 19:30')).toBe('19:30')
    expect(extractHour('20:00 koncert')).toBe('20:00')
    expect(extractHour('brak godziny')).toBeNull()
  })

  it('checks inclusive date window', () => {
    expect(inDateWindow('2026-07-03', options)).toBe(true)
    expect(inDateWindow('2026-07-24', options)).toBe(true)
    expect(inDateWindow('2026-07-25', options)).toBe(false)
  })

  it('builds venue-owned RawEvent with default venue and city', () => {
    const raw = venueOwnedRaw({
      sourceId: 'nightlife',
      nativeId: 'gramofon-1',
      title: 'Jam session',
      description: '',
      date: '2026-07-10',
      startHour: '20:00',
      venueName: 'Jazz Club Gramofon',
      city: 'Rzeszów',
      country: 'PL',
      sourceUrl: 'https://jazz.rzeszow.pl/event',
      categories: ['jazz'],
    })
    expect(raw.externalId).toBe('nightlife:gramofon-1')
    expect(raw.venueName).toBe('Jazz Club Gramofon')
    expect(raw.city).toBe('Rzeszów')
    expect(raw.startHour).toBe('20:00')
  })
})
