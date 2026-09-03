import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import FollowedEventsScreen from './FollowedEventsScreen'
import type { EventWithMsgCount } from '../lib/types'
import '../lib/i18n'
import i18n from 'i18next'

const getFollowedEvents = vi.fn<() => Promise<EventWithMsgCount[]>>()
const unfollowEvent = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    getFollowedEvents: () => getFollowedEvents(),
    unfollowEvent: (...a: unknown[]) => unfollowEvent(...a),
  },
  supabase: {},
}))
vi.mock('../lib/push', () => ({
  getEventMutes: () => Promise.resolve([]),
  muteEvent: () => Promise.resolve(),
  unmuteEvent: () => Promise.resolve(),
}))

const session = { user: { id: 'me' } } as unknown as Session
const soon = new Date(Date.now() + 3600_000).toISOString()
const later = new Date(Date.now() + 7200_000).toISOString()
function event(id: string, title: string): EventWithMsgCount {
  return {
    id, title, category: 'party', status: 'upcoming', creator_id: 'u2',
    start_time: soon, end_time: later, lat: 0, lng: 0, place_name: null, msgCount: 0,
  } as unknown as EventWithMsgCount
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.changeLanguage('en')
  unfollowEvent.mockResolvedValue({ error: null })
})

describe('FollowedEventsScreen quick unfollow', () => {
  it('removes the row and unfollows the event', async () => {
    getFollowedEvents.mockResolvedValue([event('e1', 'Koncert'), event('e2', 'Piknik')])
    render(<FollowedEventsScreen session={session} onBack={() => {}} onOpenEvent={() => {}} />)
    await screen.findByText('Koncert')
    fireEvent.click(screen.getAllByRole('button', { name: 'Unfollow' })[0])
    expect(screen.queryByText('Koncert')).not.toBeInTheDocument()
    expect(screen.getByText('Piknik')).toBeInTheDocument()
    expect(unfollowEvent).toHaveBeenCalledWith('e1')
  })

  // Wiersz zniknął optymistycznie; nieudany zapis ma go przywrócić.
  it('puts the row back when unfollowing fails', async () => {
    getFollowedEvents.mockResolvedValue([event('e1', 'Koncert')])
    unfollowEvent.mockResolvedValue({ error: { message: 'boom' } })
    render(<FollowedEventsScreen session={session} onBack={() => {}} onOpenEvent={() => {}} />)
    await screen.findByText('Koncert')
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }))
    expect(await screen.findByText('Koncert')).toBeInTheDocument()
  })

  it('does not open the event when the minus is tapped', async () => {
    getFollowedEvents.mockResolvedValue([event('e1', 'Koncert')])
    const onOpenEvent = vi.fn()
    render(<FollowedEventsScreen session={session} onBack={() => {}} onOpenEvent={onOpenEvent} />)
    await screen.findByText('Koncert')
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow' }))
    await waitFor(() => expect(unfollowEvent).toHaveBeenCalled())
    expect(onOpenEvent).not.toHaveBeenCalled()
  })
})
