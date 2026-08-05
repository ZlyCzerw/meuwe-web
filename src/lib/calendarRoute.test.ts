import { describe, it, expect } from 'vitest'
import { pickCalendarRoute } from './calendarRoute'

describe('pickCalendarRoute', () => {
  // Inside the app the OS itself can open a pre-filled event screen, which beats
  // every web route: any calendar app, one tap, nothing downloaded.
  it('uses the operating system inside the app, whatever the account is', () => {
    expect(pickCalendarRoute({ native: true, provider: 'apple', mobile: 'ios' })).toBe('native')
    expect(pickCalendarRoute({ native: true, provider: null, mobile: 'android' })).toBe('native')
  })

  // Someone who signed in with Google keeps their calendar at Google. Asking
  // them which calendar they use is a question we already know the answer to.
  it('sends a Google account straight to Google Calendar', () => {
    expect(pickCalendarRoute({ native: false, provider: 'google', mobile: null })).toBe('google')
  })

  // On Android the Google Calendar link is caught by the installed app, so this
  // is not "open a website" — it is the calendar, pre-filled, one tap from done.
  it('sends an Android browser to Google Calendar even without an account', () => {
    expect(pickCalendarRoute({ native: false, provider: null, mobile: 'android' })).toBe('google')
    expect(pickCalendarRoute({ native: false, provider: 'apple', mobile: 'android' })).toBe('google')
  })

  // An iPhone in Safari and a desktop have no calendar we can guess at, and
  // guessing wrong costs more than asking.
  it('asks when there is nothing to go on', () => {
    expect(pickCalendarRoute({ native: false, provider: 'apple', mobile: 'ios' })).toBe('choose')
    expect(pickCalendarRoute({ native: false, provider: null, mobile: 'ios' })).toBe('choose')
    expect(pickCalendarRoute({ native: false, provider: null, mobile: null })).toBe('choose')
  })
})
