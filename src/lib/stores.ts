import { IOS_STORE_URL, ANDROID_STORE_URL } from './appConfig'
import { mobileOS, isNativePlatform } from './platform'

export type StoreOs = 'ios' | 'android'

export function storeUrl(os: StoreOs): string {
  return os === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL
}

/**
 * The store the visitor could actually install from: null on desktop (no app to
 * install), inside the app itself, or while that listing does not exist yet.
 * An empty URL in appConfig means "no listing", never "link to nowhere".
 */
export function deviceStoreOs(): StoreOs | null {
  const os = mobileOS()
  if (isNativePlatform() || !os || !storeUrl(os)) return null
  return os
}
