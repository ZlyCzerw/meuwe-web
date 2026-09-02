import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventPhotoStrip from './EventPhotoStrip'
import '../../lib/i18n'

const base = {
  photos: null,
  category: 'culture' as const,
  tags: [] as string[],
  followers: [] as { avatar_color: string | null; display_name: string | null }[],
  followersLabel: '',
  onClose: () => {},
  onOpenPhoto: () => {},
}

// Slajdy szukamy po test id, nie po roli "img": zdjęcia mają alt="", więc są
// dekoracyjne i w ogóle nie wchodzą do drzewa dostępności.
describe('EventPhotoStrip', () => {
  // Bez zdjęcia kadr musi zostać, inaczej cały układ karty skacze o 200 px.
  it('keeps the frame when the event has no photo', () => {
    render(<EventPhotoStrip {...base} />)
    expect(screen.queryAllByTestId('photo-slide')).toHaveLength(0)
    expect(screen.getByTestId('photo-frame')).toBeInTheDocument()
  })

  it('renders one slide per photo', () => {
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg', 'c.jpg']} />)
    expect(screen.getAllByTestId('photo-slide')).toHaveLength(3)
  })

  // Właściciel produktu chce komplet tagów, nie trzy i "+N".
  it('shows every tag, not a truncated set', () => {
    render(<EventPhotoStrip {...base} tags={['music', 'art', 'food', 'sport', 'tech']} />)
    expect(screen.getByTestId('tag-bar').querySelectorAll('button')).toHaveLength(5)
  })

  it('hides the followers bar when nobody follows', () => {
    render(<EventPhotoStrip {...base} />)
    expect(screen.queryByTestId('followers-bar')).not.toBeInTheDocument()
  })

  it('shows the followers bar with a count', () => {
    render(
      <EventPhotoStrip
        {...base}
        followers={[{ avatar_color: '#fff', display_name: 'Ala' }]}
        followersLabel="obserwuje to"
      />,
    )
    expect(screen.getByTestId('followers-bar')).toHaveTextContent('obserwuje to')
  })

  it('reports a request to close the card', () => {
    const onClose = vi.fn()
    render(<EventPhotoStrip {...base} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('close-card'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens the tapped photo full screen', () => {
    const onOpenPhoto = vi.fn()
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg']} onOpenPhoto={onOpenPhoto} />)
    fireEvent.click(screen.getAllByTestId('photo-slide')[1])
    expect(onOpenPhoto).toHaveBeenCalledWith(1)
  })

  // Jedno zdjęcie nie jest karuzelą — strzałki i kropki byłyby kłamstwem.
  it('hides the arrows for a single photo', () => {
    render(<EventPhotoStrip {...base} photos={['a.jpg']} />)
    expect(screen.queryByLabelText(/Następne zdjęcie|Next photo/)).not.toBeInTheDocument()
  })

  // Strzałka ma naprawdę przewijać, a nie tylko wyglądać na klikalną. O samo
  // przesunięcie nie pytamy: w jsdom clientWidth to 0, więc każdy offset wyszedłby
  // zerem i asercja na nim byłaby teatrem.
  it('scrolls when the next arrow is used', () => {
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo')
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg']} />)
    fireEvent.click(screen.getByLabelText('Next photo'))
    expect(scrollTo).toHaveBeenCalled()
    scrollTo.mockRestore()
  })

  // Na pierwszym zdjęciu nie ma dokąd się cofnąć — indeks musi zostać na 0, a nie
  // zejść poniżej. Wyblakła strzałka jest tu dowodem: przy idx -1 rozjaśniłaby się.
  it('does not run off the start of the list', () => {
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg']} />)
    fireEvent.click(screen.getByLabelText('Previous photo'))
    fireEvent.click(screen.getByLabelText('Previous photo'))
    expect(screen.getByLabelText('Previous photo')).toHaveStyle({ opacity: '0.4' })
  })

  // I to samo na drugim końcu: za ostatnim zdjęciem nie ma następnego.
  it('does not run off the end of the list', () => {
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg']} />)
    fireEvent.click(screen.getByLabelText('Next photo'))
    fireEvent.click(screen.getByLabelText('Next photo'))
    expect(screen.getByLabelText('Next photo')).toHaveStyle({ opacity: '0.4' })
  })

  // useCardDrag pyta scroller pod palcem o krawędź; bez znacznika gest po
  // zdjęciu traktowałby kartę jak zwykłą powierzchnię i przesuwał ją od razu.
  it('marks both horizontal scrollers for the card drag', () => {
    render(<EventPhotoStrip {...base} photos={['a.jpg', 'b.jpg']} tags={['music']} />)
    const slide = screen.getAllByTestId('photo-slide')[0]
    expect(slide.closest('[data-hscroll]')).not.toBeNull()
    expect(screen.getByTestId('tag-bar')).toHaveAttribute('data-hscroll')
    expect(screen.getByTestId('photo-frame')).not.toHaveAttribute('data-no-hswipe')
  })
})
