import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProblemSection } from './ProblemSection'
import i18n from '../../../lib/i18n'

// Chipy powtarzają kategorie, którymi aplikacja już się posługuje. Gdy ktoś
// wpisze je z palca, niemiecki odwiedzający czyta polskie słowa pod niemieckim
// nagłówkiem — dokładnie to naprawiamy, więc test pilnuje języka, nie treści.
afterEach(() => { i18n.changeLanguage('en') })

describe('ProblemSection chips', () => {
  it('label themselves in the active language', async () => {
    await i18n.changeLanguage('de')
    render(<ProblemSection />)
    expect(screen.getByText('Party')).toBeInTheDocument()
    expect(screen.getByText('Musik')).toBeInTheDocument()
    expect(screen.getByText('Familie')).toBeInTheDocument()
  })

  it('leave no Polish literal behind in German', async () => {
    await i18n.changeLanguage('de')
    render(<ProblemSection />)
    expect(screen.queryByText('impreza')).toBeNull()
    expect(screen.queryByText('piknik')).toBeNull()
    expect(screen.queryByText('koncert')).toBeNull()
    expect(screen.queryByText('rodzinne')).toBeNull()
  })
})

describe('ProblemSection screenshot', () => {
  // Pliki map-sl.png, event-sl.png i new-sl.png leżą w repo od dawna — brakowało
  // wyłącznie klucza w tablicy, więc Słoweniec cicho dostawał angielski zrzut.
  it('uses the Slovenian screenshot in Slovenian', async () => {
    await i18n.changeLanguage('sl')
    const { container } = render(<ProblemSection />)
    const img = container.querySelector('img[src*="/screenshots/"]')
    expect(img?.getAttribute('src')).toBe('/screenshots/map-sl.png')
  })
})
