import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ViewStatsRow from './ViewStatsRow'
import '../../lib/i18n'
import i18n from 'i18next'

describe('ViewStatsRow', () => {
  it('shows total opens and how many signed-in people opened the card', () => {
    i18n.changeLanguage('en')
    render(<ViewStatsRow views={7} viewers={3} />)
    expect(screen.getByText('7 views · 3 people')).toBeInTheDocument()
  })

  it('uses singular forms for one', () => {
    i18n.changeLanguage('en')
    render(<ViewStatsRow views={1} viewers={1} />)
    expect(screen.getByText('1 view · 1 person')).toBeInTheDocument()
  })

  // Twórca widzi wiersz od razu po utworzeniu - zero to też informacja.
  it('renders zero instead of hiding', () => {
    i18n.changeLanguage('en')
    render(<ViewStatsRow views={0} viewers={0} />)
    expect(screen.getByText('0 views · 0 people')).toBeInTheDocument()
  })
})
