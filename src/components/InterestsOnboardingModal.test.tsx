import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InterestsOnboardingModal from './InterestsOnboardingModal'
import { ALL_CATEGORIES } from '../lib/tokens'
// Without this the translator returns raw keys and every assertion is meaningless.
import '../lib/i18n'

const updateProfile = vi.fn<() => Promise<unknown>>()
vi.mock('../lib/supabase', () => ({
  db: { updateProfile: (...a: unknown[]) => updateProfile(...(a as [])) },
  supabase: {},
}))

beforeEach(() => {
  vi.clearAllMocks()
  updateProfile.mockResolvedValue({ error: null })
})

const doneButton = () => screen.getByRole('button', { name: 'Done' })

describe('InterestsOnboardingModal', () => {
  it('offers the same vocabulary as the picker behind the plus button', () => {
    render(<InterestsOnboardingModal userId="u1" radiusKm={20} onDone={() => {}} />)
    for (const cat of ALL_CATEGORIES) {
      expect(screen.getByRole('button', { name: new RegExp(`^${cat}$`, 'i') })).toBeInTheDocument()
    }
  })

  it('does not ask a brand-new account to invent its own tag', () => {
    render(<InterestsOnboardingModal userId="u1" radiusKm={20} onDone={() => {}} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  // The radius is worked out from what is actually happening nearby, so there is
  // nothing here for the user to set.
  it('shows no radius control', () => {
    const { container } = render(<InterestsOnboardingModal userId="u1" radiusKm={20} onDone={() => {}} />)
    expect(container.querySelector('input[type=range]')).toBeNull()
  })

  // Skipping is gone: the step is the only thing standing between a new account
  // and an empty interests column, which the fan-out reads as "notify nobody".
  it('offers no way past without an answer', () => {
    render(<InterestsOnboardingModal userId="u1" radiusKm={20} onDone={() => {}} />)
    expect(screen.queryByText('Skip')).not.toBeInTheDocument()
    expect(doneButton()).toBeDisabled()
  })

  it('stays shut until at least one thing is picked, then opens', () => {
    render(<InterestsOnboardingModal userId="u1" radiusKm={20} onDone={() => {}} />)
    expect(doneButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /^music$/i }))
    expect(doneButton()).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /^music$/i }))
    expect(doneButton()).toBeDisabled()
  })

  it('writes the picked interests with the radius it was handed', async () => {
    const onDone = vi.fn()
    render(<InterestsOnboardingModal userId="u1" radiusKm={17} onDone={onDone} />)

    fireEvent.click(screen.getByRole('button', { name: /^music$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^food$/i }))
    fireEvent.click(doneButton())

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({ id: 'u1', interests: ['music', 'food'], radius_km: 17 })
  })

  it('still tells the user where to change this later', () => {
    render(<InterestsOnboardingModal userId="u1" radiusKm={20} initial="w" onDone={() => {}} />)
    expect(screen.getByText(/change this any time in the menu/i)).toBeInTheDocument()
    expect(screen.getByText('W')).toBeInTheDocument()
  })

  // A failed write must not pretend it succeeded, but it must not trap the user
  // in a modal with no way out either.
  it('closes even when the write fails', async () => {
    updateProfile.mockRejectedValue(new Error('offline'))
    const onDone = vi.fn()
    render(<InterestsOnboardingModal userId="u1" radiusKm={20} onDone={onDone} />)

    fireEvent.click(screen.getByRole('button', { name: /^music$/i }))
    fireEvent.click(doneButton())

    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
