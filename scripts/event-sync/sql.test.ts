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
    const sql = generateSql([ev()], [], meta)
    expect(sql).toContain('photos')
    expect(sql).toContain(`'{}'`)
  })

  it('emits a text[] array literal when a photo is present', () => {
    const sql = generateSql([ev({ photos: ['https://x/y.jpg'] })], [], meta)
    expect(sql).toContain(`ARRAY['https://x/y.jpg']::text[]`)
  })
})

describe('generateSql with aliases', () => {
  const event = ev({
    externalId: 'ebilet:abc',
    title: 'Koncert',
    description: 'Opis',
    lat: 50.04, lng: 22.0,
    placeName: 'Filharmonia Podkarpacka, Rzeszów',
    category: 'music',
    startTime: new Date('2026-07-10T17:00:00Z'),
    endTime: new Date('2026-07-10T19:00:00Z'),
    tags: ['music'],
  })
  const rzMeta = { dateFrom: '2026-07-03', dateTo: '2026-07-24', generatedAt: '2026-07-03' }
  const sql = generateSql([event], [{ alias: 'estrada:9:2026-07-10', canonical: 'ebilet:abc' }], rzMeta)

  it('guards every event insert against the alias table', () => {
    expect(sql).toContain(
      `WHERE NOT EXISTS (SELECT 1 FROM public.event_external_id_aliases a WHERE a.alias_external_id = 'ebilet:abc')`,
    )
  })
  it('records loser external_ids as aliases', () => {
    expect(sql).toContain(`INSERT INTO public.event_external_id_aliases`)
    expect(sql).toContain(`('estrada:9:2026-07-10', 'ebilet:abc')`)
  })
  it('emits no alias block when there are no aliases', () => {
    const noAlias = generateSql([event], [], rzMeta)
    expect(noAlias).not.toContain(`INSERT INTO public.event_external_id_aliases`)
  })
})
