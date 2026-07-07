import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseH69 } from './sports-rzeszow.ts'

const here = dirname(fileURLToPath(import.meta.url))
const h69 = readFileSync(join(here, '..', '__fixtures__', 'h69_terminarz.html'), 'utf8')

describe('H69 speedway schedule parser', () => {
  const events = parseH69(h69)

  it('extracts home speedway matches in Rzeszow', () => {
    const row = events.find(e => e.date === '2026-07-12')
    expect(row?.title).toBe('Dakar Development Stal Rzeszów vs INNPRO ROW Rybnik')
    expect(row?.venueName).toBe('Stadion Stal Rzeszów')
    expect(row?.city).toBe('Rzeszów')
    expect(row?.categories).toContain('sport')
  })

  it('does not emit away matches as local events', () => {
    expect(events.some(e => e.date === '2026-07-31')).toBe(false)
  })
})
