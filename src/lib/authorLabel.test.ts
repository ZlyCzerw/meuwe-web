import { describe, it, expect } from 'vitest'
import { authorLabel, authorInitial } from './authorLabel'

const L = { deleted: 'Konto usunięte', unknown: '?' }

describe('authorLabel', () => {
  it('names the author when there is a name', () => {
    expect(authorLabel('u1', 'Ala', L)).toBe('Ala')
  })

  it('calls it deleted only when there is no owner left', () => {
    expect(authorLabel(null, null, L)).toBe('Konto usunięte')
    // Anonymised rows keep no name either way, but a leftover name must not
    // resurrect a deleted account.
    expect(authorLabel(null, 'Ala', L)).toBe('Konto usunięte')
  })

  it('does not call a live but nameless account deleted', () => {
    // The regression: a fresh sign-in whose provider gave us no display name
    // was shown their own event as posted by a deleted account.
    expect(authorLabel('u2', null, L)).toBe('?')
    expect(authorLabel('u2', '', L)).toBe('?')
    expect(authorLabel('u2', '   ', L)).toBe('?')
  })
})

describe('authorInitial', () => {
  it('takes the first letter of the name', () => {
    expect(authorInitial('u1', 'ala', L)).toBe('A')
  })

  it('follows the same rules, so a nameless user is not a K for "Konto"', () => {
    expect(authorInitial('u2', null, L)).toBe('?')
    expect(authorInitial(null, null, L)).toBe('K')
  })
})
