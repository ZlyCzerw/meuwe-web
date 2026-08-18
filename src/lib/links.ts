/**
 * Adresy w opisie wydarzenia — samo dopasowanie, bez Reacta.
 *
 * Osobno od renderu, bo linków potrzebuje także skracanie opisu (`text.ts`):
 * podgląd nie może urwać się w połowie adresu. Gdyby wzorzec mieszkał w
 * module renderującym, `text.ts` importowałby `.tsx` wyłącznie po regex.
 */

export type LinkMatch = {
  /** Indeks pierwszego znaku adresu w tekście źródłowym. */
  start: number
  /** Indeks za ostatnim znakiem adresu — już po obcięciu interpunkcji. */
  end: number
  /** Adres tak, jak stoi w opisie. */
  text: string
  /** To, co trafia do `href` — ze schematem dopisanym, jeśli go brakowało. */
  href: string
}

/** Znaki, które kończą zdanie, a nie adres. */
const SENTENCE_TAIL = '.,;:!?'

function count(text: string, char: string): number {
  let n = 0
  for (const c of text) if (c === char) n++
  return n
}

/** Pary, w których znak zamykający różni się od otwierającego. */
const CLOSING_PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{', '”': '„', '»': '«' }

/** Cudzysłowy, w których ten sam znak otwiera i zamyka. */
const SYMMETRIC_QUOTES = '"\''

/**
 * Adres kończy się tam, gdzie kończy się adres — nie tam, gdzie kończy się
 * zdanie. Kropka po "www.teatr.pl." należy do zdania, tak samo nawias czy
 * cudzysłów zamykający w "(szczegóły na https://teatr.pl)" albo
 * „https://teatr.pl” — polskie opisy wklejają linki w cudzysłów równie
 * chętnie, co w nawiasy. Znak, który ma parę w samym adresie, zostaje: takie
 * URL-e istnieją (Wikipedia).
 */
function trimSentenceTail(raw: string): string {
  let text = raw
  while (text.length > 0) {
    const last = text[text.length - 1]
    if (SENTENCE_TAIL.includes(last)) { text = text.slice(0, -1); continue }
    const opener = CLOSING_PAIRS[last]
    if (opener && count(text, last) > count(text, opener)) { text = text.slice(0, -1); continue }
    if (SYMMETRIC_QUOTES.includes(last) && count(text, last) % 2 === 1) { text = text.slice(0, -1); continue }
    break
  }
  return text
}

/**
 * Czy po obcięciu ogona został jeszcze adres.
 *
 * "https://..." dopasowuje się wzorcem, a po zdjęciu kropek zostaje sam
 * schemat prowadzący donikąd. Domena z kropką jest tu warunkiem wejścia.
 */
const COMPLETE = /^(?:https?:\/\/|www\.)[a-z0-9-]+(?:\.[a-z0-9-]+)+/i

export function findLinks(text: string): LinkMatch[] {
  /**
   * Tylko http(s) i `www.`. Nic innego nie jest w ogóle dopasowywane, więc
   * `javascript:` czy `data:` nie mają którędy wejść do `href`.
   */
  const pattern = /\bhttps?:\/\/[^\s<]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s<]*/gi
  const links: LinkMatch[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const found = trimSentenceTail(match[0])
    if (!COMPLETE.test(found)) continue

    links.push({
      start: match.index,
      end: match.index + found.length,
      text: found,
      href: /^https?:\/\//i.test(found) ? found : `https://${found}`,
    })
  }

  return links
}
