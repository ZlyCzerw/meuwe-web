import { describe, it, expect } from 'vitest'
import { pickLang, NOTIF_TEXT, groupSubsByLang, interestBody, type Lang } from './notif-i18n'

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
  it('knows Slovenian', () => {
    expect(pickLang('sl-SI')).toBe('sl')
  })
})

describe('NOTIF_TEXT', () => {
  it('has all five languages for new_event title', () => {
    expect(NOTIF_TEXT.new_event.title).toEqual({
      pl: 'Nowe wydarzenie w pobliżu',
      en: 'New event nearby',
      es: 'Nuevo evento cerca de ti',
      de: 'Neues Event in der Nähe',
      sl: 'Nov dogodek v bližini',
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

describe('interestBody', () => {
  // Polski ma trzy formy: 1, 2-4 i reszta, z wyjątkiem nastek.
  it('inflects Polish through all three plural forms', () => {
    expect(interestBody(1, 'pl')).toBe('1 osoba chce wziąć udział')
    expect(interestBody(3, 'pl')).toBe('3 osoby chcą wziąć udział')
    expect(interestBody(7, 'pl')).toBe('7 osób chce wziąć udział')
    expect(interestBody(22, 'pl')).toBe('22 osoby chcą wziąć udział')
    expect(interestBody(13, 'pl')).toBe('13 osób chce wziąć udział')
  })

  // Słoweński ma liczbę podwójną.
  it('uses the Slovene dual', () => {
    expect(interestBody(1, 'sl')).toBe('1 oseba se odpravlja')
    expect(interestBody(2, 'sl')).toBe('2 osebi se odpravljata')
    expect(interestBody(3, 'sl')).toBe('3 osebe se odpravljajo')
    expect(interestBody(9, 'sl')).toBe('9 oseb se odpravlja')
  })

  it('keeps the simple languages simple', () => {
    expect(interestBody(1, 'en')).toBe('1 person is coming')
    expect(interestBody(4, 'en')).toBe('4 people are coming')
    expect(interestBody(1, 'de')).toBe('1 Person kommt')
    expect(interestBody(4, 'de')).toBe('4 Personen kommen')
    expect(interestBody(1, 'es')).toBe('1 persona va a asistir')
    expect(interestBody(4, 'es')).toBe('4 personas van a asistir')
  })

  it('has a title for the new type in every language', () => {
    for (const lang of ['pl', 'en', 'es', 'de', 'sl'] as const) {
      expect(NOTIF_TEXT.interest.title![lang].length).toBeGreaterThan(0)
    }
  })
})
