// Zgoda na cookies analityczne. Google Analytics jedzie w Consent Mode v2:
// skrypt gtag ładuje się zawsze (index.html), ale bez zgody Google nie stawia
// cookies i nie nadaje identyfikatora — dostaje tylko anonimowe pingi, z których
// modeluje ruch. Zgoda przełącza go w normalny tryb, bez przeładowania strony.
//
// Klucz w localStorage czyta też inline script w index.html, żeby ustawić stan
// domyślny ZANIM gtag wystartuje. Zmiana nazwy klucza albo kształtu wpisu musi
// iść w parze z tamtym skryptem (a nowy skrypt to nowy hash w public/_headers).

declare function gtag(...args: unknown[]): void

export const CONSENT_STORAGE_KEY = 'meuwe_consent'

export interface Consent {
  analytics: boolean
}

interface StoredConsent extends Consent {
  v: 1
  ts: number
}

export function readConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConsent> | null
    if (!parsed || parsed.v !== 1 || typeof parsed.analytics !== 'boolean') return null
    return { analytics: parsed.analytics }
  } catch {
    return null
  }
}

export function saveConsent(consent: Consent): void {
  const stored: StoredConsent = { v: 1, analytics: consent.analytics, ts: Date.now() }
  try { localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(stored)) } catch { /* prywatny tryb */ }
  if (typeof gtag === 'undefined') return
  gtag('consent', 'update', { analytics_storage: consent.analytics ? 'granted' : 'denied' })
}

// Stopka prosi o ponowne otwarcie ustawień, a baner siedzi w innym poddrzewie —
// zwykłe zdarzenie na oknie jest tu prostsze niż kontekst przez cały landing.
const SETTINGS_EVENT = 'meuwe:cookie-settings'

export function openCookieSettings(): void {
  window.dispatchEvent(new Event(SETTINGS_EVENT))
}

export function onCookieSettings(cb: () => void): () => void {
  window.addEventListener(SETTINGS_EVENT, cb)
  return () => window.removeEventListener(SETTINGS_EVENT, cb)
}
