import { describe, it, expect } from 'vitest'
import { interestMilestones, shouldNotifyInterest } from './interest'

describe('interestMilestones', () => {
  // Na początku każda osoba jest informacją.
  it('counts every one of the first five', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(interestMilestones(n)).toBe(true)
  })

  it('goes quiet between five and ten', () => {
    for (const n of [6, 7, 8, 9]) expect(interestMilestones(n)).toBe(false)
  })

  it('speaks up on the ladder', () => {
    for (const n of [10, 15, 20, 30, 40, 50, 70, 100]) expect(interestMilestones(n)).toBe(true)
  })

  it('says nothing between the rungs', () => {
    for (const n of [11, 25, 45, 60, 90, 99]) expect(interestMilestones(n)).toBe(false)
  })

  it('settles into every fiftieth past a hundred', () => {
    expect(interestMilestones(150)).toBe(true)
    expect(interestMilestones(200)).toBe(true)
    expect(interestMilestones(110)).toBe(false)
    expect(interestMilestones(175)).toBe(false)
  })

  it('has nothing to say about nobody', () => {
    expect(interestMilestones(0)).toBe(false)
  })
})

describe('shouldNotifyInterest', () => {
  it('fires when a new rung is reached', () => {
    expect(shouldNotifyInterest(0, 1)).toBe(true)
    expect(shouldNotifyInterest(5, 10)).toBe(true)
  })

  // Two people joining at once both compute the same count; only the first
  // gets to record it, and the second must stay quiet.
  it('does not repeat a rung already announced', () => {
    expect(shouldNotifyInterest(5, 5)).toBe(false)
  })

  // Someone unfollowed and rejoined — the ladder does not go back down.
  it('stays quiet when the count fell and climbed back', () => {
    expect(shouldNotifyInterest(15, 12)).toBe(false)
    expect(shouldNotifyInterest(15, 15)).toBe(false)
  })
})
