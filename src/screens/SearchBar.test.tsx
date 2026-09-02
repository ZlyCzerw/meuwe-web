import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchBar from './SearchBar'
import type { EventHit } from '../lib/searchResults'
import '../lib/i18n'

const searchEvents = vi.fn<(q: string) => Promise<EventHit[]>>()
vi.mock('../lib/supabase', () => ({
  db: { searchEvents: (q: string) => searchEvents(q) },
  supabase: {},
}))
vi.mock('../lib/placeSearch', async (orig) => {
  const actual = await orig<typeof import('../lib/placeSearch')>()
  return { ...actual, searchPlaces: async () => [] }
})

function hit(id: string, lat: number, lng: number): EventHit {
  return { id, title: `Fest ${id}`, category: 'party', place_name: null, start_time: '2026-09-10T18:00:00Z', lat, lng }
}

function type(text: string) {
  const input = screen.getByRole('textbox')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: text } })
}

beforeEach(() => searchEvents.mockReset())

describe('SearchBar', () => {
  it('sends a cleaned query to the database', async () => {
    searchEvents.mockResolvedValue([])
    render(<SearchBar userPos={null} onSelect={() => {}} onSelectEvent={() => {}} />)
    type('fe%st,')
    await waitFor(() => expect(searchEvents).toHaveBeenCalledWith('fest'))
  })

  it('does not ask the database when nothing is left after cleaning', async () => {
    render(<SearchBar userPos={null} onSelect={() => {}} onSelectEvent={() => {}} />)
    type('%%')
    await new Promise(r => setTimeout(r, 20))
    expect(searchEvents).not.toHaveBeenCalled()
  })

  it('lists events nearest the user first and hands the picked one up', async () => {
    searchEvents.mockResolvedValue([hit('far', 52, 22), hit('near', 50.1, 22)])
    const onSelectEvent = vi.fn()
    render(<SearchBar userPos={{ lat: 50, lng: 22 }} onSelect={() => {}} onSelectEvent={onSelectEvent} />)
    type('fest')
    await waitFor(() => expect(screen.getByText('Fest near')).toBeInTheDocument())
    const near = screen.getByText('Fest near')
    const far = screen.getByText('Fest far')
    expect(near.compareDocumentPosition(far) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.mouseDown(near)
    expect(onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'near' }))
  })

  it('searches places only when no event handler is given', async () => {
    render(<SearchBar userPos={null} onSelect={() => {}} />)
    type('fest')
    await new Promise(r => setTimeout(r, 20))
    expect(searchEvents).not.toHaveBeenCalled()
  })
})
