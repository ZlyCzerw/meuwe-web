//
// Skąd, na czym i którędy powstało konto. Trigger handle_new_user działa w
// bazie i nie zna ani platformy, ani lokalizacji, więc zapisuje to klient -
// przez RPC record_signup_context, które wypełnia tylko puste kolumny. Dzięki
// temu wolno je zawołać dwa razy: raz zaraz po logowaniu, drugi raz gdy w tej
// samej sesji pojawi się GPS.

export const SIGNUP_WINDOW_MS = 24 * 60 * 60_000

export type SignupSource = 'direct' | 'event_link' | 'digest' | 'invite'
export type SignupPlatform = 'ios' | 'android' | 'web'
export type SignupProvider = 'google' | 'apple'

export interface SignupContext {
  ipLat: number | null
  ipLng: number | null
  country: string | null
  gpsLat: number | null
  gpsLng: number | null
  platform: SignupPlatform | null
  appVersion: string | null
  provider: SignupProvider | null
  source: SignupSource | null
}

/**
 * Czy to jest rejestracja, a nie zwykłe logowanie: konto młodsze niż dobę i
 * nic jeszcze nie zapisano. Konta sprzed wdrożenia zostają z nullem - uczciwiej
 * niż zapisać im „rejestrację" w dniu deployu.
 */
export function shouldRecordSignup(ctx: { profileCreatedAt: string; alreadyRecorded: boolean; now: number }): boolean {
  if (ctx.alreadyRecorded) return false
  const created = Date.parse(ctx.profileCreatedAt)
  if (!Number.isFinite(created)) return false
  return ctx.now - created < SIGNUP_WINDOW_MS
}

/** Z adresu, pod którym aplikacja wystartowała. Link do wydarzenia bije `src`. */
export function signupSourceFromUrl(url: string): SignupSource {
  let params: URLSearchParams
  try { params = new URL(url).searchParams } catch { return 'direct' }
  if (params.get('event')) return 'event_link'
  const src = params.get('src')
  if (src === 'digest') return 'digest'
  if (src === 'invite') return 'invite'
  return 'direct'
}

/** session.user.app_metadata.provider, przepuszczone przez listę tego, co znamy. */
export function signupProvider(raw: unknown): SignupProvider | null {
  return raw === 'google' || raw === 'apple' ? raw : null
}

export const ENTRY_SOURCE_KEY = 'meuwe_entry_src'

/**
 * Zapamiętaj źródło wejścia, jeśli adres jakieś niesie; 'direct' niczego nie
 * nadpisuje. Bez tego przekierowanie OAuth (powrót gołym adresem, z ?code=…)
 * kasowałoby zapamiętany link zaproszenia/digestu/wydarzenia, zanim
 * buildSignupContext zdąży go zobaczyć.
 */
export function rememberEntrySource(url: string, storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  const source = signupSourceFromUrl(url)
  if (source === 'direct') return
  try { storage.setItem(ENTRY_SOURCE_KEY, source) } catch { /* private mode */ }
}

const KNOWN_SOURCES: readonly SignupSource[] = ['direct', 'event_link', 'digest', 'invite']

/** Źródło zapamiętane przed przekierowaniem OAuth, albo null. */
export function recallEntrySource(storage: Pick<Storage, 'getItem'>): SignupSource | null {
  let raw: string | null
  try { raw = storage.getItem(ENTRY_SOURCE_KEY) } catch { return null }
  return (KNOWN_SOURCES as readonly string[]).includes(raw ?? '') ? raw as SignupSource : null
}

export function buildSignupContext(input: {
  ipGeo: { lat: number; lng: number; country: string } | null
  gps: { lat: number; lng: number } | null
  platform: SignupPlatform
  appVersion: string | null
  provider: unknown
  startUrl: string
  entrySource?: SignupSource | null
}): SignupContext {
  return {
    ipLat: input.ipGeo?.lat ?? null,
    ipLng: input.ipGeo?.lng ?? null,
    country: input.ipGeo?.country || null,
    gpsLat: input.gps?.lat ?? null,
    gpsLng: input.gps?.lng ?? null,
    platform: input.platform,
    appVersion: input.appVersion,
    provider: signupProvider(input.provider),
    source: input.entrySource ?? signupSourceFromUrl(input.startUrl),
  }
}

/** Drugie wywołanie: tylko GPS, reszta null - coalesce w bazie zostawia pierwszy zapis. */
export function gpsOnlyContext(gps: { lat: number; lng: number }): SignupContext {
  return {
    ipLat: null, ipLng: null, country: null,
    gpsLat: gps.lat, gpsLng: gps.lng,
    platform: null, appVersion: null, provider: null, source: null,
  }
}
