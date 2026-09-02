import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlaceSearchInput from './PlaceSearchInput'
import type { PlaceResult } from '../lib/placeSearch'
import type { EventHit } from '../lib/searchResults'
import '../lib/i18n'

const searchPlaces = vi.fn<() => Promise<PlaceResult[]>>()
vi.mock('../lib/placeSearch', async (orig) => {
  const actual = await orig<typeof import('../lib/placeSearch')>()
  return { ...actual, searchPlaces: () => searchPlaces() }
})

const rzeszow: PlaceResult = { id: 'p1', primary: 'Rzeszów', secondary: 'Podkarpackie, Polska', lat: 50.04, lng: 22.0 }
const fest: EventHit = {
  id: 'e1', title: 'Festiwal Światła', category: 'festival', place_name: 'Jarosław',
  start_time: '2026-09-10T18:00:00Z', lat: 50.0, lng: 22.7,
}

beforeEach(() => {
  searchPlaces.mockReset()
  searchPlaces.mockResolvedValue([rzeszow])
})

function type(text: string) {
  const input = screen.getByRole('textbox')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: text } })
}

describe('PlaceSearchInput with events', () => {
  it('lists places first and then matching events with their place', async () => {
    render(
      <PlaceSearchInput placeholder="Szukaj" near={null} onSelect={() => {}}
        searchEvents={async () => [fest]} onSelectEvent={() => {}} />,
    )
    type('fe')
    await waitFor(() => expect(screen.getByText('Festiwal Światła')).toBeInTheDocument())
    expect(screen.getByText('Rzeszów')).toBeInTheDocument()
    expect(screen.getByText(/Jarosław/)).toBeInTheDocument()
    // miejsce wyżej niż wydarzenie
    const place = screen.getByText('Rzeszów')
    const event = screen.getByText('Festiwal Światła')
    expect(place.compareDocumentPosition(event) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('hands the picked event to onSelectEvent and closes the list', async () => {
    const onSelect = vi.fn()
    const onSelectEvent = vi.fn()
    render(
      <PlaceSearchInput placeholder="Szukaj" near={null} onSelect={onSelect}
        searchEvents={async () => [fest]} onSelectEvent={onSelectEvent} />,
    )
    type('fe')
    await waitFor(() => expect(screen.getByText('Festiwal Światła')).toBeInTheDocument())
    fireEvent.mouseDown(screen.getByText('Festiwal Światła'))
    expect(onSelectEvent).toHaveBeenCalledWith(fest)
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.queryByText('Festiwal Światła')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('Festiwal Światła')
  })

  it('shows only places when no event search is wired in', async () => {
    render(<PlaceSearchInput placeholder="Szukaj" near={null} onSelect={() => {}} />)
    type('rz')
    await waitFor(() => expect(screen.getByText('Rzeszów')).toBeInTheDocument())
    expect(screen.queryByText('Festiwal Światła')).not.toBeInTheDocument()
  })

  it('still shows places when the event search fails', async () => {
    render(
      <PlaceSearchInput placeholder="Szukaj" near={null} onSelect={() => {}}
        searchEvents={async () => { throw new Error('down') }} onSelectEvent={() => {}} />,
    )
    type('rz')
    await waitFor(() => expect(screen.getByText('Rzeszów')).toBeInTheDocument())
  })
})
