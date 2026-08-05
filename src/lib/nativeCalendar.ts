import { CapacitorCalendar } from '@ebarooni/capacitor-calendar'
import { eventUrl, REMINDER_MINUTES, type IcsEvent } from './ics'

// The system's own "new event" screen, pre-filled. Imported dynamically by
// calendar.ts so the plugin never reaches the web bundle.
//
// iOS presents EKEventEditViewController and Android fires ACTION_INSERT, so on
// both the user sees the event, sees which calendar it is going into, and taps
// once. Neither needs a runtime permission with eventIdOptional set.

/**
 * Opens the screen and resolves with the ids of whatever was created.
 *
 * iOS returns the new id on save and an empty array when the user backs out, so
 * there the two endings are told apart. Android with eventIdOptional always
 * returns an empty array — reading the id back is what would need
 * READ_CALENDAR, and a permission dialog is too high a price for a toast.
 */
export async function createEventNative(event: IcsEvent): Promise<string[]> {
  const place = event.place_name?.trim() || `${event.lat.toFixed(5)}, ${event.lng.toFixed(5)}`
  const { result } = await CapacitorCalendar.createEventWithPrompt({
    title: event.title,
    location: place,
    startDate: new Date(event.start_time).getTime(),
    endDate: new Date(event.end_time).getTime(),
    // Honoured on iOS; on Android the calendar app applies its own default.
    alertOffsetInMinutes: REMINDER_MINUTES,
    url: eventUrl(event.id),
    notes: event.description?.trim() || undefined,
    eventIdOptional: true,
  })
  return result
}
