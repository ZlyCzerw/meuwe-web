import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDetail, parseListing } from './erzeszow.ts'

const here = dirname(fileURLToPath(import.meta.url))
const listing = readFileSync(join(here, '..', '__fixtures__', 'erzeszow_calendar.html'), 'utf8')
const detail = readFileSync(join(here, '..', '__fixtures__', 'erzeszow_event_detail.html'), 'utf8')

describe('eRzeszow parseListing', () => {
  const events = parseListing(listing)

  it('extracts dated event detail links', () => {
    expect(events.length).toBeGreaterThan(30)
    expect(events[0]).toEqual({
      date: '2026-07-03',
      title: 'Toast Urodzinowy dla Tomasza Stańko - BEFORE',
      url: 'https://erzeszow.pl/41-miasto-rzeszow/6241-kalendarz-imprez/146746-toast-urodzinowy-dla-tomasza-stanko-before.html',
    })
  })
})

describe('eRzeszow parseDetail', () => {
  it('extracts hour, venue and image from the article body', () => {
    const parsed = parseDetail(detail)
    expect(parsed.startHour).toBe('19:00')
    expect(parsed.venueName).toBe('Skwer obok kamienicy przy ul. Króla Kazimierza 25')
    expect(parsed.description).toContain('Toast Urodzinowy dla Tomasza Stańko')
    expect(parsed.imageUrl).toBe('https://erzeszow.pl/static/img/k01/estrada/min/3-lipca.png')
  })
})
