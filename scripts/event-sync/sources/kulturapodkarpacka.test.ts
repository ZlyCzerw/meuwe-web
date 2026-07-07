import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseKulturaPodkarpacka } from './kulturapodkarpacka.ts'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '..', '__fixtures__', 'kulturapodkarpacka_home.html'), 'utf8')

describe('Podkarpacki Informator Kulturalny parser', () => {
  const events = parseKulturaPodkarpacka(html)

  it('extracts only Rzeszow events with recognized venues', () => {
    expect(events.length).toBeGreaterThan(5)
    expect(events.map(e => e.venueName)).not.toContain('Krosno')
    expect(events[0]).toMatchObject({
      externalId: 'kulturapodkarpacka:wystawa-postawy-2026-zpamig-bwa-rzeszow',
      title: 'Wystawa "POSTAWY 2026": Przegląd twórczości ZPAMiG w BWA Rzeszów',
      date: '2026-07-02',
      venueName: 'Biuro Wystaw Artystycznych w Rzeszowie',
      address: 'ul. Jana III Sobieskiego 18',
      city: 'Rzeszów',
      country: 'PL',
      categories: ['Wystawy, konkursy'],
      sourceUrl: 'https://kulturapodkarpacka.pl/wydarzenia/wystawa-postawy-2026-zpamig-bwa-rzeszow',
      imageUrl: 'https://kulturapodkarpacka.pl/upload/thumb/2026/06/wystawa-postawy-2026-zpamig-rzeszow_jpg_auto_780x520.jpg',
    })
  })

  it('recognizes venue names from title and description text', () => {
    const kino = events.find(e => e.externalId === 'kulturapodkarpacka:janusz-zaorski-przeglad-filmow-spotkanie')
    expect(kino).toMatchObject({
      date: '2026-06-21',
      venueName: 'Kino za Rogiem Café',
      categories: ['Wykłady, Spotkania,...'],
    })

    const filharmonia = events.find(e => e.externalId === 'kulturapodkarpacka:polomski-wspomnien-czar-filharmonia-podkarpacka')
    expect(filharmonia).toMatchObject({
      date: '2026-07-12',
      venueName: 'Filharmonia Podkarpacka',
      categories: ['Koncerty'],
    })
  })
})
