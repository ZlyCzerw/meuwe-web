import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import ProfilePanel from './ProfilePanel'
import type { Profile } from '../lib/types'
import type { DevicePushState } from '../lib/pushState'

// Only the platform boundary is faked. resolvePushState and the whole panel run
// for real, so these assertions are about what a user actually sees.
const getDevicePushState = vi.fn<() => Promise<DevicePushState>>()
const enablePushOnThisDevice = vi.fn<() => Promise<DevicePushState>>()
const disablePushOnThisDevice = vi.fn<() => Promise<void>>()

vi.mock('../lib/push', () => ({
  getDevicePushState: () => getDevicePushState(),
  enablePushOnThisDevice: () => enablePushOnThisDevice(),
  disablePushOnThisDevice: () => disablePushOnThisDevice(),
}))

vi.mock('../lib/supabase', () => ({
  db: { updateProfile: vi.fn().mockResolvedValue({}) },
  supabase: {},
}))

const session = { user: { id: 'u1', email: 'a@b.c' } } as unknown as Session

function profile(pushEnabled: boolean): Profile {
  return {
    id: 'u1', display_name: 'Ala', nickname: null, name_shown: 'Ala',
    avatar_color: null, radius_km: 10,
    interests: [], interests_onboarded_at: null,
    last_lat: null, last_lng: null, last_seen_at: null,
    created_at: '', push_enabled: pushEnabled, language: 'en',
  }
}

function renderPanel(pushEnabled: boolean) {
  return render(
    <ProfilePanel
      open
      onClose={() => {}}
      session={session}
      profile={profile(pushEnabled)}
      onSignOut={() => {}}
      reloadProfile={() => {}}
      onOpenMyEvents={() => {}}
      onOpenFollowedEvents={() => {}}
      onOpenAccount={() => {}}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  disablePushOnThisDevice.mockResolvedValue(undefined)
})

describe('ProfilePanel notifications', () => {
  it('says notifications are on only when this device is registered', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'granted', registered: true, confirmed: true })
    renderPanel(true)
    expect(await screen.findByText('Notifications enabled')).toBeInTheDocument()
    expect(screen.queryByText('Turn on for this device')).not.toBeInTheDocument()
  })

  it('warns and offers a fix when the intent is on but the device never asked', async () => {
    // The web-then-native case: push_enabled survived, this device has nothing.
    getDevicePushState.mockResolvedValue({ permission: 'prompt', registered: false, confirmed: true })
    renderPanel(true)
    expect(await screen.findByText('This device does not receive notifications')).toBeInTheDocument()
    expect(screen.getByText('Turn on for this device')).toBeInTheDocument()
    expect(screen.queryByText('Notifications enabled')).not.toBeInTheDocument()
  })

  it('warns when the permission is held but no token or subscription exists', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'granted', registered: false, confirmed: true })
    renderPanel(true)
    expect(await screen.findByText('This device does not receive notifications')).toBeInTheDocument()
    expect(screen.getByText('Turn on for this device')).toBeInTheDocument()
  })

  it('explains a system-level block instead of offering a dead button', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'denied', registered: false, confirmed: true })
    renderPanel(true)
    expect(await screen.findByText('Notifications blocked by the system')).toBeInTheDocument()
    expect(screen.getByText(/allow notifications for this site/)).toBeInTheDocument()
    expect(screen.queryByText('Turn on for this device')).not.toBeInTheDocument()
  })

  it('shows the plain off state without any warning', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'prompt', registered: false, confirmed: true })
    renderPanel(false)
    expect(await screen.findByText('Enable notifications')).toBeInTheDocument()
    expect(screen.queryByText('This device does not receive notifications')).not.toBeInTheDocument()
  })

  it('states the failure when the repair does not work', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'prompt', registered: false, confirmed: true })
    enablePushOnThisDevice.mockResolvedValue({ permission: 'denied', registered: false, confirmed: true })
    renderPanel(true)

    fireEvent.click(await screen.findByText('Turn on for this device'))

    await waitFor(() => {
      expect(screen.getByText('Could not turn notifications on for this device. Please try again.')).toBeInTheDocument()
    })
    // And the reason is updated too: it is now a system block, not a missing prompt.
    expect(screen.getByText('Notifications blocked by the system')).toBeInTheDocument()
  })

  it('clears the warning once the repair succeeds', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'prompt', registered: false, confirmed: true })
    enablePushOnThisDevice.mockResolvedValue({ permission: 'granted', registered: true, confirmed: true })
    renderPanel(true)

    fireEvent.click(await screen.findByText('Turn on for this device'))

    await waitFor(() => expect(screen.getByText('Notifications enabled')).toBeInTheDocument())
    expect(screen.queryByText('This device does not receive notifications')).not.toBeInTheDocument()
  })

  it('records the intent even when the device refuses, and says so', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'prompt', registered: false, confirmed: true })
    enablePushOnThisDevice.mockResolvedValue({ permission: 'denied', registered: false, confirmed: true })
    const { rerender } = renderPanel(false)

    fireEvent.click(await screen.findByText('Enable notifications'))
    await waitFor(() => expect(enablePushOnThisDevice).toHaveBeenCalled())

    // The parent reloads the profile; push_enabled is now true.
    rerender(
      <ProfilePanel
        open onClose={() => {}} session={session} profile={profile(true)}
        onSignOut={() => {}} reloadProfile={() => {}}
        onOpenMyEvents={() => {}} onOpenFollowedEvents={() => {}}
        onOpenAccount={() => {}}
      />
    )
    expect(await screen.findByText('Notifications blocked by the system')).toBeInTheDocument()
  })
})

describe('ProfilePanel identity', () => {
  it('shows the initial of the name the user chose, not the provider name', async () => {
    getDevicePushState.mockResolvedValue({ permission: 'granted', registered: true, confirmed: true })
    render(
      <ProfilePanel
        open
        onClose={() => {}}
        session={session}
        profile={{ ...profile(false), display_name: 'Kasia', nickname: 'Ala', name_shown: 'Ala' }}
        onSignOut={() => {}}
        reloadProfile={() => {}}
        onOpenMyEvents={() => {}}
        onOpenFollowedEvents={() => {}}
        onOpenAccount={() => {}}
      />
    )
    expect(await screen.findByText('Ala')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.queryByText('K')).not.toBeInTheDocument()
  })
})
