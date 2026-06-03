import { describe, it, expect } from 'vitest'
import { pickLang, NOTIF_TEXT, groupSubsByLang, type Lang } from './notif-i18n'

describe('pickLang', () => {
  it('normalizes supported languages and strips region', () => {
    expect(pickLang('en')).toBe('en')
    expect(pickLang('es-ES')).toBe('es')
    expect(pickLang('DE')).toBe('de')
  })
  it('falls back to en for null/unknown', () => {
    expect(pickLang(null)).toBe('en')
    expect(pickLang('fr')).toBe('en')
    expect(pickLang(undefined)).toBe('en')
  })
})

describe('NOTIF_TEXT', () => {
  it('has all four languages for new_event title', () => {
    expect(NOTIF_TEXT.new_event.title).toEqual({
      pl: 'Nowe wydarzenie w pobliżu',
      en: 'New event nearby',
      es: 'Nuevo evento cerca de ti',
      de: 'Neues Event in der Nähe',
    })
  })
  it('has update body and message fallback name', () => {
    expect(NOTIF_TEXT.update.body!.de).toBe('Das Event wurde aktualisiert')
    expect(NOTIF_TEXT.message.body!.es).toBe('Alguien')
  })
})

describe('groupSubsByLang', () => {
  it('buckets subs by their user language, defaulting to en', () => {
    const langByUser = new Map<string, Lang>([['u1', 'es'], ['u2', 'de']])
    const subs = [
      { id: 's1', user_id: 'u1' },
      { id: 's2', user_id: 'u2' },
      { id: 's3', user_id: 'u3' }, // unknown → en
    ]
    const groups = groupSubsByLang(subs, langByUser)
    expect(groups.get('es')!.map(s => s.id)).toEqual(['s1'])
    expect(groups.get('de')!.map(s => s.id)).toEqual(['s2'])
    expect(groups.get('en')!.map(s => s.id)).toEqual(['s3'])
  })
})
