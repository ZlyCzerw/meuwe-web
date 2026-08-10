import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StoreBadge, { StoreHint } from './StoreBadge'
import { deviceStoreOs, storeUrl } from '../lib/stores'

vi.mock('../lib/supabase', () => ({ db: { trackClick: vi.fn() }, supabase: {} }))

// Both listings are live. The opposite case — an empty URL, which must render
// nothing rather than a link to nowhere — lives in StoreBadge.noListing.test.tsx,
// because vi.mock is per file and the two cannot share one.
vi.mock('../lib/appConfig', () => ({
  IOS_STORE_URL: 'https://apps.apple.com/app/id6790770081',
  ANDROID_STORE_URL: 'https://play.google.com/store/apps/details?id=eu.meuwe',
}))

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

function setAgent(ua: string, touchPoints = 0) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true })
}

afterEach(() => setAgent(DESKTOP))

describe('deviceStoreOs', () => {
  it('is null on desktop — there is nothing to install', () => {
    setAgent(DESKTOP)
    expect(deviceStoreOs()).toBeNull()
  })

  it('is ios on an iPhone', () => {
    setAgent(IPHONE)
    expect(deviceStoreOs()).toBe('ios')
  })

  it('is android on an Android phone', () => {
    setAgent(ANDROID)
    expect(deviceStoreOs()).toBe('android')
  })

  it('sees an iPad that claims to be a Mac', () => {
    setAgent(DESKTOP, 5)
    expect(deviceStoreOs()).toBe('ios')
  })

  it('points both stores at a country-free URL, so each storefront picks its own', () => {
    // A /pl path or an ?l=pl query would hand a Polish page to someone in Tenerife.
    expect(storeUrl('ios')).toBe('https://apps.apple.com/app/id6790770081')
    expect(storeUrl('ios')).not.toMatch(/\/[a-z]{2}\/app\/|[?&]l=/)
    expect(storeUrl('android')).not.toMatch(/[?&](hl|gl)=/)
  })
})

describe('StoreHint', () => {
  it('renders nothing on desktop', () => {
    setAgent(DESKTOP)
    const { container } = render(<StoreHint />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the App Store badge on an iPhone', () => {
    setAgent(IPHONE)
    render(<StoreHint />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://apps.apple.com/app/id6790770081')
    expect(screen.getByText('App Store')).toBeInTheDocument()
  })

  it('renders the Play badge on Android', () => {
    setAgent(ANDROID)
    render(<StoreHint />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=eu.meuwe')
    expect(screen.getByText('Google Play')).toBeInTheDocument()
  })
})

describe('StoreBadge', () => {
  it('is a real link when the listing exists', () => {
    render(<StoreBadge os="android" />)
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
  })

  it('is a real link for iOS too', () => {
    render(<StoreBadge os="ios" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://apps.apple.com/app/id6790770081')
  })

  it('takes the line above the store name from a per-store key', () => {
    // Apple's guidelines say "Download on the App Store", Google's say "Get it
    // on Google Play", so one shared key cannot serve both. i18n is not started
    // in tests and t() echoes the key back, which is what makes the two keys
    // visible here — the wording itself is pinned by the locale files.
    const { unmount } = render(<StoreBadge os="ios" />)
    expect(screen.getByText('store.applePre')).toBeInTheDocument()
    unmount()
    render(<StoreBadge os="android" />)
    expect(screen.getByText('store.googlePre')).toBeInTheDocument()
  })

  it('can be shown as a disabled "soon" badge on the landing page', () => {
    render(<StoreBadge os="android" disabled />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
