import { describe, it, expect } from 'vitest'
import { truncateDescription, DESCRIPTION_PREVIEW_CHARS } from './text'

describe('truncateDescription', () => {
  it('leaves a short description alone', () => {
    const { preview, truncated } = truncateDescription('Kameralny koncert w parku.')
    expect(preview).toBe('Kameralny koncert w parku.')
    expect(truncated).toBe(false)
  })

  it('treats a missing description as empty, not as an error', () => {
    expect(truncateDescription(null)).toEqual({ preview: '', truncated: false })
    expect(truncateDescription(undefined)).toEqual({ preview: '', truncated: false })
  })

  // Granica jest po to, żeby karta się nie rozjechała — podgląd nie może jej
  // przekroczyć nawet o znak.
  it('never returns more than the limit', () => {
    const long = 'słowo '.repeat(200)
    const { preview, truncated } = truncateDescription(long)
    expect(truncated).toBe(true)
    expect(preview.length).toBeLessThanOrEqual(DESCRIPTION_PREVIEW_CHARS)
  })

  // Ucięcie w połowie wyrazu wygląda jak błąd aplikacji, nie jak skrót.
  // Granica wypada w środku "dlugiewyrazy", więc podgląd musi cofnąć się do spacji.
  it('cuts on a word boundary', () => {
    expect(truncateDescription('alfa beta dlugiewyrazy', 14).preview).toBe('alfa beta')
  })

  // Dokładnie na progu 40% cofnięcie jeszcze przysługuje — inaczej reguła
  // z komentarza i kod rozjeżdżają się o jeden indeks.
  it('still backs up when the cut costs exactly the allowed share', () => {
    expect(truncateDescription(`abcdef ${'x'.repeat(20)}`, 10).preview).toBe('abcdef')
  })

  // Za drogie cofnięcie oddaje więcej niż wolno, więc tniemy twardo.
  it('hard-cuts when the only boundary is too far back', () => {
    expect(truncateDescription(`ab ${'x'.repeat(20)}`, 10).preview).toBe('ab xxxxxxx')
  })

  // Jedyny przypadek, w którym trimEnd naprawdę coś robi.
  it('leaves no trailing space after backing up', () => {
    expect(truncateDescription(`alfa  ${'x'.repeat(20)}`, 8).preview).toBe('alfa')
  })

  // Jeden bardzo długi ciąg bez spacji (link, sklejka) nie ma granicy słowa —
  // wtedy twarde cięcie jest jedynym wyjściem i nie wolno mu oddać pustki.
  it('hard-cuts a run with no spaces', () => {
    const { preview, truncated } = truncateDescription('x'.repeat(500))
    expect(truncated).toBe(true)
    expect(preview.length).toBe(DESCRIPTION_PREVIEW_CHARS)
  })

  it('trims surrounding whitespace', () => {
    expect(truncateDescription('   Piknik   ').preview).toBe('Piknik')
  })
})
