import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OrganizerRow from './OrganizerRow'
import '../../lib/i18n'
import i18n from 'i18next'

describe('OrganizerRow', () => {
  it('opens the creator profile from the name and from the avatar', () => {
    i18n.changeLanguage('en')
    const onOpen = vi.fn()
    render(<OrganizerRow creatorId="u2" name="Kasia" color="#4FC3F7" isModerator={false} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open profile: Kasia' }))
    fireEvent.click(screen.getByText('K'))
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onOpen).toHaveBeenCalledWith('u2')
  })

  // Konto usunięte: nie ma profilu do otwarcia, więc nie ma czego udawać.
  it('is plain text when the account is gone', () => {
    i18n.changeLanguage('en')
    render(<OrganizerRow creatorId={null} name={null} color={null} isModerator={false} onOpen={() => {}} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Deleted account')).toBeInTheDocument()
  })

  // EventSheet przekazuje onOpenUser wprost - bez niego (np. miejsce montowania
  // bez obsługi karty użytkownika) wiersz nie udaje przycisku.
  it('is plain text without an onOpen handler even for a live creator', () => {
    i18n.changeLanguage('en')
    render(<OrganizerRow creatorId="u2" name="Kasia" color="#4FC3F7" isModerator={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Kasia')).toBeInTheDocument()
  })

  it('marks the moderator', () => {
    i18n.changeLanguage('en')
    render(<OrganizerRow creatorId="me" name="Ja" color={null} isModerator onOpen={() => {}} />)
    expect(screen.getByText('Moderator')).toBeInTheDocument()
  })
})
