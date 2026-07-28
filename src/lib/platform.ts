export const isNativePlatform = (): boolean => {
  try { return (window as any)?.Capacitor?.isNativePlatform?.() ?? false }
  catch { return false }
}

const getPlatform = (): string => {
  try { return (window as any)?.Capacitor?.getPlatform?.() ?? 'web' }
  catch { return 'web' }
}

export const isAndroid = (): boolean => getPlatform() === 'android'
export const isIOS = (): boolean => getPlatform() === 'ios'

/**
 * The mobile OS the user is on, in the app OR in a mobile browser; null on
 * desktop. Store links need this: isIOS()/isAndroid() above only answer for the
 * Capacitor shell, and on the web everyone would look like a desktop visitor.
 */
export const mobileOS = (): 'ios' | 'android' | null => {
  if (isIOS()) return 'ios'
  if (isAndroid()) return 'android'
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPadOS 13+ claims to be a Mac; touch points give it away.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return null
}
