import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseFeed } from './mgoktyczyn.ts'

const here = dirname(fileURLToPath(import.meta.url))
const xml = readFileSync(join(here, '..', '__fixtures__', 'mgoktyczyn_feed.xml'), 'utf8')
const NOW = new Date('2026-06-20T12:00:00Z')

describe('parseFeed (real fixture)', () => {
  const events = parseFeed(xml, NOW)

  it('keeps only items with a parseable date in the title', () => {
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('skips undated news posts (Dni Tyczyna | Parkingi)', () => {
    expect(events.find(e => e.title.includes('Parkingi'))).toBeUndefined()
  })
  it('strips the date fragment from the title', () => {
    const wernisaz = events.find(e => e.title.includes('Wernisaż prac'))
    expect(wernisaz).toBeDefined()
    expect(wernisaz!.title).not.toMatch(/\d{1,2}\.\d{1,2}/)
    expect(wernisaz!.title).not.toMatch(/^\s*\|/)
    expect(wernisaz!.date).toBe('2026-06-23')
  })
  it('defaults venue to MGOK Tyczyn in Tyczyn', () => {
    expect(events[0].venueName).toBe('MGOK Tyczyn')
    expect(events[0].city).toBe('Tyczyn')
    expect(events[0].country).toBe('PL')
  })
  it('builds a stable externalId from the post guid + date', () => {
    expect(events[0].externalId).toMatch(/^mgoktyczyn:\d+:\d{4}-\d{2}-\d{2}$/)
  })
})
