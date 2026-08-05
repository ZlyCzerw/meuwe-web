import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InterestsOnboardingModal from './InterestsOnboardingModal'
import { ALL_CATEGORIES } from '../lib/tokens'
// Without this the translator returns raw keys and every assertion is meaningless.
import '../lib/i18n'

const updateProfile = vi.fn<() => Promise<unknown>>()
const enablePushOnThisDevice = vi.fn<() => Promise<{ permission: string; registered: boolean }>>()
vi.mock('../lib/supabase', () => ({
  db: { updateProfile: (...a: unknown[]) => updateProfile(...(a as [])) },
  supabase: {},
}))
vi.mock('../lib/push', () => ({ enablePushOnThisDevice: () => enablePushOnThisDevice() }))

beforeEach(() => {
  vi.clearAllMocks()
  updateProfile.mockResolvedValue({ error: null })
  enablePushOnThisDevice.mockResolvedValue({ permission: 'granted', registered: true })
})

const doneButton = () => screen.getByRole('button', { name: 'Done' })

describe('InterestsOnboardingModal', () => {
  it('offers the same vocabulary as the picker behind the plus button', () => {
    render(<InterestsOnboardingModal userId="u1" radiusKm={20} onDone={() => {}} />)
    // One pass over the tree: twenty-one separate getByRole calls walked it
    // twenty-one times and timed out under a full-suite run.
    const labels = screen.getAllByRole('button').map(b => b.textContent?.trim())
    for (const cat of ALL_CATEGORIES) {
      expect(labels).toContain(cat)
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
    expect(updateProfile).toHaveBeenCalledWith({
      id: 'u1', interests: ['music', 'food'], radius_km: 17, push_enabled: true,
    })
  })

  // The card says "we'll let you know when something happens nearby". Saving the
  // categories and leaving notifications off would make that a lie the user only
  // discovers weeks later, by never hearing anything.
  it('turns notifications on, because that is what the card promised', async () => {
    render(<InterestsOnboardingModal userId="u1" radiusKm={17} onDone={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /^music$/i }))
    fireEvent.click(doneButton())

    await waitFor(() => expect(enablePushOnThisDevice).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({
      id: 'u1', interests: ['music'], radius_km: 17, push_enabled: true,
    })
  })

  it('saves the interests even when the device refuses notifications', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'denied', registered: false })
    const onDone = vi.fn()
    render(<InterestsOnboardingModal userId="u1" radiusKm={17} onDone={onDone} />)

    fireEvent.click(screen.getByRole('button', { name: /^music$/i }))
    fireEvent.click(doneButton())

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    // Still recorded: 'denied' is repairable from the profile, so the wish is worth keeping.
    expect(updateProfile).toHaveBeenCalledWith({
      id: 'u1', interests: ['music'], radius_km: 17, push_enabled: true,
    })
  })

  // Nothing to repair here, so claiming the wish would leave the profile
  // permanently promising something this platform cannot do.
  it('does not claim notifications on a platform that cannot deliver them', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'unsupported', registered: false })
    const onDone = vi.fn()
    render(<InterestsOnboardingModal userId="u1" radiusKm={17} onDone={onDone} />)

    fireEvent.click(screen.getByRole('button', { name: /^music$/i }))
    fireEvent.click(doneButton())

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(updateProfile).toHaveBeenCalledWith({ id: 'u1', interests: ['music'], radius_km: 17 })
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
