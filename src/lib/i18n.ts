import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { Lang } from './types'
import pl from '../locales/pl'
import en from '../locales/en'
import es from '../locales/es'
import { getCurrentPosition, reverseGeocodeCountry, countryToLang } from './geo'

const STORAGE_KEY = 'meuwe_lang'

export function detectInitialLang(navLang = navigator.language):Lang {
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
  if (saved==='pl'||saved==='en'||saved==='es') return saved
  const base = (navLang||'en').slice(0,2).toLowerCase()
  if (base==='pl') return 'pl'
  if (base==='es') return 'es'
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
  resources: { pl:{translation:pl}, en:{translation:en}, es:{translation:es} },
  lng: detectInitialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  pluralSeparator: '_',
  compatibilityJSON: 'v3',
})

export async function refineLangByGeo() {
  if (hasManualOverride()) return
  const pos = await getCurrentPosition()
  if (!pos) return
  const country = await reverseGeocodeCountry(pos.lat, pos.lng)
  if (!country) return
  setLanguage(countryToLang(country), false)
}

export default i18n
