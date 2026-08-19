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
 * `flat.slice(0, limit)` tnie po jednostkach UTF-16, więc granica cięcia może
 * paść w środku pary surogatów (np. emoji) i zostawić samotny surogat wysoki
 * na końcu. Taki znak koduje się do nieprawidłowego UTF-8 (`�`) w podglądzie
 * linku. Gałąź cięcia po spacji jest na to odporna sama z siebie — cofa się
 * przed spację i odcina sierotę razem z resztą słowa — więc to dotyczy tylko
 * cięcia twardego.
 */
function dropTrailingHighSurrogate(s: string): string {
  const last = s.charCodeAt(s.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? s.slice(0, -1) : s
}

/**
 * Opis zwinięty do jednej linii i przycięty do limitu.
 *
 * Świadomie nie używamy `truncateDescription` z `text.ts`: tamto przedłuża
 * podgląd do końca adresu przeciętego granicą, co jest słuszne w karcie
 * wydarzenia, ale tutaj 120-znakowy URL rozsadziłby cały opis.
 *
 * Wynik może mieć `limit + 1` znaków — elipsa dochodzi już po przycięciu do
 * limitu. To nie błąd: `og:description` to miękki limit, więc jeden znak
 * ponad niego nie ma znaczenia.
 */
export function excerpt(text: string | null | undefined, limit = OG_DESCRIPTION_CHARS): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat

  const cut = flat.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const body = lastSpace >= limit * WORD_BOUNDARY_MIN_RATIO
    ? cut.slice(0, lastSpace)
    : dropTrailingHighSurrogate(cut)
  return `${body.trimEnd()}…`
}

/**
 * Tylko te pola wydarzenia, których dotyka podgląd.
 *
 * Celowo nie `EventRow` z `types.ts`: ten moduł ma nie mieć importów, a węższy
 * kształt pozwala testom budować przypadki bez wypełniania kolumn, które nic
 * tu nie zmieniają.
 */
export type OgEvent = {
  title: string
  description: string | null
  place_name: string | null
  lng: number
  start_time: string
  end_time: string
  photos: string[] | null
}

export type OgPreview = {
  title: string
  description: string
  /** `null` znaczy: zostaw statyczny baner i jego deskryptory w spokoju. */
  image: string | null
  /**
   * To samo zdjęcie co `image`, ale tylko gdy jest `https://` — `og:image:secure_url`
   * to dla Facebooka i LinkedIn deklaracja "to jest wersja HTTPS", więc wsadzenie
   * tam adresu `http://` to mixed content i ryzyko, że obrazek w ogóle odrzucą.
   * `image` samo zostaje z `http://`, bo część zeskrapowanych stron gminnych nie
   * ma innej wersji, a `og:image` je toleruje.
   */
  imageSecure: string | null
  url: string
}

/**
 * Nic poza absolutnym http(s) z hostem nie ma prawa wejść do `og:image`.
 * Sam schemat to za mało — `"https://"` też pasowałby do `/^https?:\/\//`
 * i wygrałby z prawdziwym zdjęciem dalej na liście, bo szukamy pierwszego
 * dopasowania. Wymuszamy więc niepusty segment hosta po `//`.
 *
 * Zwykłe `http://` też przechodzi — celowo: skrapowane strony gminne bywają
 * tylko-http, a odrzucenie ich oznaczałoby brak zdjęcia w ogóle. Część
 * konsumentów (np. LinkedIn) może i tak odmówić renderowania takiego obrazka
 * — to akceptowalny kompromis, nie błąd.
 */
const ABSOLUTE_HTTP = /^https?:\/\/[^\s/]+/i

function firstUsablePhoto(photos: string[] | null): string | null {
  for (const photo of photos ?? []) {
    const url = (photo ?? '').trim()
    if (ABSOLUTE_HTTP.test(url)) return url
  }
  return null
}

/**
 * `place_name` piszą tylko scraper i geokoder, nigdy UI — żadna migracja nie
 * ogranicza jego długości. Bez własnego limitu jedno rozjechane pole
 * wysadziłoby cały `og:description` ponad `OG_DESCRIPTION_CHARS`, oddając
 * miejsce cięcia platformie zamiast nam.
 */
export const OG_PLACE_CHARS = 80

export function buildOgPreview(event: OgEvent, url: string, now: Date = new Date()): OgPreview {
  const place = excerpt(event.place_name, OG_PLACE_CHARS)
  const head = [place, formatEventDays(event.start_time, event.end_time, event.lng, now)]
    .filter(Boolean)
    .join(' · ')
  const body = excerpt(event.description)

  const image = firstUsablePhoto(event.photos)

  return {
    // `event.title` jest `NOT NULL` w bazie, ale bez CHECK-a na niepustość, a
    // scraper nie przechodzi przez klientowy guard z `CreateSheet.tsx` — więc
    // pusty tytuł realnie się zdarza. 'meuwe' to nazwa marki, nie tekst do
    // tłumaczenia, a moduł i tak nie może zaimportować `t`.
    title: event.title.replace(/\s+/g, ' ').trim() || 'meuwe',
    description: [head, body].filter(Boolean).join(' — '),
    image,
    imageSecure: image != null && image.startsWith('https://') ? image : null,
    url,
  }
}
