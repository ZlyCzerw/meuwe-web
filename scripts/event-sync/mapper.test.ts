import { describe, it, expect } from 'vitest'
import { mapCategory } from './mapper.ts'

describe('mapCategory (Polish)', () => {
  it.each([
    [['Koncert'], 'music', ''],
    [[], 'music', 'Kaśka Sochacka — koncert jesienny'],
    [['Spektakl teatralny'], 'culture', ''],
    [[], 'culture', 'Kabaret Młodych Panów'],
    [['Wystawa malarstwa'], 'art', ''],
    [[], 'art', 'Wernisaż akwareli i rzeźby'],
    [[], 'family', 'Bajka dla dzieci'],
    [[], 'outdoor', 'Speedway Euro Championship - Final'],
    [[], 'outdoor', 'V Bieg Doliną Strugu'],
    [[], 'culture', 'Jarmark Świętojański'],
    [[], 'culture', 'Film w plenerze || Rzymskie wakacje'],
  ])('categories=%j → %s (title=%s)', (cats, expected, title) => {
    expect(mapCategory(cats as string[], title as string).category).toBe(expected)
  })

  it('keeps working for Spanish sources without a title', () => {
    expect(mapCategory(['concierto de jazz']).category).toBe('music')
  })

  it('defaults to culture when nothing matches', () => {
    expect(mapCategory([], 'Zebranie mieszkańców').category).toBe('culture')
  })
})
