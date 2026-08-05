import { isNativePlatform, isIOS, mobileOS } from './platform'
import { buildIcs, icsFileName, googleCalendarUrl, outlookCalendarUrl, type IcsEvent } from './ics'
import { pickCalendarRoute, type CalendarTarget } from './calendarRoute'

// Getting an event into someone's calendar. The decision of where it should go
// lives in calendarRoute.ts, the file itself in ics.ts; this module is only the
// part that touches the platform.

export type CalendarResult =
  /** Saved, and we saw it happen. Only iOS can say this. */
  | 'added'
  /** Passed to the calendar or to a calendar site; the ending is theirs to write. */
  | 'handedOff'
  /** The user backed out of the system screen. Not a failure, not a success. */
  | 'cancelled'
  /** An .ics file left the browser. */
  | 'downloaded'
  /** We do not know which calendar this person uses — the caller should ask. */
  | 'choose'
  /** Nothing happened, and the caller must say so. */
  | 'failed'

export async function addToCalendar(
  event: IcsEvent,
  ctx: { provider: string | null },
): Promise<CalendarResult> {
  const route = pickCalendarRoute({
    native: isNativePlatform(),
    provider: ctx.provider,
    mobile: mobileOS(),
  })

  if (route === 'native') {
    try {
      const { createEventNative } = await import('./nativeCalendar')
      const ids = await createEventNative(event)
      if (ids.length > 0) return 'added'
      // An empty result means "cancelled" on iOS and "we cannot tell" on
      // Android, so only iOS gets to call it a cancellation.
      return isIOS() ? 'cancelled' : 'handedOff'
    } catch (err) {
      // No calendar app at all, or the plugin refused. Falling through to the
      // web routes still gets the event somewhere.
      console.error('[calendar] the system calendar screen did not open:', err)
      return 'choose'
    }
  }

  if (route === 'google') return openCalendarTarget(event, 'google')
  return 'choose'
}

/** One of the destinations offered by the chooser. */
export function openCalendarTarget(event: IcsEvent, target: CalendarTarget): CalendarResult {
  if (target === 'file') return downloadIcs(event)
  const url = target === 'google' ? googleCalendarUrl(event) : outlookCalendarUrl(event)
  window.open(url, '_blank', 'noopener,noreferrer')
  return 'handedOff'
}

/** The last resort: a file, for Apple Calendar and anything else. */
function downloadIcs(event: IcsEvent): CalendarResult {
  try {
    const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = icsFileName(event)
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoked late: Safari reads the blob after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return 'downloaded'
  } catch (err) {
    console.error('[calendar] download failed:', err)
    return 'failed'
  }
}
