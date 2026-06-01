import { describe, it, expect } from 'vitest'
import { generateSql } from './sql.ts'
import type { MeuweEvent } from './types.ts'

function ev(overrides: Partial<MeuweEvent> = {}): MeuweEvent {
  return {
    externalId: 'lagenda:1',
    title: 'Fiesta',
    description: 'Desc',
    lat: 28.1,
    lng: -16.7,
    placeName: 'Adeje',
    category: 'culture',
    startTime: new Date('2026-06-15T18:00:00Z'),
    endTime: new Date('2026-06-15T20:00:00Z'),
    tags: [],
    photos: [],
    ...overrides,
  }
}

const meta = { dateFrom: '2026-06-01', dateTo: '2026-06-22', generatedAt: '2026-06-01' }

describe('generateSql photos column', () => {
  it("emits '{}' for an event with no photos", () => {
    const sql = generateSql([ev()], meta)
    expect(sql).toContain('photos')
    expect(sql).toContain(`'{}'`)
  })

  it('emits a text[] array literal when a photo is present', () => {
    const sql = generateSql([ev({ photos: ['https://x/y.jpg'] })], meta)
    expect(sql).toContain(`ARRAY['https://x/y.jpg']::text[]`)
  })
})
