import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { openCalendarTarget } from './calendar'
import type { IcsEvent } from './ics'

// Only the browser half is exercised here. The native route runs inside the app,
// where the plugin talks to EventKit and to Android's calendar intent, and the
// decision of which route to take is tested on its own in calendarRoute.test.ts.

const event: IcsEvent = {
  id: 'abc-123',
  title: 'Koncert w knajpie',
  description: 'Gramy od 21:00',
  place_name: 'Bar Rynek 4',
  lat: 50.0413,
  lng: 21.999,
  start_time: '2026-08-01T19:00:00+02:00',
  end_time: '2026-08-01T23:30:00+02:00',
}

let opened: string[]

beforeEach(() => {
  opened = []
  vi.stubGlobal('open', (url: string) => { opened.push(url); return null })
  // jsdom has no object URLs; the download path only needs them to exist.
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('openCalendarTarget', () => {
  it('sends the Google row to Google and the Outlook row to Outlook', () => {
    expect(openCalendarTarget(event, 'google')).toBe('handedOff')
    expect(opened[0]).toContain('calendar.google.com')

    expect(openCalendarTarget(event, 'outlook')).toBe('handedOff')
    expect(opened[1]).toContain('outlook.live.com')
  })

  // The two rows above hand the event to a site that will show it. The file row
  // is the only one that ends in a download, and it must stay the only one.
  it('downloads a file for the file row and for nothing else', () => {
    const clicks: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download)
    })

    expect(openCalendarTarget(event, 'file')).toBe('downloaded')
    expect(clicks).toEqual(['meuwe-koncert-w-knajpie.ics'])
    expect(opened).toEqual([])
  })

  it('says so rather than pretending when the download cannot start', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(openCalendarTarget(event, 'file')).toBe('failed')
  })
})
