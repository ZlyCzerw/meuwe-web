import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as cheerio from 'cheerio'
import { parseDetail, parseLagendaDate } from './lagenda.ts'

const here = dirname(fileURLToPath(import.meta.url))
const detail = readFileSync(join(here, '..', '__fixtures__', 'detail.html'), 'utf8')

describe('parseLagendaDate', () => {
  it('parses two-digit year format', () => {
    expect(parseLagendaDate('Sáb, 30/05/26')).toBe('2026-05-30')
  })
  it('parses four-digit year format', () => {
    expect(parseLagendaDate('30/05/2026')).toBe('2026-05-30')
  })
  it('returns null when no date present', () => {
    expect(parseLagendaDate('sin fecha')).toBeNull()
  })
})

describe('parseDetail (real fixture)', () => {
  const result = parseDetail(cheerio.load(detail), 'listing fallback')

  it('extracts the title from og:title', () => {
    expect(result.title).toBe('Fiestas Virgen de Las Nieves 2026 - Adeje')
  })
  it('extracts the cover image', () => {
    expect(result.imageUrl).toContain('virgen-nieves-adeje-2026.jpg')
  })
  it('extracts categories from JSON-LD', () => {
    expect(result.categories).toEqual(['Fiestas', 'fiestas populares'])
  })
  it('extracts the city from the first /lugares/ link (main event, not sidebar)', () => {
    expect(result.city).toBe('Adeje')
  })
  it('extracts a non-empty description', () => {
    expect(result.description.length).toBeGreaterThan(30)
  })
})
