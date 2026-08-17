import { describe, it, expect } from 'vitest'
import pl from './pl'
import en from './en'
import es from './es'
import de from './de'
import sl from './sl'

const NEW_EVENT_KEYS = [
  'attend', 'attending', 'readMore', 'readLess',
  'backToEvent', 'photoPrev', 'photoNext', 'sendMessage',
  'chainPrev', 'chainNext',
] as const

const LOCALES = { pl, en, es, de, sl }

describe('locale parity', () => {
  // Brakujący klucz nie wywraca aplikacji — pokazuje użytkownikowi surowy
  // identyfikator, więc bez testu wyciek zauważy dopiero ktoś na produkcji.
  it.each(Object.entries(LOCALES))('%s carries every new event key', (_name, dict) => {
    const event = (dict as { event: Record<string, unknown> }).event
    for (const key of NEW_EVENT_KEYS) {
      expect(typeof event[key]).toBe('string')
      expect(event[key]).not.toBe('')
    }
  })
})
