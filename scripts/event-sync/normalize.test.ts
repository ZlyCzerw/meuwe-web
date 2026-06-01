import { describe, it, expect } from 'vitest'
import { normalizeEvent } from './normalize.ts'
import type { RawEvent } from './types.ts'

function raw(overrides: Partial<RawEvent> = {}): RawEvent {
  return {
    externalId: 'lagenda:1',
    title: 'Concierto',
    description: 'Una descripción suficientemente larga para pasar.',
    date: '2026-06-15',
    startHour: '20:00',
    endHour: null,
    venueName: 'Teatro Guimerá',
    city: 'Santa Cruz de Tenerife',
    country: 'ES',
    categories: ['concierto'],
    ...overrides,
  }
}

describe('normalizeEvent', () => {
  it('keeps a complete event with no warnings', () => {
    const { event, warnings } = normalizeEvent(raw())
    expect(event).not.toBeNull()
    expect(warnings).toEqual([])
  })

  it('drops an event with no date', () => {
    const { event, warnings } = normalizeEvent(raw({ date: '' }))
    expect(event).toBeNull()
    expect(warnings).toContain('no-date')
  })

  it('drops an event with an invalid date', () => {
    const { event } = normalizeEvent(raw({ date: '15/06/2026' }))
    expect(event).toBeNull()
  })

  it('fills empty description from title + city, with a warning', () => {
    const { event, warnings } = normalizeEvent(raw({ description: '' }))
    expect(event?.description).toBe('Concierto. Santa Cruz de Tenerife.')
    expect(warnings).toContain('empty-description')
  })

  it('defaults missing start time to 19:00, with a warning', () => {
    const { event, warnings } = normalizeEvent(raw({ startHour: null }))
    expect(event?.startHour).toBe('19:00')
    expect(warnings).toContain('default-time')
  })

  it('defaults missing venue to the city, with a warning', () => {
    const { event, warnings } = normalizeEvent(raw({ venueName: '' }))
    expect(event?.venueName).toBe('Santa Cruz de Tenerife')
    expect(warnings).toContain('default-venue')
  })
})
