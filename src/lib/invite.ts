import { Share } from '@capacitor/share'
import { isNativePlatform } from './platform'
import { WEB_ORIGIN, ENABLE_CONTACT_PICKER } from './appConfig'

// Inviting friends. No permission of any kind: the system share sheet decides
// where the message goes, and meuwe never sees the recipient.

export type InviteResult = 'shared' | 'copied' | 'dismissed' | 'failed'

export async function shareInvite(text: string): Promise<InviteResult> {
  // ?src=invite: dzięki temu konto założone z zaproszenia da się odróżnić od
  // wejścia bezpośredniego (signupSourceFromUrl w lib/signupContext).
  const url = `${WEB_ORIGIN}/?src=invite`

  if (isNativePlatform()) {
    try {
      await Share.share({ text, url })
      return 'shared'
    } catch (err) {
      // The plugin also rejects when the sheet is dismissed, which is not an
      // error worth shouting about — the caller just closes quietly.
      console.error('[invite] native share failed or dismissed:', err)
      return 'dismissed'
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ text, url })
      return 'shared'
    } catch {
      return 'dismissed'
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`)
    return 'copied'
  } catch (err) {
    console.error('[invite] clipboard unavailable:', err)
    return 'failed'
  }
}

/**
 * Address-book import. Off behind ENABLE_CONTACT_PICKER and intentionally not
 * implemented: turning it on is a product and legal decision, not a code change.
 *
 * Before it can be enabled:
 *  - iOS needs NSContactsUsageDescription in Info.plist,
 *  - Google Play needs the sensitive READ_CONTACTS permission declared and
 *    justified in the console,
 *  - and someone has to answer for the GDPR side of holding data about people
 *    who never signed up for meuwe.
 *
 * If it is ever switched on, the only acceptable shape is the system's
 * single-contact picker: one contact chosen by the user per invite, no bulk
 * read of the address book, and nothing about contacts sent to our servers.
 * That needs a Capacitor contacts plugin, which is deliberately not installed
 * yet, because merely adding it puts the permission into the manifest.
 */
export function isContactPickerEnabled(): boolean {
  return ENABLE_CONTACT_PICKER
}
