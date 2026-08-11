import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionRow, { ActionBtn } from './ActionRow'

describe('ActionRow', () => {
  it('reports a tap', () => {
    const onClick = vi.fn()
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Wezmę udział" ariaLabel="Wezmę udział" onClick={onClick} />
      </ActionRow>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Wezmę udział' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // Czytnik ekranu musi usłyszeć, że przycisk jest włączony — sam kolor blobu
  // niczego mu nie mówi.
  it('announces the active state of a toggle', () => {
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Biorę udział" ariaLabel="Biorę udział" active onClick={() => {}} />
      </ActionRow>,
    )
    expect(screen.getByRole('button', { name: 'Biorę udział' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('announces a toggle that is off', () => {
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Wezmę udział" ariaLabel="Wezmę udział" active={false} onClick={() => {}} />
      </ActionRow>,
    )
    expect(screen.getByRole('button', { name: 'Wezmę udział' })).toHaveAttribute('aria-pressed', 'false')
  })

  // Udostępnianie nie jest przełącznikiem. aria-pressed="false" powiedziałoby
  // czytnikowi, że to wyłączony przełącznik — a to nieprawda.
  it('leaves a plain action without a pressed state', () => {
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Udostępnij" ariaLabel="Udostępnij" onClick={() => {}} />
      </ActionRow>,
    )
    expect(screen.getByRole('button', { name: 'Udostępnij' })).not.toHaveAttribute('aria-pressed')
  })

  it('does not fire while disabled', () => {
    const onClick = vi.fn()
    render(
      <ActionRow>
        <ActionBtn icon={<i />} label="Kalendarz" ariaLabel="Kalendarz" disabled onClick={onClick} />
      </ActionRow>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kalendarz' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  // Przegrody rysuje sam pasek, więc wywołujący nie musi o nich pamiętać.
  it('separates the columns it is given', () => {
    const { container } = render(
      <ActionRow>
        <ActionBtn icon={<i />} label="A" ariaLabel="A" onClick={() => {}} />
        <ActionBtn icon={<i />} label="B" ariaLabel="B" onClick={() => {}} />
        <ActionBtn icon={<i />} label="C" ariaLabel="C" onClick={() => {}} />
      </ActionRow>,
    )
    expect(screen.getAllByRole('button')).toHaveLength(3)
    // Pasek to jeden div z przyciskami i kreskami jako bezpośrednimi dziećmi.
    // Sprawdzamy kolejność tagów, żeby dowieść, że kreski są tylko między
    // kolumnami — nie przed pierwszą ani po ostatniej.
    const row = container.firstElementChild!
    expect(Array.from(row.children).map((el) => el.tagName)).toEqual([
      'BUTTON', 'DIV', 'BUTTON', 'DIV', 'BUTTON',
    ])
  })
})
