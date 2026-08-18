import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingFooter } from './LandingFooter'
import '../../../lib/i18n'

// Strona idzie H1 → H2 → H4, więc czytnik ekranu melduje poziom, którego nie ma.
describe('LandingFooter', () => {
  it('titles its columns at heading level 3', () => {
    render(<MemoryRouter><LandingFooter /></MemoryRouter>)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(screen.queryAllByRole('heading', { level: 4 })).toHaveLength(0)
  })
})
