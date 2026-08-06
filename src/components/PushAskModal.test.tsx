import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PushAskModal from './PushAskModal'
import '../lib/i18n'

const enablePushOnThisDevice = vi.fn<() => Promise<{ permission: string; registered: boolean }>>()
const updateProfile = vi.fn<() => Promise<unknown>>()
const trackClick = vi.fn()

vi.mock('../lib/push', () => ({ enablePushOnThisDevice: () => enablePushOnThisDevice() }))
vi.mock('../lib/supabase', () => ({
  db: { updateProfile: (...a: unknown[]) => updateProfile(...(a as [])), trackClick: (...a: unknown[]) => trackClick(...a) },
  supabase: {},
}))

beforeEach(() => {
  vi.clearAllMocks()
  updateProfile.mockResolvedValue({ error: null })
})

describe('PushAskModal', () => {
  it('says what the notifications are for before asking for anything', () => {
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={() => {}} onFailed={() => {}} />)
    expect(screen.getByText(/when something starts nearby/i)).toBeInTheDocument()
    expect(enablePushOnThisDevice).not.toHaveBeenCalled()
  })

  it('records the intent and the device together when accepted', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'granted', registered: true })
    const onEnabled = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={onEnabled} onDecline={() => {}} onFailed={() => {}} />)

    fireEvent.click(screen.getByText('Turn on notifications'))

    await waitFor(() => expect(onEnabled).toHaveBeenCalled())
    expect(enablePushOnThisDevice).toHaveBeenCalled()
    expect(updateProfile).toHaveBeenCalledWith({ id: 'u1', push_enabled: true })
  })

  // A refused system prompt is a refusal, not a success: it has to start the
  // same cooldown as pressing "Not now", or the next trigger asks again at once.
  it('counts a refused system prompt as a refusal', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'denied', registered: false })
    const onEnabled = vi.fn()
    const onDecline = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={onEnabled} onDecline={onDecline} onFailed={() => {}} />)

    fireEvent.click(screen.getByText('Turn on notifications'))

    await waitFor(() => expect(onDecline).toHaveBeenCalled())
    expect(onEnabled).not.toHaveBeenCalled()
  })

  // Recording the wish is only useful where something can still be done about
  // it: 'denied' shows up in the profile as blocked, with the system-settings
  // way out. 'unsupported' has no way out at all, so writing it there leaves an
  // account marked as wanting notifications it can never receive.
  it('records the wish when the system said no, because that can still be repaired', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'denied', registered: false })
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={() => {}} onFailed={() => {}} />)

    fireEvent.click(screen.getByText('Turn on notifications'))

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ id: 'u1', push_enabled: true }))
  })

  it('records nothing when the platform cannot deliver at all', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'unsupported', registered: false })
    const onDecline = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={onDecline} onFailed={() => {}} />)

    fireEvent.click(screen.getByText('Turn on notifications'))

    await waitFor(() => expect(onDecline).toHaveBeenCalled())
    expect(updateProfile).not.toHaveBeenCalled()
  })

  // Permission granted but no delivery address is our failure, not the user's
  // answer. Filing it as a refusal would buy 14 days of silence on a network
  // blip, and the user would never learn why nothing arrives.
  it('does not count a failed registration as a refusal', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'granted', registered: false })
    const onDecline = vi.fn()
    const onFailed = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={onDecline} onFailed={onFailed} />)

    fireEvent.click(screen.getByText('Turn on notifications'))

    await waitFor(() => expect(onFailed).toHaveBeenCalled())
    expect(onDecline).not.toHaveBeenCalled()
  })

  it('takes "not now" for an answer without touching the device', () => {
    const onDecline = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={onDecline} onFailed={() => {}} />)

    fireEvent.click(screen.getByText('Not now'))

    expect(onDecline).toHaveBeenCalled()
    expect(enablePushOnThisDevice).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
