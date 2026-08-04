import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InterestsOnboardingModal from './InterestsOnboardingModal'
import { ONBOARDING_CATEGORIES } from '../lib/tokens'
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

describe('InterestsOnboardingModal', () => {
  it('offers the same six categories as the filter bar, in the same order', () => {
    render(<InterestsOnboardingModal userId="u1" onDone={() => {}} onSkip={() => {}} />)
    expect(ONBOARDING_CATEGORIES).toEqual(['party', 'music', 'culture', 'sport', 'food', 'outdoor'])
    for (const cat of ONBOARDING_CATEGORIES) {
      expect(screen.getByRole('button', { name: new RegExp(cat, 'i') })).toBeInTheDocument()
    }
  })

  it('writes the picked interests and the radius in one go', async () => {
    const onDone = vi.fn()
    render(<InterestsOnboardingModal userId="u1" onDone={onDone} onSkip={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /music/i }))
    fireEvent.click(screen.getByRole('button', { name: /food/i }))
    fireEvent.click(screen.getByText('Done'))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({ id: 'u1', interests: ['music', 'food'], radius_km: 10 })
  })

  it('lets a tile be turned back off', async () => {
    render(<InterestsOnboardingModal userId="u1" onDone={() => {}} onSkip={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /music/i }))
    fireEvent.click(screen.getByRole('button', { name: /music/i }))
    fireEvent.click(screen.getByText('Done'))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({ id: 'u1', interests: [], radius_km: 10 })
  })

  it('saves the radius the user dragged to', async () => {
    render(<InterestsOnboardingModal userId="u1" onDone={() => {}} onSkip={() => {}} />)

    fireEvent.change(screen.getByLabelText('How far we look'), { target: { value: '25' } })
    fireEvent.click(screen.getByText('Done'))

    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({ id: 'u1', interests: [], radius_km: 25 })
  })

  // Skipping is an answer, not a write: the profile keeps whatever it had.
  it('writes nothing when the step is skipped', () => {
    const onSkip = vi.fn()
    render(<InterestsOnboardingModal userId="u1" onDone={() => {}} onSkip={onSkip} />)

    fireEvent.click(screen.getByText('Skip'))

    expect(onSkip).toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  // A failed write must not pretend the step succeeded — but it must not trap
  // the user in the modal either. It closes, and the failure is logged.
  it('closes even when the write fails', async () => {
    updateProfile.mockRejectedValue(new Error('offline'))
    const onDone = vi.fn()
    render(<InterestsOnboardingModal userId="u1" onDone={onDone} onSkip={() => {}} />)

    fireEvent.click(screen.getByText('Done'))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
