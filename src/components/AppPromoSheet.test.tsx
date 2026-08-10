import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppPromoSheet from './AppPromoSheet'

vi.mock('../lib/supabase', () => ({ db: { trackClick: vi.fn() }, supabase: {} }))

vi.mock('../lib/appConfig', () => ({
  IOS_STORE_URL: 'https://apps.apple.com/app/id6790770081',
  ANDROID_STORE_URL: 'https://play.google.com/store/apps/details?id=eu.meuwe',
}))

// The sheet is the one place a mobile web visitor is asked to take the app, and
// App.tsx only mounts it for an os deviceStoreOs() vouched for. What is left to
// pin here is that the badge inside it really points at that phone's store —
// for a year the iOS half of this could not be reached at all.

describe('AppPromoSheet', () => {
  it('offers the App Store to an iPhone', () => {
    render(<AppPromoSheet os="ios" onClose={() => {}} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://apps.apple.com/app/id6790770081')
    expect(link).toHaveTextContent('App Store')
    expect(screen.getByText('store.applePre')).toBeInTheDocument()
  })

  it('offers Google Play to an Android phone', () => {
    render(<AppPromoSheet os="android" onClose={() => {}} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=eu.meuwe')
    expect(link).toHaveTextContent('Google Play')
  })

  it('closes itself when the badge is followed, so it is not waiting on return', () => {
    const onClose = vi.fn()
    render(<AppPromoSheet os="ios" onClose={onClose} />)
    screen.getByRole('link').click()
    expect(onClose).toHaveBeenCalled()
  })
})
