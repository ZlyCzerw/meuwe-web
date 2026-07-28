// Single source of truth for outbound links to the native app.
//
// An empty string means "we have no listing yet". Callers MUST treat it as
// "render nothing" — never as a link that goes nowhere. Fill IOS_STORE_URL in
// once the App Store review is done; no other file needs to change.
export const IOS_STORE_URL = ''
export const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=eu.meuwe'

/** Public web origin — used for share links and for the .ics event URL. */
export const WEB_ORIGIN = 'https://meuwe.eu'

/**
 * Address-book import (invite friends). OFF by design.
 *
 * Turning this on is not a code-only change. Before flipping it you must:
 *  - add NSContactsUsageDescription to ios/App/App/Info.plist,
 *  - declare the sensitive READ_CONTACTS permission in the Play Console,
 *  - work through the GDPR consequences of touching data about people who
 *    never signed up for meuwe and cannot consent through our app.
 * If it is ever enabled, use the system single-contact picker only: no bulk
 * read of the address book, and nothing about contacts leaves the device.
 */
export const ENABLE_CONTACT_PICKER = false
