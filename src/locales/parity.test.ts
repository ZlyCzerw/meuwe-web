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

const MAP_TIMELINE_KEYS = ['modeDay', 'modeRange', 'closeTimeline'] as const

const APP_UPDATE_KEYS = [
  'title', 'body', 'action', 'later', 'blockedTitle', 'blockedBody',
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

describe('landing headline', () => {
  // H1 był kopią welcome.tagline, więc ta sama treść stała na stronie dwa razy
  // i ani razu nie mówiła "mapa" ani "lokalne wydarzenia".
  it.each(Object.entries(LOCALES))('%s defines landing.h1', (_name, dict) => {
    const landing = (dict as { landing: Record<string, unknown> }).landing
    expect(typeof landing.h1).toBe('string')
    expect(landing.h1).not.toBe('')
  })

  it.each(Object.entries(LOCALES))('%s does not reuse the tagline as h1', (_name, dict) => {
    const d = dict as { landing: Record<string, unknown>; welcome: Record<string, unknown> }
    expect(d.landing.h1).not.toBe(d.welcome.tagline)
  })
})

describe('timeline strip labels', () => {
  it.each(Object.entries(LOCALES))('%s names both modes and the close button', (_name, dict) => {
    const map = (dict as { map: Record<string, unknown> }).map
    for (const key of MAP_TIMELINE_KEYS) {
      expect(typeof map[key]).toBe('string')
      expect(map[key]).not.toBe('')
    }
  })
})

describe('update prompts', () => {
  // The blocking screen is the one text nobody can dismiss their way past, and
  // it reaches people precisely when the app is already failing them.
  it.each(Object.entries(LOCALES))('%s carries every update key', (_name, dict) => {
    const appUpdate = (dict as { appUpdate: Record<string, unknown> }).appUpdate
    for (const key of APP_UPDATE_KEYS) {
      expect(typeof appUpdate[key]).toBe('string')
      expect(appUpdate[key]).not.toBe('')
    }
  })
})
