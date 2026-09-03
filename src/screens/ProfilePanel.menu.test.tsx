import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import ProfilePanel from './ProfilePanel'
import type { Profile } from '../lib/types'
import '../lib/i18n'
import i18n from 'i18next'

vi.mock('../lib/push', () => ({
  getDevicePushState: () => Promise.resolve({ permission: 'default', registered: false }),
  enablePushOnThisDevice: () => Promise.resolve({ permission: 'default', registered: false }),
  disablePushOnThisDevice: () => Promise.resolve(),
}))

vi.mock('../lib/supabase', () => ({
  db: { updateProfile: vi.fn().mockResolvedValue({}) },
  supabase: {},
}))

const session = { user: { id: 'u1', email: 'a@b.c' } } as unknown as Session
const profile: Profile = {
  id: 'u1', display_name: 'Ala', nickname: null, name_shown: 'Ala', avatar_color: null,
  bio: null, home_name: null, creator_kind: null, link_url: null,
  radius_km: 10, interests: [], interests_onboarded_at: null,
  last_lat: null, last_lng: null, last_seen_at: null,
  created_at: '', push_enabled: false, language: 'en',
}

describe('ProfilePanel menu', () => {
  // Pozycja siedzi pod „Obserwowane” i prowadzi do listy obserwowanych twórców.
  it('offers followed users right after followed events', () => {
    i18n.changeLanguage('en')
    const onOpenFollowedUsers = vi.fn()
    render(
      <ProfilePanel
        open onClose={() => {}} session={session} profile={profile}
        onSignOut={() => {}} reloadProfile={() => {}}
        onOpenMyEvents={() => {}} onOpenFollowedEvents={() => {}}
        onOpenFollowedUsers={onOpenFollowedUsers}
        onOpenAccount={() => {}} onOpenMyData={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button').map(b => b.textContent ?? '')
    const events = buttons.findIndex(t => t.startsWith('Following'))
    const users = buttons.findIndex(t => t.startsWith('Followed users'))
    expect(events).toBeGreaterThan(-1)
    expect(users).toBe(events + 1)
    fireEvent.click(screen.getByRole('button', { name: /Followed users/ }))
    expect(onOpenFollowedUsers).toHaveBeenCalledTimes(1)
  })
})
