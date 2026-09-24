import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeDeviceHeading } from './useDeviceHeading'

type W = Window & { DeviceOrientationEvent?: unknown }

function orient(type: string, props: Record<string, unknown>) {
  window.dispatchEvent(Object.assign(new Event(type), props))
}

describe('subscribeDeviceHeading', () => {
  let queued: (() => void)[] = []
  const schedule = (cb: () => void) => { queued.push(cb) }
  const frame = () => { const q = queued; queued = []; q.forEach(f => f()) }

  beforeEach(() => {
    queued = []
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(window as W).DeviceOrientationEvent = class extends Event {}
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete (window as W).DeviceOrientationEvent
  })

  it('coalesces readings within one frame into one call with the last value', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientationabsolute', { absolute: true, alpha: 10 })
    orient('deviceorientationabsolute', { absolute: true, alpha: 20 })
    orient('deviceorientationabsolute', { absolute: true, alpha: 30 })
    expect(cb).not.toHaveBeenCalled()
    frame()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(330)
    off()
  })

  it('uses iOS webkitCompassHeading as is', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientation', { webkitCompassHeading: 45, webkitCompassAccuracy: 10 })
    frame()
    expect(cb).toHaveBeenLastCalledWith(45)
    off()
  })

  it('ignores relative readings with no compass heading', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientation', { absolute: false, alpha: 90 })
    frame()
    expect(cb).not.toHaveBeenCalled()
    off()
  })

  it('reports null after 3 s without a usable reading', () => {
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientationabsolute', { absolute: true, alpha: 0 })
    frame()
    vi.advanceTimersByTime(3000)
    expect(cb).toHaveBeenLastCalledWith(null)
    off()
  })

  it('stops listening after unsubscribe', () => {
    const cb = vi.fn()
    subscribeDeviceHeading(cb, schedule)()
    orient('deviceorientationabsolute', { absolute: true, alpha: 10 })
    frame()
    expect(cb).not.toHaveBeenCalled()
  })

  it('iOS: asks permission on a tap, then listens', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    ;(window as W).DeviceOrientationEvent = Object.assign(class extends Event {}, { requestPermission })
    const cb = vi.fn()
    const off = subscribeDeviceHeading(cb, schedule)
    orient('deviceorientation', { webkitCompassHeading: 90, webkitCompassAccuracy: 5 })
    frame()
    expect(cb).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('click'))
    expect(requestPermission).toHaveBeenCalled()
    for (let i = 0; i < 5; i++) await Promise.resolve() // .then(attach) po rozwiązaniu zgody
    orient('deviceorientation', { webkitCompassHeading: 90, webkitCompassAccuracy: 5 })
    frame()
    expect(cb).toHaveBeenLastCalledWith(90)
    off()
  })

  it('no DeviceOrientationEvent: no-op unsubscribe', () => {
    delete (window as W).DeviceOrientationEvent
    const off = subscribeDeviceHeading(vi.fn(), schedule)
    expect(() => off()).not.toThrow()
  })
})
