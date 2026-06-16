import { describe, it, expect } from 'vitest'
import { toSlug, buildEventPath, extractEventId } from './slug'

describe('toSlug', () => {
  it('zamienia polskie litery', () => {
    expect(toSlug('Piknik o zachodzie słońca')).toBe('piknik-o-zachodzie-slonca')
  })
  it('zamienia ł', () => {
    expect(toSlug('Park Łazienkowski')).toBe('park-lazienkowski')
  })
  it('zamienia ę ą ó ś ź ż ć ń', () => {
    expect(toSlug('żółć')).toBe('zolc')
  })
  it('zamienia ü ö ä ß (DE)', () => {
    expect(toSlug('Über Straße')).toBe('uber-strasse')
  })
  it('zamienia á é í ú (ES)', () => {
    expect(toSlug('Música callejera')).toBe('musica-callejera')
  })
  it('usuwa wielokrotne myślniki', () => {
    expect(toSlug('foo   bar')).toBe('foo-bar')
  })
  it('usuwa myślniki z początku i końca', () => {
    expect(toSlug('  hello  ')).toBe('hello')
  })
  it('puste/białe znaki → pusty string', () => {
    expect(toSlug('')).toBe('')
    expect(toSlug('   ')).toBe('')
  })
  it('cyfry i myślniki zostawia', () => {
    expect(toSlug('Event 2026')).toBe('event-2026')
  })
})

describe('buildEventPath', () => {
  const id = '1cbc7843-e93d-4779-ad8e-32d2f114d6cd'

  it('buduje ścieżkę z tytułem i miejscem', () => {
    expect(buildEventPath({ id, title: 'Piknik', place_name: 'Park Jordana' }))
      .toBe('/e/piknik--park-jordana--1cbc7843-e93d-4779-ad8e-32d2f114d6cd')
  })
  it('buduje ścieżkę bez miejsca gdy place_name null', () => {
    expect(buildEventPath({ id, title: 'Piknik', place_name: null }))
      .toBe('/e/piknik--1cbc7843-e93d-4779-ad8e-32d2f114d6cd')
  })
  it('buduje ścieżkę bez miejsca gdy place_name pusty string', () => {
    expect(buildEventPath({ id, title: 'Piknik', place_name: '' }))
      .toBe('/e/piknik--1cbc7843-e93d-4779-ad8e-32d2f114d6cd')
  })
  it('gdy tytuł-slug pusty, używa samego id', () => {
    expect(buildEventPath({ id, title: '!!!', place_name: null }))
      .toBe('/e/1cbc7843-e93d-4779-ad8e-32d2f114d6cd')
  })
  it('polskie znaki w tytule i miejscu', () => {
    expect(buildEventPath({ id, title: 'Żółta łódź', place_name: 'Łódź Centrum' }))
      .toBe('/e/zolta-lodz--lodz-centrum--1cbc7843-e93d-4779-ad8e-32d2f114d6cd')
  })
})

describe('extractEventId', () => {
  const uuid = '1cbc7843-e93d-4779-ad8e-32d2f114d6cd'

  it('wyciąga UUID z nowego formatu /e/<slug>--<uuid>', () => {
    expect(extractEventId('/e/piknik--park-jordana--' + uuid)).toBe(uuid)
  })
  it('wyciąga UUID gdy brak slug (tylko uuid)', () => {
    expect(extractEventId('/e/' + uuid)).toBe(uuid)
  })
  it('zwraca null dla nieprawidłowej ścieżki', () => {
    expect(extractEventId('/e/brak-uuid')).toBeNull()
  })
  it('zwraca null dla pustego', () => {
    expect(extractEventId('')).toBeNull()
  })
  it('zwraca null dla ścieżki bez /e/', () => {
    expect(extractEventId('/inne/1cbc7843-e93d-4779-ad8e-32d2f114d6cd')).toBeNull()
  })
})
