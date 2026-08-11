import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TagChip from './TagChip'
import '../lib/i18n'

// Czytamy surowy atrybut, a nie `style.border` — jsdom bywa wybiórczy przy
// rozkładaniu skrótów CSS i potrafi oddać pusty łańcuch.
describe('TagChip', () => {
  it('stays borderless by default', () => {
    render(<TagChip category="music" />)
    expect(screen.getByRole('button').getAttribute('style')).toContain('transparent')
  })

  // Na zdjęciu chip musi mieć własną krawędź, bo tło jest nieprzewidywalne.
  it('draws an ink outline when asked', () => {
    render(<TagChip category="music" outlined />)
    const style = screen.getByRole('button').getAttribute('style') ?? ''
    expect(style).toContain('2px solid')
    expect(style).not.toContain('transparent')
  })
})
