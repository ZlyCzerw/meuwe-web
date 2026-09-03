import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Avatar from './Avatar'

describe('Avatar', () => {
  it('renders a button and calls the handler on click when onClick is given', () => {
    const onClick = vi.fn()
    render(<Avatar initials="K" onClick={onClick} />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders no button and still shows the initials when onClick is absent', () => {
    render(<Avatar initials="K" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('K')).toBeInTheDocument()
  })
})
