import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingFooter } from './LandingFooter'
import i18n from 'i18next'
import '../../../lib/i18n'
import { onCookieSettings } from '../../../lib/consent'

// Strona idzie H1 → H2 → H4, więc czytnik ekranu melduje poziom, którego nie ma.
describe('LandingFooter', () => {
  it('titles its columns at heading level 3', () => {
    render(<MemoryRouter><LandingFooter /></MemoryRouter>)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0)
  })

  // Link „Cookies" prowadził do „#" — nie było jak zmienić decyzji po fakcie.
  it('reopens the cookie settings from the legal column', () => {
    const opened = vi.fn()
    const off = onCookieSettings(opened)
    render(<MemoryRouter><LandingFooter /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('landing.footer.cookies') }))
    expect(opened).toHaveBeenCalledTimes(1)
    off()
  })
})
