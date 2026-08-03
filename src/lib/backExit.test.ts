import { describe, it, expect } from 'vitest'
import { createBackExitGate, BACK_EXIT_WINDOW_MS } from './backExit'

function gateAt(clock: { now: number }) {
  return createBackExitGate(() => clock.now)
}

describe('createBackExitGate', () => {
  it('asks for a hint on the first back, exits on the second one', () => {
    const clock = { now: 0 }
    const gate = gateAt(clock)
    expect(gate.press()).toBe(false)
    clock.now = 1200
    expect(gate.press()).toBe(true)
  })

  it('accepts the second back at the very end of the window', () => {
    const clock = { now: 0 }
    const gate = gateAt(clock)
    gate.press()
    clock.now = BACK_EXIT_WINDOW_MS
    expect(gate.press()).toBe(true)
  })

  it('forgets the first back once the window has passed', () => {
    const clock = { now: 0 }
    const gate = gateAt(clock)
    expect(gate.press()).toBe(false)
    clock.now = BACK_EXIT_WINDOW_MS + 1
    expect(gate.press()).toBe(false)
    clock.now = BACK_EXIT_WINDOW_MS + 900
    expect(gate.press()).toBe(true)
  })

  it('re-arms after an exit, so a later back hints again', () => {
    const clock = { now: 0 }
    const gate = gateAt(clock)
    gate.press()
    clock.now = 500
    expect(gate.press()).toBe(true)
    clock.now = 600
    expect(gate.press()).toBe(false)
  })

  it('drops a pending exit on reset', () => {
    const clock = { now: 0 }
    const gate = gateAt(clock)
    gate.press()
    gate.reset()
    clock.now = 100
    expect(gate.press()).toBe(false)
  })

  it('gives the user four seconds', () => {
    expect(BACK_EXIT_WINDOW_MS).toBe(4000)
  })
})
