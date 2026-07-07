import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRosir } from './rosir.ts'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '__fixtures__', 'rosir_wydarzenia.html'), 'utf8')

describe('ROSiR events parser', () => {
  const events = parseRosir(html)

  it('extracts unique dated event cards from repeated sections', () => {
    expect(events).toHaveLength(4)
    expect(events.map(e => e.title)).toEqual([
      'Piana Party (26.06) i Wodny Tor Przeszkód na Basenach Otwartych',
      'Treningi Pływackie na Basenach Otwartych 2026 - zapisz się już teraz!',
      'MISTRZOSTWA EUROPY JUNIORÓW I MŁODZIKÓW W SZACHACH SZYBKICH I BŁYSKAWICZNYCH',
      'MISTRZOSTWA POLSKI JUNIORÓW I MŁODZIKÓW W SZACHACH SZYBKICH I BŁYSKAWICZNYCH',
    ])
  })

  it('keeps date ranges and venue-owned locations', () => {
    expect(events[0]).toMatchObject({
      externalId: 'rosir:17508:2026-06-26',
      date: '2026-06-26',
      endDate: '2026-07-12',
      venueName: 'Baseny otwarte ROSIR',
      city: 'Rzeszów',
      country: 'PL',
      sourceUrl: 'https://rosir.pl/wydarzenia/piana-party-26-06-i-wodny-tor-przeszkod-na-basenach-otwartych/',
    })

    expect(events[2]).toMatchObject({
      externalId: 'rosir:18116:2026-07-07',
      date: '2026-07-07',
      endDate: '2026-07-09',
      venueName: 'Hala Podpromie (RSCW)',
    })
  })

  it('provides cover images for event cards', () => {
    expect(events[0].imageUrl).toBe('https://rosir.pl/wp-content/uploads/2026/06/IMG-20260624-WA0006-1-e1782370686766.jpg')
  })
})
