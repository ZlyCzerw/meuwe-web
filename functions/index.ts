// Cloudflare Pages Function: GET /
//
// Podmienia tagi Open Graph na dane wydarzenia, kiedy adres niesie
// `?event=<uuid>` — czyli dokładnie dla linków, które rozdaje przycisk
// „udostępnij" w `EventSheet`. Bez tego parametru oddaje statyczny plik
// nietknięty.
//
// Dlaczego to `functions/index.ts`, a nie `functions/_middleware.ts`: ten plik
// obsługuje wyłącznie ścieżkę `/`. Middleware odpalałoby się przy KAŻDYM
// żądaniu — każdym chunku JS, każdej ikonie — i zjadałoby darmowy limit
// wielokrotnie szybciej za identyczne zachowanie.
//
// Typy są pisane ręcznie, wzorem `api/geo.ts`: katalog `functions/` nie należy
// do żadnego tsconfiga, więc zależność od `@cloudflare/workers-types` i tak
// nie byłaby przez nic sprawdzana.

import { buildOgPreview, type OgEvent, type OgPreview } from '../src/lib/ogPreview'

/**
 * Zmienne z Cloudflare Pages → Settings → Environment variables.
 *
 * Warianty z `VITE_` nie są pomyłką. Projekt ma tam już `VITE_SUPABASE_URL` i
 * `VITE_SUPABASE_ANON_KEY`, bo tych samych nazw potrzebuje Vite przy buildzie
 * do wstrzyknięcia ich w bundle przeglądarki — a Pages wystawia ten sam zestaw
 * także runtime'owi funkcji, gdzie prefiks jest już tylko częścią nazwy.
 * Czytanie ich wprost oszczędza duplikatu w panelu, a duplikat to realna
 * pułapka: przy rotacji klucza łatwo poprawić jedno miejsce i zostawić drugie,
 * co ucisza podgląd linków bez żadnego błędu.
 *
 * Nazwy bez prefiksu mają pierwszeństwo — gdyby okazało się, że ten projekt
 * jednak nie podaje zmiennych buildowych funkcjom, wystarczy dodać je w panelu
 * i nic tutaj nie wymaga zmiany.
 *
 * Klucz `anon` i tak jest publiczny (jedzie w bundlu do każdej przeglądarki),
 * więc nie ma tu nic, co wyciekałoby przez wpisanie go jako `Text`.
 */
interface Env {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

interface Ctx {
  request: Request
  env: Env
  next: () => Promise<Response>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Deskryptory statycznego banera. Zostają, dopóki baner zostaje. */
const IMAGE_DESCRIPTORS = ['og:image:width', 'og:image:height', 'og:image:type']

// `next()` to udokumentowane, gwarantowane API trybu katalogu `functions/` —
// dostaje je każdy handler, nie tylko middleware. Z poziomu route handlera
// przechodzi dalej do serwowania assetów, więc nie ma ryzyka rekursji do tego
// samego pliku. To ono przechodzi przez pipeline, który dokłada
// `public/_headers` (CSP, X-Frame-Options, itd.) do KAŻDEJ odpowiedzi, także
// tej strony — odpowiedź złożona z pominięciem `next()` ryzykowałaby utratę
// tych nagłówków dla wszystkich odwiedzających, nie tylko udostępnionych linków.
const servePage = (ctx: Ctx): Promise<Response> => ctx.next()

/**
 * `get_event_by_id` to SECURITY DEFINER nadany roli `anon` — sam klucz
 * anonimowy wystarcza, żeby odczytać wydarzenie po UUID. Każda porażka kończy
 * się `null`, bo strona główna nie może się wywrócić przez podgląd linku.
 */
async function fetchEvent(env: Env, id: string): Promise<OgEvent | null> {
  const base = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL
  const key = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY
  if (!base || !key) return null
  try {
    const res = await fetch(`${base}/rest/v1/rpc/get_event_by_id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_event_id: id }),
      // Bez limitu zawieszone Supabase zawiesza każdy udostępniony link aż do
      // 524 Cloudflare. `AbortSignal.timeout` to wbudowane w Workers, nie
      // zależność — a `catch` niżej już zamienia przerwanie w `null`, czyli
      // degradację do statycznego banera.
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as OgEvent[]
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
  } catch {
    return null
  }
}

function rewrite(page: Response, og: OgPreview): Response {
  if (!(page.headers.get('content-type') ?? '').includes('text/html')) return page

  const byProperty: Record<string, string> = {
    'og:title': og.title,
    'og:description': og.description,
    // Musi nieść id wydarzenia. Facebook deduplikuje podglądy po `og:url`, więc
    // zostawienie tu gołego `https://meuwe.eu/` zapisałoby pierwsze
    // zescrapowane wydarzenie pod adresem serwisu i podałoby ten sam podgląd
    // dla wszystkich pozostałych linków.
    //
    // `<link rel="canonical">` celowo NIE idzie tym samym torem i zostaje
    // przy `https://meuwe.eu/` — to decyzja specyfikacji, nie przeoczenie.
    // LinkedIn historycznie potrafił deduplikować po canonicalu zamiast po
    // `og:url`, ale przepisanie go na adres wydarzenia zaprosiłoby Google do
    // indeksowania tysięcy efemerycznych URL-i wydarzeń. `og:url` wystarcza
    // nowoczesnym konsumentom; LinkedIn jest tu świadomym kompromisem.
    'og:url': og.url,
  }
  const byName: Record<string, string> = {
    // Gdy `og.description` jest puste (dni, miejsce i opis wydarzenia
    // wszystkie brakujące — rzadkie, ale możliwe), `if (value)` niżej po
    // prostu zostawia statyczny angielski opis marketingowy z HTML-a. To
    // celowe, nie przeoczenie: pusty `<meta name="description">` zaprasza
    // scrapery do zgadywania z treści strony, co dałoby gorszy podgląd niż
    // ogólny opis serwisu.
    description: og.description,
    'twitter:title': og.title,
    'twitter:description': og.description,
  }

  if (og.image) {
    byProperty['og:image'] = og.image
    byName['twitter:image'] = og.image
  }
  // `og:image:secure_url` deklaruje konsumentom "to jest wersja HTTPS" —
  // `imageSecure` jest `null` zarówno gdy nie ma zdjęcia, jak i gdy zdjęcie
  // jest tylko `http://`; oba przypadki mają usunąć tag, nie wysłać do niego
  // pusty/mieszany adres.
  if (og.imageSecure) {
    byProperty['og:image:secure_url'] = og.imageSecure
  }

  // Odpowiedź z `next()`/`ASSETS.fetch()` niesie `etag` i `last-modified`
  // niezmienionego `index.html`. Ten walidator opisuje plik, nie wydarzenie —
  // więc po edycji tytułu przez organizatora odświeżający klient mógłby
  // dostać 304 i zatrzymać stary podgląd aż do następnego deployu. Nagłówki
  // na odpowiedzi z fetcha są w Workers niemutowalne, stąd kopia przez
  // `new Response`, zanim cokolwiek na niej zmienimy. To usunięcie
  // walidatora, który przestał opisywać treść — nie dodanie cache'owania.
  const fresh = new Response(page.body, page)
  fresh.headers.delete('etag')
  fresh.headers.delete('last-modified')

  return new HTMLRewriter()
    .on('head title', {
      element(el) {
        el.setInnerContent(og.title)
      },
    })
    .on('meta', {
      element(el) {
        const property = el.getAttribute('property')
        if (property) {
          // Zdjęcie wydarzenia nie ma ani 1200x630, ani typu image/png —
          // zostawione deskryptory kazałyby Facebookowi rysować je w złej
          // ramce. Znikają tylko wtedy, gdy naprawdę podmieniamy obrazek.
          if (og.image && IMAGE_DESCRIPTORS.includes(property)) {
            el.remove()
            return
          }
          if (property === 'og:image:secure_url' && og.image && !og.imageSecure) {
            el.remove()
            return
          }
          const value = byProperty[property]
          if (value) el.setAttribute('content', value)
          return
        }
        const name = el.getAttribute('name')
        if (!name) return
        const value = byName[name]
        if (value) el.setAttribute('content', value)
      },
    })
    .transform(fresh)
}

export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const url = new URL(ctx.request.url)
  const id = url.searchParams.get('event') ?? ''
  if (!UUID.test(id)) return servePage(ctx)

  // Pobranie strony to pojedyncze milisekundy, Supabase to 100–500ms — więc
  // ten `Promise.all` nie chowa jednego opóźnienia za drugim, całość i tak
  // trwa mniej więcej tyle, ile sam Supabase. To, co daje, to unikanie sumy:
  // bez równoległości czekalibyśmy na obie operacje po kolei.
  const [page, event] = await Promise.all([servePage(ctx), fetchEvent(ctx.env, id)])
  if (!event) return page

  // `fetchEvent` ma swój try/catch właśnie po to, żeby strona główna nie
  // mogła się wywrócić przez podgląd linku. Ta sama zasada musi obowiązywać
  // tutaj — `buildOgPreview`/`rewrite` dostają dane wprost z PostgREST, a
  // nieoczekiwany ich kształt (np. `photos` nie będące tablicą) nie może
  // zamienić strony w Cloudflare 500.
  try {
    return rewrite(page, buildOgPreview(event, `${url.origin}/?event=${id.toLowerCase()}`))
  } catch {
    return page
  }
}
