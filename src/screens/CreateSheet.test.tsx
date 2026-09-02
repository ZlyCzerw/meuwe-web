import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreateSheet from './CreateSheet'
import '../lib/i18n'

// Granice, nie logika: baza i aparat są zaślepione, cały formularz działa
// naprawdę, więc te asercje mówią o tym, co widzi użytkownik.
const createEvent = vi.fn()
const eventZoneConflict = vi.fn()
vi.mock('../lib/supabase', () => ({
  db: {
    createEvent: (...a: unknown[]) => createEvent(...a),
    eventZoneConflict: (...a: unknown[]) => eventZoneConflict(...a),
    updateEvent: vi.fn(),
    uploadEventPhoto: vi.fn(),
  },
  supabase: {},
}))
vi.mock('@capacitor/camera', () => ({
  Camera: { getPhoto: vi.fn() },
  CameraResultType: { DataUrl: 'dataUrl' },
  CameraSource: { Camera: 'camera' },
}))

const POS = { lat: 50.04, lng: 22.0 }

function renderSheet(open = true) {
  const onSubmit = vi.fn()
  const view = render(
    <CreateSheet
      open={open}
      onClose={() => {}}
      onSubmit={onSubmit}
      defaultPos={POS}
      locationPicked={false}
      onPickLocation={() => {}}
    />,
  )
  const rerender = (nextOpen: boolean) => view.rerender(
    <CreateSheet
      open={nextOpen}
      onClose={() => {}}
      onSubmit={onSubmit}
      defaultPos={POS}
      locationPicked={false}
      onPickLocation={() => {}}
    />,
  )
  return { ...view, rerender, onSubmit }
}

const titleInput = () => screen.getByPlaceholderText('enter event name here') as HTMLInputElement
const startInput = () => screen.getByTestId('time-from') as HTMLInputElement
const expandTime = () => fireEvent.click(screen.getByText('Time'))

beforeEach(() => {
  vi.clearAllMocks()
  eventZoneConflict.mockResolvedValue(null)
  createEvent.mockResolvedValue({
    data: { id: 'e1', lat: POS.lat, lng: POS.lng, start_time: '2026-09-04T18:00:00.000Z' },
    error: null,
  })
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-09-02T10:00:00'))
})

afterEach(() => vi.useRealTimers())

describe('CreateSheet', () => {
  // Sedno zgłoszenia: kolejne tworzenie zaczyna od zera. Godziny wracały do
  // ostatnio wybranych, bo ścieżka sukcesu resetowała wszystko poza nimi.
  it('leaves nothing behind after a successful create', async () => {
    const { onSubmit } = renderSheet()
    fireEvent.change(titleInput(), { target: { value: 'Koncert' } })
    expandTime()
    fireEvent.change(startInput(), { target: { value: '2026-09-05T20:00' } })
    fireEvent.blur(startInput())
    expect(startInput().value).toBe('2026-09-05T20:00')

    fireEvent.click(screen.getByText('Add event'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())

    expect(titleInput().value).toBe('')
    expandTime()
    expect(startInput().value).toBe('2026-09-02T10:00')
  })

  // Karta jest zamontowana przez całe życie aplikacji, więc domyślne godziny
  // liczone przy montowaniu starzeją się razem z sesją.
  it('recomputes the default times when it opens again', () => {
    const { rerender } = renderSheet(false)
    vi.setSystemTime(new Date('2026-09-02T14:30'))
    rerender(true)
    expandTime()
    expect(startInput().value).toBe('2026-09-02T14:30')
  })

  // Wybór miejsca na mapie zamyka i otwiera kartę. To nie jest nowe tworzenie:
  // wpisany tytuł i ustawione godziny mają przetrwać.
  it('keeps a draft across the location-picker round trip', () => {
    const { rerender } = renderSheet()
    fireEvent.change(titleInput(), { target: { value: 'Koncert' } })
    expandTime()
    fireEvent.change(startInput(), { target: { value: '2026-09-05T20:00' } })
    fireEvent.blur(startInput())

    rerender(false)
    vi.setSystemTime(new Date('2026-09-02T11:00'))
    rerender(true)

    expect(titleInput().value).toBe('Koncert')
    expect(startInput().value).toBe('2026-09-05T20:00')
  })

  // Utworzony wiersz jest jedynym źródłem miejsca i dnia dla mapy — bez niego
  // App nie ma jak przestawić osi czasu na dzień wydarzenia.
  it('hands the created event to the caller', async () => {
    const { onSubmit } = renderSheet()
    fireEvent.change(titleInput(), { target: { value: 'Koncert' } })
    fireEvent.click(screen.getByText('Add event'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', lat: POS.lat, lng: POS.lng, start_time: '2026-09-04T18:00:00.000Z' }),
    ))
  })
})
