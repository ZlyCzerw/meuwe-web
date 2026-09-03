import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import UserCard from './UserCard'
import type { PublicProfile } from '../lib/types'
import '../lib/i18n'
import i18n from 'i18next'

const getPublicProfile = vi.fn<() => Promise<PublicProfile | null>>()
const followUser = vi.fn()
const unfollowUser = vi.fn()
const trackClick = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    getPublicProfile: () => getPublicProfile(),
    followUser: (...a: unknown[]) => followUser(...a),
    unfollowUser: (...a: unknown[]) => unfollowUser(...a),
    trackClick: (...a: unknown[]) => trackClick(...a),
  },
  supabase: {},
}))

const session = { user: { id: 'me' } } as unknown as Session

function profile(over: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id: 'u2', display_name: 'Kasia', avatar_color: '#4FC3F7',
    bio: 'Organizuję potańcówki', home_name: 'Puerto de la Cruz',
    creator_kind: 'organizer', link_url: 'https://example.org/kasia',
    events_count: 12, followers_count: 8, is_following: false,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.changeLanguage('en')
  followUser.mockResolvedValue({ error: null })
  unfollowUser.mockResolvedValue({ error: null })
})

describe('UserCard', () => {
  it('shows name, bio, pills, counters and link', async () => {
    getPublicProfile.mockResolvedValue(profile())
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Kasia')).toBeInTheDocument()
    expect(screen.getByText('Organizuję potańcówki')).toBeInTheDocument()
    expect(screen.getByText('An organiser')).toBeInTheDocument()
    expect(screen.getByText('Puerto de la Cruz')).toBeInTheDocument()
    expect(screen.getByText(/12 events/)).toBeInTheDocument()
    expect(screen.getByText(/8 followers/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'example.org/kasia' })).toHaveAttribute('href', 'https://example.org/kasia')
  })

  // Puste pole to brak pigułki, nie pigułka z pustym środkiem.
  it('hides empty fields', async () => {
    getPublicProfile.mockResolvedValue(profile({ bio: null, home_name: null, creator_kind: null, link_url: null }))
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    await screen.findByText('Kasia')
    expect(screen.queryByText('An organiser')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('follows optimistically: label and counter change before the request resolves', async () => {
    getPublicProfile.mockResolvedValue(profile())
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Follow' }))
    expect(screen.getByRole('button', { name: 'Following ✓' })).toBeInTheDocument()
    expect(screen.getByText(/9 followers/)).toBeInTheDocument()
    expect(followUser).toHaveBeenCalledWith('u2')
    expect(trackClick).toHaveBeenCalledWith('follow_user')
  })

  it('unfollows on the second tap', async () => {
    getPublicProfile.mockResolvedValue(profile({ is_following: true }))
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Following ✓' }))
    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u2'))
    expect(screen.getByRole('button', { name: '+ Follow' })).toBeInTheDocument()
    expect(screen.getByText(/7 followers/)).toBeInTheDocument()
    expect(trackClick).toHaveBeenCalledWith('unfollow_user')
  })

  // Nieudany zapis nie może zostawić "Obserwujesz ✓" na ekranie.
  it('reverts and says so when the request fails', async () => {
    getPublicProfile.mockResolvedValue(profile())
    followUser.mockResolvedValue({ error: { message: 'boom' } })
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Follow' }))
    expect(await screen.findByText('Could not save. Try again')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Follow' })).toBeInTheDocument()
    expect(screen.getByText(/8 followers/)).toBeInTheDocument()
  })

  it('sends a guest to sign in instead of following', async () => {
    getPublicProfile.mockResolvedValue(profile())
    const onAuthNeeded = vi.fn()
    render(<UserCard userId="u2" session={null} onAuthNeeded={onAuthNeeded} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: '+ Follow' }))
    expect(onAuthNeeded).toHaveBeenCalledTimes(1)
    expect(followUser).not.toHaveBeenCalled()
  })

  it('shows no follow button on your own profile', async () => {
    getPublicProfile.mockResolvedValue(profile({ id: 'me' }))
    render(<UserCard userId="me" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('This is you')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Follow' })).not.toBeInTheDocument()
  })

  it('reports a missing profile', async () => {
    getPublicProfile.mockResolvedValue(null)
    render(<UserCard userId="gone" session={session} onAuthNeeded={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Could not load this profile')).toBeInTheDocument()
  })

  it('closes on the × button and on the backdrop', async () => {
    getPublicProfile.mockResolvedValue(profile())
    const onClose = vi.fn()
    render(<UserCard userId="u2" session={session} onAuthNeeded={() => {}} onClose={onClose} />)
    await screen.findByText('Kasia')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByTestId('user-card-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
