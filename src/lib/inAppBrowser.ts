import { isNativePlatform } from './platform'

/**
 * An iOS in-app browser — the WebView Facebook, Messenger, Instagram and the
 * like open shared links in. Google refuses OAuth there (disallowed_useragent),
 * so signing in cannot work until the page is reopened in a real browser.
 *
 * Android apps hand links to Chrome Custom Tabs, which Google accepts, so only
 * iOS is asked about. On iOS the tell is either a known app string or a user
 * agent that names no standalone browser at all.
 */
export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  if (isNativePlatform()) return false
  if (!/iphone|ipad|ipod/i.test(ua)) return false
  return /FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)
    || !/safari|crios|fxios|edgios/i.test(ua)
}

// Click ids the social apps bolt onto a shared link. They are theirs, not ours,
// and a link the user is asked to read, copy and retype is better without a
// 200-character fbclid in the middle of it.
const TRACKING_PARAMS = ['fbclid', '_aem', 'igshid', 'mibextid', 'gclid', 'ttclid', 'twclid']

/** The same address without the sharing app's tracking parameters. */
export function cleanLink(href: string): string {
  try {
    const url = new URL(href)
    for (const p of TRACKING_PARAMS) url.searchParams.delete(p)
    return url.toString()
  } catch {
    return href
  }
}

/**
 * An address that leaves the WebView for the system browser. `x-safari-https://`
 * is Apple's own prefix, honoured by the Facebook family of apps; there is no
 * documented API for this, and an app that ignores it simply does nothing. That
 * is why the copy-the-link route stays on screen next to the button.
 */
export function browserEscapeUrl(href: string): string {
  return `x-safari-${cleanLink(href)}`
}
