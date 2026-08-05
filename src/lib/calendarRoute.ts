// Which way "add to calendar" should go on this device, for this account.
//
// There used to be one answer everywhere: build an .ics and hand the file over.
// Inside the app that meant a share sheet — a file-sharing sheet, which on
// Android almost no calendar app claims — and in a browser it meant a download
// that lands in a folder and does nothing on its own.
//
// So the file is now the last resort rather than the first move, and the rest
// of this module is about how much we already know about where the event should
// go before asking.

export type CalendarRoute =
  /** The OS opens its own pre-filled event screen. Best answer where available. */
  | 'native'
  /** Google Calendar's template form — an app on Android, a page elsewhere. */
  | 'google'
  /** Nothing to go on: ask which calendar. */
  | 'choose'

/** The destinations the chooser offers, and the only ones openCalendarTarget takes. */
export type CalendarTarget = 'google' | 'outlook' | 'file'

export interface CalendarContext {
  native: boolean
  /** Supabase auth provider: 'google', 'apple', or null for a guest. */
  provider: string | null
  mobile: 'ios' | 'android' | null
}

export function pickCalendarRoute(ctx: CalendarContext): CalendarRoute {
  if (ctx.native) return 'native'
  // Signed in with Google — their calendar is Google's, and we already know it.
  if (ctx.provider === 'google') return 'google'
  // App Links hand this address to the installed Google Calendar, so on Android
  // it opens the app with the event filled in rather than a web page.
  if (ctx.mobile === 'android') return 'google'
  return 'choose'
}
