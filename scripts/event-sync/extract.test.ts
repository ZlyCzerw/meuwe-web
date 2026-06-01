import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as cheerio from 'cheerio'
import {
  extractTitle,
  extractDescription,
  extractImage,
  extractCategories,
  extractTimeVenue,
} from './extract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const detail = readFileSync(join(here, '__fixtures__', 'detail.html'), 'utf8')

describe('extract helpers (real lagenda detail fixture)', () => {
  const $ = cheerio.load(detail)

  it('extractTitle prefers og:title', () => {
    expect(extractTitle($, 'listing fallback')).toBe(
      'Fiestas Virgen de Las Nieves 2026 - Adeje',
    )
  })

  it('extractImage returns the og:image URL', () => {
    expect(extractImage($)).toBe(
      'https://s3-eu-west-1.amazonaws.com/beta.lagenda/programacion/virgen-nieves-adeje-2026.jpg',
    )
  })

  it('extractDescription returns non-empty clean text', () => {
    const d = extractDescription($, 'fallback')
    expect(d.length).toBeGreaterThan(30)
    expect(d).not.toBe('fallback')
  })

  it('extractCategories reads BreadcrumbList JSON-LD', () => {
    expect(extractCategories($)).toEqual(['Fiestas', 'fiestas populares'])
  })
})

describe('extract helpers (fallback behavior on empty doc)', () => {
  const $ = cheerio.load('<html><body></body></html>')

  it('extractTitle falls back to the listing title', () => {
    expect(extractTitle($, 'My Listing Title')).toBe('My Listing Title')
  })

  it('extractImage returns null when no image present', () => {
    expect(extractImage($)).toBeNull()
  })

  it('extractDescription returns the fallback when nothing found', () => {
    expect(extractDescription($, 'Fallback text.')).toBe('Fallback text.')
  })

  it('extractCategories returns empty array when none present', () => {
    expect(extractCategories($)).toEqual([])
  })
})

describe('extract helpers (fallback paths when primary source absent)', () => {
  it('extractImage falls back to itemprop="image" href', () => {
    const $ = cheerio.load(
      '<a itemprop="image" href="https://example.com/cover.jpg">img</a>',
    )
    expect(extractImage($)).toBe('https://example.com/cover.jpg')
  })

  it('extractCategories falls back to div.s-tags links (not related-events)', () => {
    const $ = cheerio.load(`
      <div class="s-tags"><a href="/categoria/fiestas-populares">fiestas populares</a></div>
      <div class="post-category"><a href="/categoria/otro">Otro Evento</a></div>
    `)
    expect(extractCategories($)).toEqual(['fiestas populares'])
  })

  it('extractTimeVenue returns nulls when no time present', () => {
    const $ = cheerio.load('<div class="group-datos"><p>Sin horario.</p></div>')
    expect(extractTimeVenue($)).toEqual({
      startHour: null,
      endHour: null,
      venueName: null,
    })
  })

  it('extractTimeVenue parses the first HH:MM and venue', () => {
    const $ = cheerio.load(
      '<div class="group-datos"><p>- 20:30 Teatro Guimera</p></div>',
    )
    const r = extractTimeVenue($)
    expect(r.startHour).toBe('20:30')
    expect(r.venueName).toBe('Teatro Guimera')
  })
})
