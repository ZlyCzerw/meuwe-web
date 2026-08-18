import { describe, it, expect, beforeEach } from 'vitest'
import { detectInitialLang, langFromPath } from './i18n'

describe('langFromPath', () => {
  it.each([
    ['/pl', 'pl'], ['/de', 'de'], ['/es', 'es'], ['/sl', 'sl'],
    ['/pl/', 'pl'], ['/DE', 'de'],
  ])('reads %s as %s', (path, lang) => {
    expect(langFromPath(path)).toBe(lang)
  })
  it.each(['/', '/blog', '/terms.html', '/plants', ''])('ignores %s', path => {
    expect(langFromPath(path)).toBeNull()
  })
})

describe('detectInitialLang', () => {
  beforeEach(() => localStorage.clear())
  it('uses saved override', () => {
    localStorage.setItem('meuwe_lang','es')
    expect(detectInitialLang('pl-PL')).toBe('es')
  })
  // Bot nie ma localStorage — dla niego o języku strony decyduje wyłącznie adres.
  it('uses the URL prefix when nothing is saved', () => {
    expect(detectInitialLang('en-US','/de')).toBe('de')
  })
  it('lets a saved choice beat the URL prefix', () => {
    localStorage.setItem('meuwe_lang','pl')
    expect(detectInitialLang('en-US','/de')).toBe('pl')
  })
  it('falls back to the navigator language outside a prefixed path', () => {
    expect(detectInitialLang('de-DE','/blog')).toBe('de')
  })
  it('falls back to navigator language pl', () => {
    expect(detectInitialLang('pl-PL')).toBe('pl')
  })
  it('falls back to es', () => {
    expect(detectInitialLang('es-MX')).toBe('es')
  })
  it('falls back to sl', () => {
    expect(detectInitialLang('sl-SI')).toBe('sl')
  })
  it('defaults to en', () => {
    expect(detectInitialLang('fr-FR')).toBe('en')
  })
})
