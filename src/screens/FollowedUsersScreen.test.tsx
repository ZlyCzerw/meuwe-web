import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import FollowedUsersScreen from './FollowedUsersScreen'
import type { FollowedUser } from '../lib/types'
import '../lib/i18n'
import i18n from 'i18next'

const getFollowedUsers = vi.fn<(id: string) => Promise<FollowedUser[]>>()
const unfollowUser = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    getFollowedUsers: (id: string) => getFollowedUsers(id),
    unfollowUser: (...a: unknown[]) => unfollowUser(...a),
  },
  supabase: {},
}))

const session = { user: { id: 'me' } } as unknown as Session
const kasia: FollowedUser = {
  id: 'u2', display_name: 'Kasia', avatar_color: '#4FC3F7',
  bio: 'Organizuję potańcówki', home_name: 'Tacoronte', creator_kind: 'organizer',
}
const tomek: FollowedUser = {
  id: 'u3', display_name: 'Tomek', avatar_color: null, bio: null, home_name: null, creator_kind: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.changeLanguage('en')
  unfollowUser.mockResolvedValue({ error: null })
})

describe('FollowedUsersScreen', () => {
  it('lists the followed users with their public details', async () => {
    getFollowedUsers.mockResolvedValue([kasia, tomek])
    render(<FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={() => {}} />)
    expect(await screen.findByText('Kasia')).toBeInTheDocument()
    expect(screen.getByText('Tomek')).toBeInTheDocument()
    expect(screen.getByText('An organiser')).toBeInTheDocument()
    expect(screen.getByText('Tacoronte')).toBeInTheDocument()
    expect(screen.getByText('Organizuję potańcówki')).toBeInTheDocument()
    expect(getFollowedUsers).toHaveBeenCalledWith('me')
  })

  it('opens the card of the tapped user', async () => {
    getFollowedUsers.mockResolvedValue([kasia, tomek])
    const onOpenUser = vi.fn()
    render(<FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={onOpenUser} />)
    fireEvent.click(await screen.findByRole('button', { name: /Tomek/ }))
    expect(onOpenUser).toHaveBeenCalledWith('u3')
  })

  it('explains an empty list', async () => {
    getFollowedUsers.mockResolvedValue([])
    render(<FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={() => {}} />)
    expect(await screen.findByText("You don't follow anyone yet. Tap an organizer in an event card.")).toBeInTheDocument()
  })

  // Odobserwowany z poziomu karty ma zniknąć z listy, gdy karta się zamknie.
  it('reloads the list when the user card closes', async () => {
    getFollowedUsers.mockResolvedValue([kasia])
    const { rerender } = render(
      <FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={() => {}} userCardOpen={false} />,
    )
    await screen.findByText('Kasia')
    rerender(<FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={() => {}} userCardOpen />)
    expect(getFollowedUsers).toHaveBeenCalledTimes(1)
    getFollowedUsers.mockResolvedValue([])
    rerender(<FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={() => {}} userCardOpen={false} />)
    await waitFor(() => expect(getFollowedUsers).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("You don't follow anyone yet. Tap an organizer in an event card.")).toBeInTheDocument()
  })

  it('unfollows from the minus button without opening the card', async () => {
    getFollowedUsers.mockResolvedValue([kasia, tomek])
    const onOpenUser = vi.fn()
    render(<FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={onOpenUser} />)
    await screen.findByText('Kasia')
    fireEvent.click(screen.getAllByRole('button', { name: 'Unfollow' })[0])
    expect(screen.queryByText('Kasia')).not.toBeInTheDocument()
    expect(screen.getByText('Tomek')).toBeInTheDocument()
    await waitFor(() => expect(unfollowUser).toHaveBeenCalledWith('u2'))
    expect(onOpenUser).not.toHaveBeenCalled()
  })

  it('puts the user back when unfollowing fails', async () => {
    getFollowedUsers.mockResolvedValue([kasia])
    unfollowUser.mockResolvedValue({ error: { message: 'boom' } })
    render(<FollowedUsersScreen session={session} onBack={() => {}} onOpenUser={() => {}} />)
    await screen.findByText('Kasia')
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }))
    expect(await screen.findByText('Kasia')).toBeInTheDocument()
  })

  it('goes back', async () => {
    getFollowedUsers.mockResolvedValue([])
    const onBack = vi.fn()
    render(<FollowedUsersScreen session={session} onBack={onBack} onOpenUser={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '‹' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
