import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Lang } from './types'
import pl from '../locales/pl'
import en from '../locales/en'
import es from '../locales/es'
import de from '../locales/de'
import sl from '../locales/sl'
import { getCurrentPosition, reverseGeocodeCountry, countryToLang } from './geo'

const STORAGE_KEY = 'meuwe_lang'

// Statyczne warianty landingu żyją pod /pl, /de, /es i /sl (angielski w korzeniu).
// Prefiks trzyma się w jednym miejscu z build-seo-pages.mjs — rozjazd oznaczałby
// stronę zaindeksowaną po niemiecku, która po starcie JS pokazuje angielski.
const PATH_LANGS: Record<string, Lang> = { pl: 'pl', de: 'de', es: 'es', sl: 'sl' }

export function langFromPath(pathname:string):Lang|null {
  const seg = (pathname||'').split('/')[1]?.toLowerCase() ?? ''
  return PATH_LANGS[seg] ?? null
}

export function detectInitialLang(
  navLang = navigator.language,
  pathname = typeof location === 'undefined' ? '/' : location.pathname,
):Lang {
  // Ręczny wybór bije URL: kto raz przestawił język, ten po kliknięciu cudzego
  // linku /de nadal chce swój. Roboty nie mają localStorage, więc dla nich
  // i tak decyduje ścieżka — a to one są odbiorcą tego podziału.
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
  if (saved==='pl'||saved==='en'||saved==='es'||saved==='de'||saved==='sl') return saved
  const fromPath = langFromPath(pathname)
  if (fromPath) return fromPath
  const base = (navLang||'en').slice(0,2).toLowerCase()
  if (base==='pl') return 'pl'
  if (base==='es') return 'es'
  if (base==='de') return 'de'
  if (base==='sl') return 'sl'
  return 'en'
}

export function hasManualOverride():boolean {
  return !!localStorage.getItem(STORAGE_KEY)
}

export function setLanguage(lang:Lang, manual=true) {
  if (manual) localStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

i18n.use(initReactI18next).init({
  resources: { pl:{translation:pl}, en:{translation:en}, es:{translation:es}, de:{translation:de}, sl:{translation:sl} },
  lng: detectInitialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  pluralSeparator: '_',
  compatibilityJSON: 'v4',
})

export async function refineLangByGeo() {
  if (hasManualOverride()) return
  // Wejście na /de jest deklaracją języka równie mocną jak kliknięcie flagi —
  // geolokalizacja nie ma prawa przestawić go z powrotem na hiszpański.
  if (typeof location !== 'undefined' && langFromPath(location.pathname)) return
  const pos = await getCurrentPosition()
  if (!pos) return
  const country = await reverseGeocodeCountry(pos.lat, pos.lng)
  if (!country) return
  setLanguage(countryToLang(country), false)
}

export default i18n
