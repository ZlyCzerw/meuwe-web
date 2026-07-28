import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StoreBadge, { deviceStoreOs, StoreHint, storeUrl } from './StoreBadge'

vi.mock('../lib/supabase', () => ({ db: { trackClick: vi.fn() }, supabase: {} }))

// appConfig ships IOS_STORE_URL empty while the App Store review is pending,
// which is exactly the case these tests pin down.
vi.mock('../lib/appConfig', () => ({
  IOS_STORE_URL: '',
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

  it('is null on iOS while the App Store listing does not exist', () => {
    setAgent(IPHONE)
    expect(storeUrl('ios')).toBe('')
    expect(deviceStoreOs()).toBeNull()
  })

  it('is android on an Android phone', () => {
    setAgent(ANDROID)
    expect(deviceStoreOs()).toBe('android')
  })

  it('sees an iPad that claims to be a Mac', () => {
    setAgent(DESKTOP, 5)
    // Recognised as iOS, but still no listing, so still nothing to show.
    expect(deviceStoreOs()).toBeNull()
  })
})

describe('StoreHint', () => {
  it('renders nothing on desktop', () => {
    setAgent(DESKTOP)
    const { container } = render(<StoreHint />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on iOS rather than a link to nowhere', () => {
    setAgent(IPHONE)
    const { container } = render(<StoreHint />)
    expect(container).toBeEmptyDOMElement()
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

  it('is not a link at all when the URL is empty', () => {
    render(<StoreBadge os="ios" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('App Store')).toBeInTheDocument()
  })

  it('can be shown as a disabled "soon" badge on the landing page', () => {
    render(<StoreBadge os="android" disabled />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
