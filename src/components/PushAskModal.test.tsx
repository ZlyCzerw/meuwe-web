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
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={() => {}} />)
    expect(screen.getByText(/when something starts nearby/i)).toBeInTheDocument()
    expect(enablePushOnThisDevice).not.toHaveBeenCalled()
  })

  it('records the intent and the device together when accepted', async () => {
    enablePushOnThisDevice.mockResolvedValue({ permission: 'granted', registered: true })
    const onEnabled = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={onEnabled} onDecline={() => {}} />)

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
    render(<PushAskModal userId="u1" onEnabled={onEnabled} onDecline={onDecline} />)

    fireEvent.click(screen.getByText('Turn on notifications'))

    await waitFor(() => expect(onDecline).toHaveBeenCalled())
    expect(onEnabled).not.toHaveBeenCalled()
  })

  it('takes "not now" for an answer without touching the device', () => {
    const onDecline = vi.fn()
    render(<PushAskModal userId="u1" onEnabled={() => {}} onDecline={onDecline} />)

    fireEvent.click(screen.getByText('Not now'))

    expect(onDecline).toHaveBeenCalled()
    expect(enablePushOnThisDevice).not.toHaveBeenCalled()
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
