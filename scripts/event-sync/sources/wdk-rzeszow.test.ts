import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseWdkRzeszow } from './wdk-rzeszow.ts'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '__fixtures__', 'wdk_rzeszow.html'), 'utf8')

describe('WDK Rzeszow parser', () => {
  const events = parseWdkRzeszow(html)

  it('extracts upcoming WDK announcements and ignores news/relations', () => {
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      externalId: 'wdk-rzeszow:art2579',
      title: 'XX Światowy Festiwal Polonijnych Zespołów Folklorystycznych - Rzeszów 2026',
      description: 'Zapowiedź wydarzenia',
      date: '2026-07-15',
      startHour: null,
      venueName: 'Wojewódzki Dom Kultury w Rzeszowie',
      city: 'Rzeszów',
      address: 'ul. S. Okrzei 7',
      country: 'PL',
      categories: ['Zapowiedź wydarzenia'],
      sourceUrl: 'https://wdk.kulturapodkarpacka.pl/aktualnosci/zapowiedzi/xx-swiatowy-festiwal-polonijnych-zespolow-folklorystycznych-rzeszow-2026,art2579/',
      imageUrl: 'https://wdk.kulturapodkarpacka.pl/upload/animacja/_min/xx-swiatowy-festiwal-polonijnych-zespolow-folklorystycznych-rzeszow-2026-7.png',
    })
  })
})
