import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AttendanceAskModal from './AttendanceAskModal'
import '../lib/i18n'

describe('AttendanceAskModal', () => {
  it('names the event it is asking about', () => {
    render(<AttendanceAskModal title="Koncert w parku" onAnswer={() => {}} />)
    expect(screen.getByText(/Koncert w parku/)).toBeInTheDocument()
  })

  it('reports a yes', () => {
    const onAnswer = vi.fn()
    render(<AttendanceAskModal title="Koncert" onAnswer={onAnswer} />)
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }))
    expect(onAnswer).toHaveBeenCalledWith(true)
  })

  // "No" is an answer, not a dismissal — it closes the subject just as firmly,
  // so it has to reach the caller rather than quietly do nothing.
  it('reports a no', () => {
    const onAnswer = vi.fn()
    render(<AttendanceAskModal title="Koncert" onAnswer={onAnswer} />)
    fireEvent.click(screen.getByRole('button', { name: /^no$/i }))
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  // A double tap on a phone is one answer, not two rows in the table.
  it('takes one answer and then stops listening', () => {
    const onAnswer = vi.fn()
    render(<AttendanceAskModal title="Koncert" onAnswer={onAnswer} />)
    const yes = screen.getByRole('button', { name: /^yes$/i })
    fireEvent.click(yes)
    fireEvent.click(yes)
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})
