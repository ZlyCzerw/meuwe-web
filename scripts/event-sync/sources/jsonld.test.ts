import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseJsonLdBlocks, collectJsonLdEvents } from './jsonld.ts'

const here = dirname(fileURLToPath(import.meta.url))
const biletyna = readFileSync(join(here, '..', '__fixtures__', 'biletyna_listing.json'), 'utf8')

describe('parseJsonLdBlocks', () => {
  it('extracts and parses every ld+json script block', () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"WebSite","name":"x"}</script>
      <script type="application/ld+json">[{"@type":"Event","name":"y"}]</script>
      </head></html>`
    const blocks = parseJsonLdBlocks(html)
    expect(blocks).toHaveLength(2)
  })
  it('skips malformed blocks without throwing', () => {
    const html = `<script type="application/ld+json">{ not json </script>`
    expect(parseJsonLdBlocks(html)).toEqual([])
  })
})

describe('collectJsonLdEvents', () => {
  it('pulls MusicEvent objects out of an ItemList with venue + address', () => {
    const node = JSON.parse(biletyna)
    const events = collectJsonLdEvents(node)
    expect(events.length).toBeGreaterThanOrEqual(1)
    const abba = events.find(e => e.name.includes('ABBA'))!
    expect(abba.startDate).toBe('2026-07-09T19:00:00+02:00')
    expect(abba.venueName).toBe('Filharmonia Podkarpacka')
    expect(abba.city).toBe('Rzeszów')
    expect(abba.street).toBe('ul. Chopina 30')
    expect(abba.url).toContain('biletyna.pl')
  })

  it('recognises all common schema.org Event subtypes', () => {
    const node = {
      '@graph': [
        { '@type': 'TheaterEvent', name: 'Spektakl', startDate: '2026-07-10' },
        { '@type': 'ComedyEvent', name: 'Kabaret', startDate: '2026-07-11' },
        { '@type': ['Festival'], name: 'Festiwal', startDate: '2026-07-12' },
        { '@type': 'Organization', name: 'nie event' },
      ],
    }
    const names = collectJsonLdEvents(node).map(e => e.name).sort()
    expect(names).toEqual(['Festiwal', 'Kabaret', 'Spektakl'])
  })

  it('ignores event-typed nodes without a name', () => {
    expect(collectJsonLdEvents({ '@type': 'Event' })).toEqual([])
  })
})
