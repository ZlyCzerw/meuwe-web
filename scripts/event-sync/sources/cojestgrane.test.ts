import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCoJestGraneRzeszow } from './cojestgrane.ts'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '__fixtures__', 'cojestgrane_rzeszow.html'), 'utf8')

describe('Co Jest Grane Rzeszow events parser', () => {
  const events = parseCoJestGraneRzeszow(html)

  it('extracts schema.org event cards with venue address and ticket hour', () => {
    expect(events.length).toBeGreaterThan(20)
    expect(events[0]).toMatchObject({
      externalId: 'cojestgrane:84s2:2026-07-09:19:00',
      title: 'ABBA I INNI Symfonicznie II',
      date: '2026-07-09',
      startHour: '19:00',
      venueName: 'Filharmonia Podkarpacka im. A. Malawskiego',
      address: 'ul. Fryderyka Chopina 30',
      city: 'Rzeszów',
      country: 'PL',
      categories: ['teatr'],
      sourceUrl: 'https://cojestgrane.pl/polska/podkarpackie/rzeszow/wydarzenie/84s2/abba-i-inni-symfonicznie-ii/jest',
      imageUrl: 'https://cdn.cojestgrane.pl/m/bpxf.webp',
    })
  })

  it('emits one event per listed hour and skips duplicate ticketing copies', () => {
    const prestiz = events.filter(e => e.title === 'Prestiż - współczesny spektakl')
    expect(prestiz.map(e => e.startHour).sort()).toEqual(['16:00', '18:30'])
    expect(prestiz.map(e => e.externalId).sort()).toEqual([
      'cojestgrane:7ntq:2026-09-20:16:00',
      'cojestgrane:7ntq:2026-09-20:18:30',
    ])
    expect(prestiz.every(e => e.imageUrl === undefined)).toBe(true)
  })

  it('keeps venue names and addresses from less common venues', () => {
    const szydlo = events.find(e => e.externalId === 'cojestgrane:9l4q:2026-09-20:17:00')
    expect(szydlo).toMatchObject({
      title: 'Spektakl pt: " Szydło z Worka" Teatr Bo Tak',
      venueName: 'Wojewódzki Dom Kultury',
      address: 'ul. Stefana Okrzei 7',
      categories: ['teatr'],
    })
  })
})
