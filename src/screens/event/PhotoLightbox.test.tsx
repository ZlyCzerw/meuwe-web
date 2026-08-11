import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhotoLightbox from './PhotoLightbox'
import '../../lib/i18n'

describe('PhotoLightbox', () => {
  it('shows every photo so the viewer can swipe on', () => {
    render(<PhotoLightbox photos={['a.jpg', 'b.jpg']} index={0} onClose={() => {}} />)
    expect(screen.getAllByTestId('lightbox-slide')).toHaveLength(2)
  })

  // Zgłoszona usterka: przycisk siedział pod paskiem systemowym i nie dało się
  // go kliknąć. Odsunięcie liczymy od bezpiecznego obszaru, więc test pilnuje
  // wzorca, nie konkretnej liczby. Surowy atrybut, bo jsdom nie zachowuje
  // calc() po rozłożeniu na `style.top`.
  it('keeps the close button clear of the status bar', () => {
    render(<PhotoLightbox photos={['a.jpg']} index={0} onClose={() => {}} />)
    const style = screen.getByTestId('lightbox-close').getAttribute('style') ?? ''
    expect(style).toContain('safe-area-inset-top')
  })

  it('reports a close', () => {
    const onClose = vi.fn()
    render(<PhotoLightbox photos={['a.jpg']} index={0} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('lightbox-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a tap outside the photo', () => {
    const onClose = vi.fn()
    render(<PhotoLightbox photos={['a.jpg']} index={0} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('lightbox-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // Kliknięcie w samo zdjęcie ma je zostawić otwarte — inaczej nie da się go
  // obejrzeć bez zamykania podglądu.
  it('does not close when the photo itself is tapped', () => {
    const onClose = vi.fn()
    render(<PhotoLightbox photos={['a.jpg']} index={0} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('lightbox-slide'))
    expect(onClose).not.toHaveBeenCalled()
  })

  // Kliknięcie strzałki "dalej" ma nawigować, a nie zamykać podgląd — strzałki
  // siedzą wewnątrz backdropu, więc bez stopPropagation kliknięcie
  // "przeciekałoby" do onClose i zamykałoby widok zamiast przejść dalej.
  it('does not close when an arrow is tapped', () => {
    const onClose = vi.fn()
    render(<PhotoLightbox photos={['a.jpg', 'b.jpg']} index={0} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Next photo'))
    expect(onClose).not.toHaveBeenCalled()
  })

  // jsdom nie liczy layoutu: clientWidth jest zawsze 0, więc jedyny sposób,
  // żeby udowodnić, że stan startowy honoruje `index`, to sprawdzić stronę
  // strzałki "wstecz" — przy index=2 (ostatnie zdjęcie z trzech) powinna być
  // aktywna, a nie wyszarzona jak przy indeksie 0.
  it('opens on the photo that was tapped', () => {
    render(<PhotoLightbox photos={['a.jpg', 'b.jpg', 'c.jpg']} index={2} onClose={() => {}} />)
    const prevButton = screen.getByLabelText('Previous photo')
    expect(prevButton.getAttribute('style')).not.toContain('opacity: 0.3')
  })
})
