import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseListing } from './resinet.ts'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '__fixtures__', 'resinet_kalendarium.html'), 'utf8')
const NOW = new Date('2026-07-03T12:00:00Z')

describe('RESinet parseListing', () => {
  const events = parseListing(html, NOW)

  it('extracts dated public event cards', () => {
    expect(events.length).toBeGreaterThan(30)
    expect(events[0].title).toBe('Letnia Strefa Uśmiechu i Pożegnanie Lata - cykl animacji dla dzieci')
    expect(events[0].date).toBe('2026-07-03')
    expect(events[0].venueName).toBe('Place zabaw na Osiedlu Baranówka')
    expect(events[0].startHour).toBe('01:00')
    expect(events[0].country).toBe('PL')
  })

  it('provides source URLs and images for debugging', () => {
    expect(events[0].sourceUrl).toBe('https://www.resinet.pl/rozrywka/kalendarium/letnia-strefa-usmiechu-i-pozegnanie-lata-cykl-animacji-dla-dzieci')
    expect(events[0].imageUrl).toBe('https://www.resinet.pl/image/c/600/400/event/20260701/letnia-strefa.jpg')
  })
})
