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
  it('cuts on a word boundary', () => {
    const long = 'alfa '.repeat(100)
    const { preview } = truncateDescription(long)
    expect(preview.endsWith('alfa')).toBe(true)
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
