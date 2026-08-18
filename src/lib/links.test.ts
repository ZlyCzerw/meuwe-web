import { describe, it, expect } from 'vitest'
import { findLinks } from './links'

describe('findLinks', () => {
  it('finds an address in the middle of a sentence', () => {
    const links = findLinks('Bilety na https://teatr.pl/bilety od poniedzialku.')
    expect(links).toHaveLength(1)
    expect(links[0].text).toBe('https://teatr.pl/bilety')
    expect(links[0].href).toBe('https://teatr.pl/bilety')
  })

  it('finds several addresses in one paragraph', () => {
    const links = findLinks('Strona https://teatr.pl, bilety https://bilety.pl/koncert')
    expect(links.map(l => l.text)).toEqual(['https://teatr.pl', 'https://bilety.pl/koncert'])
  })

  // Adres bez schematu jest w opisach regula, nie wyjatkiem. Tekst zostaje
  // taki, jak go napisano; schemat dokladamy wylacznie do href.
  it('gives a schemeless address an https href and leaves its text alone', () => {
    const [link] = findLinks('Szczegoly: www.teatr.pl')
    expect(link.text).toBe('www.teatr.pl')
    expect(link.href).toBe('https://www.teatr.pl')
  })

  // Kropka konczy zdanie, nie adres.
  it('leaves sentence punctuation out of the address', () => {
    expect(findLinks('Zajrzyj na www.teatr.pl.')[0].text).toBe('www.teatr.pl')
    expect(findLinks('Zajrzyj na https://teatr.pl, potem wroc')[0].text).toBe('https://teatr.pl')
    expect(findLinks('Wiecej: https://teatr.pl...')[0].text).toBe('https://teatr.pl')
    expect(findLinks('Wiecej: https://teatr.pl…')[0].text).toBe('https://teatr.pl')
  })

  // Nawias bez pary nalezy do zdania, nawias z para do adresu — URL-e z
  // nawiasami istnieja i tych ruszac nie wolno.
  it('drops an unmatched closing paren but keeps a matched one', () => {
    expect(findLinks('(szczegoly na https://teatr.pl)')[0].text).toBe('https://teatr.pl')
    expect(findLinks('https://pl.wikipedia.org/wiki/Rzeszow_(miasto)')[0].text)
      .toBe('https://pl.wikipedia.org/wiki/Rzeszow_(miasto)')
  })

  // Cudzysłów wokół adresu należy do zdania, nie do adresu — a polskie opisy
  // wklejają linki w „…” równie chętnie, co w nawiasy.
  it('drops a quote or bracket that closes around the address', () => {
    expect(findLinks('Zobacz na „https://teatr.pl”.')[0].text).toBe('https://teatr.pl')
    expect(findLinks('Link: "https://teatr.pl" super')[0].text).toBe('https://teatr.pl')
    expect(findLinks('[https://teatr.pl]')[0].text).toBe('https://teatr.pl')
  })

  it('ignores a javascript: scheme', () => {
    expect(findLinks('javascript:alert(1)')).toEqual([])
  })

  // Po obcieciu kropek zostalby sam schemat — to nie jest adres.
  it('ignores a bare scheme with nothing behind it', () => {
    expect(findLinks('adres to https://...')).toEqual([])
  })

  it('returns nothing for text without addresses', () => {
    expect(findLinks('Koncert w parku, wstep wolny')).toEqual([])
  })

  // Na tych indeksach stoi skracanie opisu — musza wskazywac z powrotem na
  // tekst zrodlowy.
  it('reports offsets that point back at the source text', () => {
    const text = 'Bilety na https://teatr.pl juz sa'
    const [link] = findLinks(text)
    expect(text.slice(link.start, link.end)).toBe('https://teatr.pl')
  })
})
