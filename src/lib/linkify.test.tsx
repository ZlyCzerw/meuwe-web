import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { linkify } from './linkify'

describe('linkify', () => {
  it('renders an address as a link that leaves the app', () => {
    render(<>{linkify('Bilety na https://teatr.pl/bilety juz sa')}</>)
    const link = screen.getByRole('link', { name: 'https://teatr.pl/bilety' })
    expect(link).toHaveAttribute('href', 'https://teatr.pl/bilety')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('sends a schemeless address to https', () => {
    render(<>{linkify('Szczegoly: www.teatr.pl')}</>)
    expect(screen.getByRole('link', { name: 'www.teatr.pl' }))
      .toHaveAttribute('href', 'https://www.teatr.pl')
  })

  it('leaves the text around the address untouched', () => {
    const { container } = render(<>{linkify('Bilety na https://teatr.pl juz sa')}</>)
    expect(container.textContent).toBe('Bilety na https://teatr.pl juz sa')
  })

  it('renders text without addresses as plain text', () => {
    const { container } = render(<>{linkify('Koncert w parku, wstep wolny')}</>)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toBe('Koncert w parku, wstep wolny')
  })

  it('renders every address in the paragraph', () => {
    render(<>{linkify('Strona https://teatr.pl, bilety https://bilety.pl')}</>)
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
