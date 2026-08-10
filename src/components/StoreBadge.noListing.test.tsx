import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StoreBadge, { StoreHint } from './StoreBadge'
import { deviceStoreOs } from '../lib/stores'

vi.mock('../lib/supabase', () => ({ db: { trackClick: vi.fn() }, supabase: {} }))

// Both stores are live today, so the sibling file covers the normal case. This
// one keeps the other half of appConfig's contract honest: an empty URL means
// "no listing", and must render nothing rather than a link to nowhere. It is a
// separate file only because vi.mock is per file — the two mocks cannot coexist.
vi.mock('../lib/appConfig', () => ({
  IOS_STORE_URL: '',
  ANDROID_STORE_URL: '',
}))

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

function setAgent(ua: string, touchPoints = 0) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touchPoints, configurable: true })
}

afterEach(() => setAgent(DESKTOP))

describe('a store with no listing', () => {
  it('is not offered to the phone it belongs to', () => {
    setAgent(IPHONE)
    expect(deviceStoreOs()).toBeNull()
    setAgent(ANDROID)
    expect(deviceStoreOs()).toBeNull()
  })

  it('renders no hint at all under the sign-in buttons', () => {
    setAgent(IPHONE)
    const { container } = render(<StoreHint />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the badge as text, never as a link', () => {
    render(<StoreBadge os="ios" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('App Store')).toBeInTheDocument()
    expect(screen.getByText('store.soon')).toBeInTheDocument()
  })
})
