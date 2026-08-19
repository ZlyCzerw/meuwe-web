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

interface Env {
  /** Ustawiane w Cloudflare Pages → Settings → Environment variables. */
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  ASSETS?: { fetch: (request: Request) => Promise<Response> }
}

interface Ctx {
  request: Request
  env: Env
  next: () => Promise<Response>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Deskryptory statycznego banera. Zostają, dopóki baner zostaje. */
const IMAGE_DESCRIPTORS = ['og:image:width', 'og:image:height', 'og:image:type']

const servePage = (ctx: Ctx): Promise<Response> =>
  ctx.env.ASSETS ? ctx.env.ASSETS.fetch(ctx.request) : ctx.next()

/**
 * `get_event_by_id` to SECURITY DEFINER nadany roli `anon` — sam klucz
 * anonimowy wystarcza, żeby odczytać wydarzenie po UUID. Każda porażka kończy
 * się `null`, bo strona główna nie może się wywrócić przez podgląd linku.
 */
async function fetchEvent(env: Env, id: string): Promise<OgEvent | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_event_by_id`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_event_id: id }),
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
    'og:url': og.url,
  }
  const byName: Record<string, string> = {
    description: og.description,
    'twitter:title': og.title,
    'twitter:description': og.description,
  }

  if (og.image) {
    byProperty['og:image'] = og.image
    byProperty['og:image:secure_url'] = og.image
    byName['twitter:image'] = og.image
  }

  return new HTMLRewriter()
    .on('title', {
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
    .transform(page)
}

export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const url = new URL(ctx.request.url)
  const id = url.searchParams.get('event') ?? ''
  if (!UUID.test(id)) return servePage(ctx)

  // Równolegle, żeby opóźnienie Supabase schowało się za pobraniem strony,
  // zamiast doklejać się do niego.
  const [page, event] = await Promise.all([servePage(ctx), fetchEvent(ctx.env, id)])
  if (!event) return page

  return rewrite(page, buildOgPreview(event, `${url.origin}/?event=${id}`))
}
