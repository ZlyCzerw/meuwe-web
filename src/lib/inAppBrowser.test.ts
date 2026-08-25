import { describe, it, expect } from 'vitest'
import { isInAppBrowser, cleanLink, browserEscapeUrl } from './inAppBrowser'

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1'
const MESSENGER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/MessengerForiOS;FBAV/450.0]'
const FACEBOOK = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0;FBBV/1]'
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0'
const ANDROID_FB = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

describe('isInAppBrowser', () => {
  it.each([
    ['Messenger', MESSENGER],
    ['Facebook', FACEBOOK],
    // No browser name at all — some other app's WebView, Google blocks it too.
    ['Instagram', INSTAGRAM],
  ])('spots %s', (_name, ua) => expect(isInAppBrowser(ua)).toBe(true))

  it.each([
    ['Safari', SAFARI],
    ['Chrome on iOS', CHROME_IOS],
    ['desktop', DESKTOP],
    // Android hands links to Custom Tabs, which Google accepts.
    ['Facebook on Android', ANDROID_FB],
  ])('leaves %s alone', (_name, ua) => expect(isInAppBrowser(ua)).toBe(false))
})

describe('cleanLink', () => {
  it('drops the sharing app tracking id', () => {
    expect(cleanLink('https://meuwe.eu/?fbclid=IwZXh0bgNhZW0&_aem=1')).toBe('https://meuwe.eu/')
  })
  it('keeps our own parameters', () => {
    expect(cleanLink('https://meuwe.eu/?event=42&fbclid=abc')).toBe('https://meuwe.eu/?event=42')
  })
  it('passes anything unparseable straight through', () => {
    expect(cleanLink('not a url')).toBe('not a url')
  })
})

describe('browserEscapeUrl', () => {
  it('prefixes the cleaned address with the Safari scheme', () => {
    expect(browserEscapeUrl('https://meuwe.eu/?fbclid=abc')).toBe('x-safari-https://meuwe.eu/')
  })
})
