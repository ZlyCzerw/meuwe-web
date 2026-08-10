import { describe, it, expect } from 'vitest'
import { pickAttendanceAsk, type AskCandidate } from './attendanceAsk'

// "Yesterday" is yesterday where the user is, so the boundary is the local one.
// Fixtures are therefore built in local time — a Z-suffixed literal would mean a
// different day depending on where the suite runs, and 22:00Z is already
// tomorrow in Warsaw.
const local = (day: number, hour: number) => new Date(2026, 7, day, hour, 0).toISOString()

const NOW = new Date(2026, 7, 10, 12, 0)

const candidate = (over: Partial<AskCandidate> & { eventId: string }): AskCandidate => ({
  title: 'Koncert', endTime: local(9, 21), answered: false, ...over,
})

describe('pickAttendanceAsk', () => {
  it('asks about an event that ended yesterday', () => {
    const c = candidate({ eventId: 'wczoraj' })
    expect(pickAttendanceAsk([c], NOW)).toEqual(c)
  })

  // Today is not "the next day" yet — the evening is not over.
  it('leaves today alone', () => {
    const c = candidate({ eventId: 'dzis', endTime: local(10, 9) })
    expect(pickAttendanceAsk([c], NOW)).toBeNull()
  })

  it('gives up on anything older than two days', () => {
    const c = candidate({ eventId: 'stare', endTime: local(7, 21) })
    expect(pickAttendanceAsk([c], NOW)).toBeNull()
  })

  it('never asks twice about the same event', () => {
    const c = candidate({ eventId: 'juz-odpowiedziane', answered: true })
    expect(pickAttendanceAsk([c], NOW)).toBeNull()
  })

  it('asks about the most recent one when several qualify', () => {
    const older = candidate({ eventId: 'wczesniej', endTime: local(9, 14) })
    const newer = candidate({ eventId: 'pozniej', endTime: local(9, 22) })
    expect(pickAttendanceAsk([older, newer], NOW)?.eventId).toBe('pozniej')
  })

  it('has nothing to ask about when nothing is followed', () => {
    expect(pickAttendanceAsk([], NOW)).toBeNull()
  })
})
