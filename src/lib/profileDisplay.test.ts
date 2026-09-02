import { describe, it, expect } from 'vitest'
import { shownName, initial, avatarColor } from './profileDisplay'

describe('shownName', () => {
  it('prefers name_shown, then display_name, then the email prefix', () => {
    expect(shownName({ name_shown: 'Ala', display_name: 'Kasia' }, 'x@y.z')).toBe('Ala')
    expect(shownName({ name_shown: null, display_name: 'Kasia' }, 'x@y.z')).toBe('Kasia')
    expect(shownName({ name_shown: null, display_name: null }, 'k7f3@privaterelay.appleid.com')).toBe('k7f3')
    expect(shownName(null, null)).toBe('')
  })
  it('treats a missing name_shown key like null', () => {
    expect(shownName({ display_name: 'Kasia' })).toBe('Kasia')
  })
})

describe('initial', () => {
  // Bug: MapScreen took display_name while the menu took name_shown, so a
  // renamed user saw two different letters in the same app.
  it('comes from the same name the menu shows', () => {
    expect(initial({ name_shown: 'ala', display_name: 'Kasia' })).toBe('A')
  })
  it('falls back to the email and then to ?', () => {
    expect(initial(null, 'zoe@x.y')).toBe('Z')
    expect(initial(null)).toBe('?')
    expect(initial({ name_shown: '', display_name: '' }, '')).toBe('?')
  })
})

describe('avatarColor', () => {
  it('uses the stored colour and the app default when none', () => {
    expect(avatarColor({ avatar_color: '#4FC3F7' })).toBe('#4FC3F7')
    expect(avatarColor({ avatar_color: null })).toBe('#FF7A45')
    expect(avatarColor(null)).toBe('#FF7A45')
  })
})
