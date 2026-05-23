import { describe, it, expect, beforeEach } from 'vitest'
import { detectInitialLang } from './i18n'

describe('detectInitialLang', () => {
  beforeEach(() => localStorage.clear())
  it('uses saved override', () => {
    localStorage.setItem('meuwe_lang','es')
    expect(detectInitialLang('pl-PL')).toBe('es')
  })
  it('falls back to navigator language pl', () => {
    expect(detectInitialLang('pl-PL')).toBe('pl')
  })
  it('falls back to es', () => {
    expect(detectInitialLang('es-MX')).toBe('es')
  })
  it('defaults to en', () => {
    expect(detectInitialLang('fr-FR')).toBe('en')
  })
})
