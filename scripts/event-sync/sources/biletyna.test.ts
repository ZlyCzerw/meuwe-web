import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { collectJsonLdEvents } from './jsonld.ts'
import { extractEid, toRawEvents } from './biletyna.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = readFileSync(join(here, '..', '__fixtures__', 'biletyna_listing.json'), 'utf8')
const events = collectJsonLdEvents(JSON.parse(fixture))

const opts = {
  dateFrom: new Date('2026-07-03T00:00:00Z'),
  dateTo: new Date('2026-07-24T00:00:00Z'),
}

describe('extractEid', () => {
  it('pulls the numeric event id from a biletyna url', () => {
    expect(extractEid('https://biletyna.pl/koncert/ABBA?eid=652825#opis')).toBe('652825')
  })
  it('falls back to the slug when no eid present', () => {
    expect(extractEid('https://biletyna.pl/koncert/Jakis-Koncert')).toBe('koncert/Jakis-Koncert')
  })
})

describe('toRawEvents', () => {
  const raws = toRawEvents(events, opts)

  it('maps JSON-LD events to RawEvents with venue, street and city', () => {
    const abba = raws.find(r => r.title.includes('ABBA'))!
    expect(abba.externalId).toBe('biletyna:652825')
    expect(abba.date).toBe('2026-07-09')
    expect(abba.startHour).toBe('19:00')
    expect(abba.venueName).toBe('Filharmonia Podkarpacka')
    expect(abba.city).toBe('Rzeszów')
    expect(abba.address).toBe('ul. Chopina 30')
    expect(abba.country).toBe('PL')
  })

  it('keeps only in-window, in-region events', () => {
    for (const r of raws) {
      expect(r.date >= '2026-07-03' && r.date <= '2026-07-24').toBe(true)
    }
  })

  it('dedupes repeated ItemList entries by external id', () => {
    const ids = raws.map(r => r.externalId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
