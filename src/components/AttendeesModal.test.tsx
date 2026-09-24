import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AttendeesModal from './AttendeesModal'
import '../lib/i18n'
import i18n from 'i18next'

type Attendee = { user_id: string; display_name: string | null; avatar_color: string | null }
const getEventAttendees = vi.fn<(id: string) => Promise<Attendee[] | null>>()
vi.mock('../lib/supabase', () => ({
  db: { getEventAttendees: (id: string) => getEventAttendees(id) },
  supabase: {},
}))

beforeEach(() => {
  vi.clearAllMocks()
  i18n.changeLanguage('en')
})

describe('AttendeesModal', () => {
  it('lists everyone who is going, with a count', async () => {
    getEventAttendees.mockResolvedValue([
      { user_id: 'u1', display_name: 'Kasia', avatar_color: '#4FC3F7' },
      { user_id: 'u2', display_name: 'Marek', avatar_color: null },
    ])
    render(<AttendeesModal eventId="e1" onOpenUser={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Kasia')).toBeInTheDocument()
    expect(screen.getByText('Marek')).toBeInTheDocument()
    expect(screen.getAllByTestId('attendee-row')).toHaveLength(2)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(getEventAttendees).toHaveBeenCalledWith('e1')
  })

  it('opens the profile of the tapped person', async () => {
    getEventAttendees.mockResolvedValue([{ user_id: 'u7', display_name: 'Ola', avatar_color: null }])
    const onOpenUser = vi.fn()
    render(<AttendeesModal eventId="e1" onOpenUser={onOpenUser} onClose={() => {}} />)
    fireEvent.click(await screen.findByText('Ola'))
    expect(onOpenUser).toHaveBeenCalledWith('u7')
  })

  it('says so when nobody is going', async () => {
    getEventAttendees.mockResolvedValue([])
    render(<AttendeesModal eventId="e1" onOpenUser={() => {}} onClose={() => {}} />)
    expect(await screen.findByText('Nobody has signed up yet')).toBeInTheDocument()
  })

  it('tells a failed load apart from an empty list', async () => {
    getEventAttendees.mockResolvedValue(null)
    render(<AttendeesModal eventId="e1" onOpenUser={() => {}} onClose={() => {}} />)
    expect(await screen.findByText(/Couldn't load the list/)).toBeInTheDocument()
  })

  it('closes on the backdrop and the × button, but not on the card', async () => {
    getEventAttendees.mockResolvedValue([])
    const onClose = vi.fn()
    render(<AttendeesModal eventId="e1" onOpenUser={() => {}} onClose={onClose} />)
    fireEvent.click(await screen.findByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Close'))
    fireEvent.click(screen.getByTestId('attendees-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
