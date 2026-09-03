import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import MyEventsScreen from './MyEventsScreen'
import type { EventWithMsgCount } from '../lib/types'
import '../lib/i18n'
import i18n from 'i18next'

const getMyEvents = vi.fn<() => Promise<EventWithMsgCount[]>>()
const endEvent = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    getMyEvents: () => getMyEvents(),
    endEvent: (...a: unknown[]) => endEvent(...a),
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
const past = new Date(Date.now() - 7200_000).toISOString()
function event(id: string, title: string, over: Partial<EventWithMsgCount> = {}): EventWithMsgCount {
  return {
    id, title, category: 'party', status: 'upcoming', creator_id: 'me',
    start_time: soon, end_time: later, lat: 0, lng: 0, place_name: null, msgCount: 0,
    ...over,
  } as unknown as EventWithMsgCount
}

beforeEach(() => {
  vi.clearAllMocks()
  i18n.changeLanguage('en')
  endEvent.mockResolvedValue({ error: null })
})

describe('MyEventsScreen quick actions', () => {
  it('opens the editor for the tapped event without opening the card', async () => {
    const ev = event('e1', 'Koncert')
    getMyEvents.mockResolvedValue([ev])
    const onEdit = vi.fn()
    const onOpenEvent = vi.fn()
    render(<MyEventsScreen session={session} onBack={() => {}} onOpenEvent={onOpenEvent} onEdit={onEdit} />)
    await screen.findByText('Koncert')
    fireEvent.click(screen.getByRole('button', { name: 'Edit event' }))
    expect(onEdit).toHaveBeenCalledWith(ev)
    expect(onOpenEvent).not.toHaveBeenCalled()
  })

  // Ikona 32 px obok dzwonka: pierwszy tap tylko pyta, drugi kończy.
  it('ends the event on the second tap only and moves it to Ended', async () => {
    getMyEvents.mockResolvedValue([event('e1', 'Koncert')])
    render(<MyEventsScreen session={session} onBack={() => {}} onOpenEvent={() => {}} onEdit={() => {}} />)
    await screen.findByText('Koncert')
    expect(screen.queryAllByText('Ended')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'End event' }))
    expect(endEvent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'End it?' }))
    await waitFor(() => expect(endEvent).toHaveBeenCalledWith('e1'))
    // Nagłówek sekcji „Ended” plus pigułka statusu w wierszu.
    expect(await screen.findAllByText('Ended')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'End event' })).not.toBeInTheDocument()
  })

  it('keeps the event when ending fails', async () => {
    getMyEvents.mockResolvedValue([event('e1', 'Koncert')])
    endEvent.mockResolvedValue({ error: { message: 'boom' } })
    render(<MyEventsScreen session={session} onBack={() => {}} onOpenEvent={() => {}} onEdit={() => {}} />)
    await screen.findByText('Koncert')
    fireEvent.click(screen.getByRole('button', { name: 'End event' }))
    fireEvent.click(screen.getByRole('button', { name: 'End it?' }))
    await waitFor(() => expect(endEvent).toHaveBeenCalled())
    expect(screen.queryAllByText('Ended')).toHaveLength(0)
    expect(await screen.findByRole('button', { name: 'End event' })).toBeInTheDocument()
  })

  it('offers no edit or end for an ended event', async () => {
    getMyEvents.mockResolvedValue([event('e1', 'Stare', { status: 'ended', start_time: past, end_time: past })])
    render(<MyEventsScreen session={session} onBack={() => {}} onOpenEvent={() => {}} onEdit={() => {}} />)
    await screen.findByText('Stare')
    expect(screen.queryByRole('button', { name: 'Edit event' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End event' })).not.toBeInTheDocument()
  })
})
