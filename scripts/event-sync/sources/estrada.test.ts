import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as cheerio from 'cheerio'
import { parseListing, parseDetail } from './estrada.ts'

const here = dirname(fileURLToPath(import.meta.url))
const listing = readFileSync(join(here, '..', '__fixtures__', 'estrada_listing.html'), 'utf8')
const detail = readFileSync(join(here, '..', '__fixtures__', 'estrada_detail.html'), 'utf8')
const NOW = new Date('2026-07-03T12:00:00Z')

describe('parseListing (real fixture)', () => {
  const items = parseListing(cheerio.load(listing), NOW)

  it('extracts event cards from the day blocks', () => {
    expect(items.length).toBeGreaterThan(0)
  })
  it('builds absolute detail URLs without the ?img/?tytul query', () => {
    for (const item of items) {
      expect(item.url).toMatch(/^https:\/\/estrada\.rzeszow\.pl\/wydarzenia\/.+,wydarzenie\d+\/$/)
    }
  })
  it('carries an ISO date inferred from day+month (fixture day 05.07)', () => {
    expect(items[0].date).toBe('2026-07-05')
  })
  it('carries a venue hint from the organizer span', () => {
    expect(items[0].venueHint.length).toBeGreaterThan(0)
  })
  it('dedupes the double links (?img / ?tytul) of one card', () => {
    const keys = items.map(i => `${i.url}|${i.date}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('parseDetail (real fixture)', () => {
  const d = parseDetail(cheerio.load(detail))

  it('extracts the start time', () => {
    expect(d.time).toBe('21:00')
  })
  it('extracts the place string', () => {
    expect(d.place).toContain('Skwer Kultury')
  })
  it('extracts a meaningful description', () => {
    expect(d.description.length).toBeGreaterThan(100)
  })
})
