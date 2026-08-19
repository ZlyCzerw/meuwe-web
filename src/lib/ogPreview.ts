/**
 * Open Graph preview for a shared event link — pure, no I/O.
 *
 * Mieszka w `src/`, a nie obok funkcji Cloudflare, z jednego powodu:
 * `functions/` nie należy do żadnego tsconfiga, więc `tsc -b` nigdy tam nie
 * zagląda. Tutaj obejmuje ten kod i typecheck, i vitest.
 *
 * Bez importów — plik jest bundlowany do runtime'u Workers, w którym nie ma
 * ani DOM-u, ani niczego z reszty aplikacji.
 */

const HOUR_MS = 3_600_000

/**
 * Kalendarzowy dzień wydarzenia w jego własnej strefie — przybliżonej.
 *
 * `events` nie ma kolumny ze strefą, a aplikacja formatuje godziny w strefie
 * *oglądającego* (`EventSheet`). Podgląd linku generuje crawler, często z USA,
 * więc strefa oglądającego jest tu bezużyteczna. Przybliżenie z długości
 * geograficznej wystarcza, bo wybieramy sam dzień, nie godzinę: `round(lng/15)`
 * myli się o najwyżej godzinę z okładem, co przesuwa dzień tylko dla wydarzeń
 * zaczynających się tuż po północy.
 */
function localParts(iso: string, lng: number): { y: number; m: number; d: number } | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const offsetH = Number.isFinite(lng) ? Math.round(lng / 15) : 0
  const shifted = new Date(ms + offsetH * HOUR_MS)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() }
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Rok w ogonku tylko wtedy, gdy różni się od bieżącego — porównanie po UTC,
 * spójnie z resztą modułu, która nigdzie nie sięga po strefę hosta.
 */
function yearSuffix(year: number, now: Date): string {
  return year === now.getUTCFullYear() ? '' : `.${year}`
}

/**
 * Dzień albo zakres dni, zapisem liczbowym — celowo bez nazw miesięcy i bez
 * godzin. Liczby nie wymagają tłumaczenia, a godziny wymagałyby strefy,
 * której nie mamy.
 */
export function formatEventDays(
  startIso: string,
  endIso: string,
  lng: number,
  now: Date = new Date(),
): string {
  const start = localParts(startIso, lng)
  if (!start) return ''

  // Zeskrobane wydarzenia czasem mają zepsuty koniec wcześniejszy niż
  // początek. To zła dana, nie prawdziwy zakres — ufamy tylko początkowi,
  // który jest wiarygodnym końcem tej pary, i pokazujemy pojedynczy dzień.
  const endMs = Date.parse(endIso)
  const backwards = Number.isFinite(endMs) && endMs < Date.parse(startIso)
  const end = backwards ? start : (localParts(endIso, lng) ?? start)

  const sameDay = start.y === end.y && start.m === end.m && start.d === end.d
  if (sameDay) {
    return `${pad(start.d)}.${pad(start.m)}${yearSuffix(start.y, now)}`
  }

  if (start.y !== end.y) {
    return `${pad(start.d)}.${pad(start.m)}.${start.y}–${pad(end.d)}.${pad(end.m)}.${end.y}`
  }

  const tail = yearSuffix(start.y, now)
  if (start.m === end.m) return `${pad(start.d)}–${pad(end.d)}.${pad(start.m)}${tail}`
  return `${pad(start.d)}.${pad(start.m)}–${pad(end.d)}.${pad(end.m)}${tail}`
}

/** Ile opisu mieści się w podglądzie linku, zanim zetną go same serwisy. */
export const OG_DESCRIPTION_CHARS = 200

/**
 * Poniżej tego udziału limitu cofanie się do spacji kosztuje za dużo — wtedy
 * tniemy twardo. Ten sam próg co w `text.ts`, dla spójności podglądów.
 */
const WORD_BOUNDARY_MIN_RATIO = 0.6

/**
 * Opis zwinięty do jednej linii i przycięty do limitu.
 *
 * Świadomie nie używamy `truncateDescription` z `text.ts`: tamto przedłuża
 * podgląd do końca adresu przeciętego granicą, co jest słuszne w karcie
 * wydarzenia, ale tutaj 120-znakowy URL rozsadziłby cały opis.
 */
export function excerpt(text: string | null | undefined, limit = OG_DESCRIPTION_CHARS): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat

  const cut = flat.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const body = lastSpace >= limit * WORD_BOUNDARY_MIN_RATIO ? cut.slice(0, lastSpace) : cut
  return `${body.trimEnd()}…`
}
