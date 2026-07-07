import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTorzeszow } from './torzeszow.ts'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '__fixtures__', 'torzeszow_wydarzenia.html'), 'utf8')

describe('toRzeszow events parser', () => {
  const events = parseTorzeszow(html)

  it('extracts server-rendered event cards', () => {
    expect(events.length).toBeGreaterThanOrEqual(12)
    expect(events[0]).toMatchObject({
      externalId: 'torzeszow:kino-letnie-2026-w-ogrodku-zorzy:2026-07-06',
      title: 'Kino Letnie 2026 w ogródku Zorzy',
      date: '2026-07-06',
      startHour: null,
      venueName: 'Kino Zorza',
      city: 'Rzeszów',
      country: 'PL',
      categories: ['Film'],
      sourceUrl: 'https://torzeszow.pl/wydarzenie/kino-letnie-2026-w-ogrodku-zorzy/',
      imageUrl: 'https://torzeszow.pl/wp-content/uploads/2026/06/zorza_kino_letnie_2026-768x486.webp',
    })
  })

  it('extracts hours and keeps repeated event slugs by date', () => {
    const march = events.find(e => e.externalId === 'torzeszow:marsz-pamieci-przejdzie-ulicami-rzeszowa-hold-ofiarom-likwidacji-getta:2026-07-07')
    expect(march?.startHour).toBe('17:00')
    expect(march?.venueName).toBe('Plac Ofiar Getta')

    const walks = events.filter(e => e.sourceUrl === 'https://torzeszow.pl/wydarzenie/poznaj-rzeszow-z-przewodnikiem-wybierz-sie-spacer-po-srodmiesciu/')
    expect(walks.map(e => e.date)).toEqual([
      '2026-07-12',
      '2026-07-18',
      '2026-08-01',
      '2026-08-09',
      '2026-08-23',
      '2026-08-29',
    ])
  })
})
