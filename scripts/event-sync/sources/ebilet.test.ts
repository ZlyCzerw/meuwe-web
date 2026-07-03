import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { extractGroupApiUrls, toRawEvents, type EbiletApiEvent } from './ebilet.ts'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(here, '..', '__fixtures__', 'ebilet_group_events.json'), 'utf8'),
) as { events: EbiletApiEvent[] }

const opts = {
  dateFrom: new Date('2026-07-03T00:00:00Z'),
  dateTo: new Date('2026-07-24T00:00:00Z'),
}

describe('extractGroupApiUrls', () => {
  it('finds unique group event API urls in landing HTML', () => {
    const html = `
      fetch("https://www.ebilet.pl/api/LandingPage/group/02db2641-2c21-41d3-aeb1-055f5a25a7f8/event")
      fetch("https://www.ebilet.pl/api/LandingPage/group/02db2641-2c21-41d3-aeb1-055f5a25a7f8/event")
      fetch("https://www.ebilet.pl/api/LandingPage/group/099d324f-022e-4295-8ae5-4e844bcba52d/place")
      fetch("https://www.ebilet.pl/api/LandingPage/group/765c8a47-e869-4db1-84de-db239b2ab2bc/event")`
    const urls = extractGroupApiUrls(html)
    expect(urls).toHaveLength(2) // /place group ignored, duplicate deduped
    for (const u of urls) expect(u).toMatch(/\/event$/)
  })
})

describe('toRawEvents', () => {
  const raws = toRawEvents(fixture.events, opts)

  it('keeps only in-region, in-window, non-cancelled events', () => {
    expect(raws.map(r => r.externalId).sort()).toEqual([
      'ebilet:11111111-1111-1111-1111-111111111111',
      'ebilet:22222222-2222-2222-2222-222222222222',
    ])
  })
  it('carries exact venue, street address and city', () => {
    const filharmonia = raws.find(r => r.externalId.includes('1111'))!
    expect(filharmonia.venueName).toBe('Filharmonia Podkarpacka im. Artura Malawskiego')
    expect(filharmonia.address).toBe('Chopina 30')
    expect(filharmonia.city).toBe('Rzeszów')
    expect(filharmonia.date).toBe('2026-07-09')
    expect(filharmonia.startHour).toBe('19:00')
    expect(filharmonia.country).toBe('PL')
  })
})
