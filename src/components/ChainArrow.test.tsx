import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChainArrow from './ChainArrow'

describe('ChainArrow', () => {
  it('is reachable by its label', () => {
    render(<ChainArrow dir="right" disabled={false} label="Następne wydarzenie obok" onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Następne wydarzenie obok' })).toBeInTheDocument()
  })

  it('reports a click', () => {
    const onClick = vi.fn()
    render(<ChainArrow dir="left" disabled={false} label="Poprzednie" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Poprzednie' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // Koniec sznurka wygasza daszek, ale go nie usuwa: znikający i wracający
  // przycisk przesuwałby wszystko dookoła.
  it('does not fire at the end of the chain', () => {
    const onClick = vi.fn()
    render(<ChainArrow dir="left" disabled label="Poprzednie" onClick={onClick} />)
    const btn = screen.getByRole('button', { name: 'Poprzednie' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
