import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFntRzeszow } from './fnt-rzeszow.ts'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '__fixtures__', 'fnt_rzeszow_wydarzenia.html'), 'utf8')

describe('FNT Rzeszow events parser', () => {
  const events = parseFntRzeszow(html)

  it('extracts dated event cards with modal details', () => {
    expect(events.length).toBeGreaterThan(40)
    expect(events[0]).toMatchObject({
      externalId: 'fnt-rzeszow:74',
      title: 'ABBA I INNI Symfonicznie II',
      date: '2026-07-09',
      startHour: '19:00',
      venueName: 'Filharmonia Podkarpacka im. A. Malawskiego',
      city: 'Rzeszów',
      country: 'PL',
      categories: ['Koncerty'],
      sourceUrl: 'https://fnt-rzeszow.pl/wydarzenia#eventModal74',
      imageUrl: 'https://fnt-rzeszow.pl/storage/events/200531.webp',
    })
  })

  it('uses the modal venue and description, not only the short card text', () => {
    const kzr = events.find(e => e.externalId === 'fnt-rzeszow:139')
    expect(kzr?.title).toBe('Hołd Grzesiukowi')
    expect(kzr?.venueName).toBe('Kino za Rogiem Café - Piętro za Rogiem')
    expect(kzr?.description).toContain('Jacek Kleyff')
    expect(kzr?.description.length).toBeGreaterThan(500)
  })
})
