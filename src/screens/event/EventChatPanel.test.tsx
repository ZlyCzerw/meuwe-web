import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EventChatPanel from './EventChatPanel'
import '../../lib/i18n'
import type { Message } from '../../lib/types'

const msg = (id: string, text: string, author: string | null): Message => ({
  id, event_id: 'e1', author_id: author, author_name: 'Ala',
  author_color: '#fff', text, created_at: '2026-08-11T10:00:00Z',
})

const base = {
  messages: [] as Message[],
  meId: 'me',
  loc: 'pl-PL',
  deletedLabels: { deleted: 'Usunięty', unknown: '?' },
  title: 'Koncert w parku',
  onBack: () => {},
  input: '',
  onInputChange: () => {},
  onSend: () => {},
  sendErr: '',
  canWrite: true,
}

describe('EventChatPanel', () => {
  // Pasek nad czatem istnieje po to, żeby nie dało się zgubić, w którym
  // wydarzeniu się jest.
  it('names the event above the conversation', () => {
    render(<EventChatPanel {...base} />)
    expect(screen.getByTestId('chat-header')).toHaveTextContent('Koncert w parku')
  })

  it('reports a request to go back', () => {
    const onBack = vi.fn()
    render(<EventChatPanel {...base} onBack={onBack} />)
    fireEvent.click(screen.getByTestId('chat-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders every message', () => {
    render(<EventChatPanel {...base} messages={[msg('1', 'Cześć', 'a'), msg('2', 'Idę', 'me')]} />)
    expect(screen.getByText('Cześć')).toBeInTheDocument()
    expect(screen.getByText('Idę')).toBeInTheDocument()
  })

  it('sends on Enter', () => {
    const onSend = vi.fn()
    render(<EventChatPanel {...base} input="jestem" onSend={onSend} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  // Gość może czytać, ale nie pisać — pole ma to pokazywać, a nie udawać.
  it('locks the field for a guest', () => {
    render(<EventChatPanel {...base} canWrite={false} />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('surfaces a send error', () => {
    render(<EventChatPanel {...base} sendErr="Nie udało się wysłać" />)
    expect(screen.getByText('Nie udało się wysłać')).toBeInTheDocument()
  })
})
