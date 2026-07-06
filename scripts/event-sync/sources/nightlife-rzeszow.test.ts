import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStrefa57, parseUnderground } from './nightlife-rzeszow.ts'

const here = dirname(fileURLToPath(import.meta.url))
const strefa57 = readFileSync(join(here, '..', '__fixtures__', 'nightlife_strefa57.html'), 'utf8')
const underground = readFileSync(join(here, '..', '__fixtures__', 'nightlife_underground.html'), 'utf8')

describe('Strefa 57 parser', () => {
  const events = parseStrefa57(strefa57)

  it('extracts dated venue-owned concert cards', () => {
    expect(events.length).toBeGreaterThanOrEqual(6)
    expect(events[0]).toMatchObject({
      externalId: 'strefa57:10147',
      title: 'WHITE 2115 • YOUNG MULTI • KIZO • CHIVAS • MALIK MONTANA • ZEAMSONE',
      date: '2026-07-04',
      venueName: 'Strefa 57',
      city: 'Rzeszów',
      country: 'PL',
      categories: ['music', 'nightlife'],
      sourceUrl: 'https://strefa57.com/wydarzenia/festival-sb-04-07-26/',
      imageUrl: 'https://strefa57.com/wp-content/uploads/2025/11/1045x1495_QR-10.jpg',
    })
  })

  it('deduplicates repeated footer event links', () => {
    const ids = events.map(e => e.externalId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('Underground Pub parser', () => {
  const events = parseUnderground(underground)

  it('extracts dated pub calendar items', () => {
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      externalId: 'undergroundpub:bitwa-o-poludnie-cykl-4-turniejow-w-steel-dart-1-turniej',
      title: 'Bitwa o Południe - Cykl 4 turniejów w Steel Dart - 1 Turniej',
      date: '2026-07-03',
      venueName: 'Underground Pub',
      city: 'Rzeszów',
      country: 'PL',
      categories: ['nightlife'],
      sourceUrl: 'https://undergroundpub.pl/kalendarium/bitwa-o-poludnie-cykl-4-turniejow-w-steel-dart-1-turniej/',
      imageUrl: 'https://undergroundpub.pl/wp-content/uploads/2026/06/724420215-2542624452847481-3229747700734089715-n-800x800.jpg',
    })
  })
})
