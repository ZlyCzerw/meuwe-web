import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNativePlatform } from './platform'
import { buildIcs, icsFileName, googleCalendarUrl, type IcsEvent } from './ics'

// Handing the .ics to the OS. Everything platform-specific lives here; the file
// itself is built by ics.ts, which stays pure and testable.

export type CalendarResult =
  | 'opened'      // handed to the system (native share sheet)
  | 'downloaded'  // browser download started
  | 'failed'      // nothing happened, and the caller must say so

export async function addToCalendar(event: IcsEvent): Promise<CalendarResult> {
  const content = buildIcs(event)
  const fileName = icsFileName(event)

  if (isNativePlatform()) {
    try {
      // Cache, not Documents: this is a hand-off file, not user data to keep.
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })
      // iOS offers "Add to Calendar" for a text/calendar attachment; Android
      // routes the file to whichever calendar app claims it.
      await Share.share({ title: event.title, files: [uri] })
      return 'opened'
    } catch (err) {
      // A dismissed share sheet also lands here. Distinguishing the two is not
      // worth a fragile string match, so the caller offers the Google Calendar
      // link as a way out rather than claiming success.
      console.error('[calendar] native share failed:', err)
      return 'failed'
    }
  }

  try {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
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

/** Alternative route for Android and the web, where a download can go nowhere. */
export function openGoogleCalendar(event: IcsEvent): void {
  window.open(googleCalendarUrl(event), '_blank', 'noopener,noreferrer')
}
