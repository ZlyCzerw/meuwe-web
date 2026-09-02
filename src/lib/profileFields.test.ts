import { describe, it, expect } from 'vitest'
import {
  AVATAR_COLORS, DEFAULT_AVATAR_COLOR, BIO_MAX, LINK_URL_MAX, UNIVERSITY_MAX,
  BIRTH_YEAR_MIN, maxBirthYear, homeNameFromPlace, emptyProfileForm, validateProfileForm,
} from './profileFields'

const NOW = new Date('2026-09-02T12:00:00Z')

describe('avatar palette', () => {
  it('has eight distinct colours and the default is the first of them', () => {
    expect(AVATAR_COLORS).toHaveLength(8)
    expect(new Set(AVATAR_COLORS).size).toBe(8)
    expect(AVATAR_COLORS[0]).toBe(DEFAULT_AVATAR_COLOR)
  })
  it('default matches what handle_new_user writes', () => {
    expect(DEFAULT_AVATAR_COLOR).toBe('#FF7A45')
  })
})

describe('maxBirthYear', () => {
  it('is sixteen years before now, the age floor from the terms', () => {
    expect(maxBirthYear(NOW)).toBe(2010)
  })
})

describe('homeNameFromPlace', () => {
  it('joins primary and secondary with a comma', () => {
    expect(homeNameFromPlace({ primary: 'Puerto de la Cruz', secondary: 'Santa Cruz de Tenerife, España' }))
      .toBe('Puerto de la Cruz, Santa Cruz de Tenerife, España')
  })
  it('drops an empty secondary', () => {
    expect(homeNameFromPlace({ primary: 'Rzeszów', secondary: '' })).toBe('Rzeszów')
  })
  it('never exceeds the column limit', () => {
    const long = homeNameFromPlace({ primary: 'x'.repeat(70), secondary: 'y'.repeat(70) })
    expect(long.length).toBe(80)
  })
})

describe('validateProfileForm', () => {
  it('turns an untouched form into all nulls', () => {
    const res = validateProfileForm(emptyProfileForm(), NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({
      bio: null, home: null, creatorKind: null, linkUrl: null,
      birthYear: null, gender: null, residenceStatus: null, occupation: null,
      university: null, fieldOfStudy: null, foundVia: null,
    })
  })

  it('trims and collapses whitespace, and empties become null', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), bio: '  robię   koncerty \n w piwnicy ', linkUrl: '   ' }, NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.bio).toBe('robię koncerty w piwnicy')
    expect(res.value.linkUrl).toBeNull()
  })

  it('rejects a bio over the limit', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), bio: 'a'.repeat(BIO_MAX + 1) }, NOW)
    expect(res).toEqual({ ok: false, errors: [{ field: 'bio', reason: 'tooLong' }] })
  })

  it('adds https:// to a bare host and keeps an explicit scheme', () => {
    const bare = validateProfileForm({ ...emptyProfileForm(), linkUrl: 'instagram.com/klub' }, NOW)
    expect(bare.ok && bare.value.linkUrl).toBe('https://instagram.com/klub')
    const http = validateProfileForm({ ...emptyProfileForm(), linkUrl: 'http://meuwe.eu' }, NOW)
    expect(http.ok && http.value.linkUrl).toBe('http://meuwe.eu')
  })

  it('rejects a link that is not a web address', () => {
    for (const bad of ['tylko tekst', 'javascript:alert(1)', 'http://', 'https://nodot', 'mailto:someone@example.com', 'facebook.com@phishing-site.co', 'https://user:pw@example.com', 'ftp://example.com']) {
      const res = validateProfileForm({ ...emptyProfileForm(), linkUrl: bad }, NOW)
      expect(res).toEqual({ ok: false, errors: [{ field: 'linkUrl', reason: 'invalidUrl' }] })
    }
  })

  it('rejects a link over the limit even when it parses', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), linkUrl: 'https://a.pl/' + 'x'.repeat(LINK_URL_MAX) }, NOW)
    expect(res).toEqual({ ok: false, errors: [{ field: 'linkUrl', reason: 'tooLong' }] })
  })

  it('parses a four-digit birth year within range and nulls an empty one', () => {
    const ok = validateProfileForm({ ...emptyProfileForm(), birthYear: ' 1998 ' }, NOW)
    expect(ok.ok && ok.value.birthYear).toBe(1998)
    const empty = validateProfileForm({ ...emptyProfileForm(), birthYear: '' }, NOW)
    expect(empty.ok && empty.value.birthYear).toBeNull()
  })

  it('rejects a birth year outside 1900..now-16 or not four digits', () => {
    for (const bad of ['1899', '2011', '98', 'abcd']) {
      const res = validateProfileForm({ ...emptyProfileForm(), birthYear: bad }, NOW)
      expect(res).toEqual({ ok: false, errors: [{ field: 'birthYear', reason: 'outOfRange' }] })
    }
    expect(BIRTH_YEAR_MIN).toBe(1900)
  })

  it('keeps university and field only for a student', () => {
    const student = validateProfileForm({ ...emptyProfileForm(), occupation: 'student', university: 'PRz', fieldOfStudy: 'Informatyka' }, NOW)
    expect(student.ok && student.value.university).toBe('PRz')
    expect(student.ok && student.value.fieldOfStudy).toBe('Informatyka')
    const working = validateProfileForm({ ...emptyProfileForm(), occupation: 'working', university: 'PRz', fieldOfStudy: 'Informatyka' }, NOW)
    expect(working.ok && working.value.university).toBeNull()
    expect(working.ok && working.value.fieldOfStudy).toBeNull()
  })

  it('rejects a university name over the limit', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), occupation: 'student', university: 'u'.repeat(UNIVERSITY_MAX + 1) }, NOW)
    expect(res).toEqual({ ok: false, errors: [{ field: 'university', reason: 'tooLong' }] })
  })

  it('passes chips and the home place through untouched', () => {
    const home = { name: 'Rzeszów, Podkarpackie, Polska', lat: 50.04, lng: 22.0 }
    const res = validateProfileForm({
      ...emptyProfileForm(), home, creatorKind: 'venue', gender: 'other',
      residenceStatus: 'newcomer', occupation: 'other', foundVia: 'poster',
    }, NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.home).toEqual(home)
    expect(res.value.creatorKind).toBe('venue')
    expect(res.value.gender).toBe('other')
    expect(res.value.residenceStatus).toBe('newcomer')
    expect(res.value.foundVia).toBe('poster')
  })

  it('reports every failing field at once', () => {
    const res = validateProfileForm({ ...emptyProfileForm(), bio: 'a'.repeat(BIO_MAX + 1), birthYear: '1' }, NOW)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.errors.map(e => e.field).sort()).toEqual(['bio', 'birthYear'])
  })
})
