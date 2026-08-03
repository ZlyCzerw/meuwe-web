/**
 * Powrót z logowania OAuth otwartego w przeglądarce.
 *
 * Na Androidzie logowanie przez Apple wychodzi do systemowej przeglądarki i
 * wraca App Linkiem na meuwe.eu. Ten link trzeba odczytać ręcznie: Supabase
 * rozbiera adres tylko przy ładowaniu strony, a tutaj URL przychodzi już po
 * starcie WebView, przez `appUrlOpen`.
 */
export type OAuthCallback =
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }

export function parseOAuthCallback(url: string): OAuthCallback | null {
  let parsed: URL
  try { parsed = new URL(url) } catch { return null }

  const query = parsed.searchParams
  // PKCE zwraca wszystko w query stringu, starszy flow implicit — we fragmencie.
  // Czytamy oba, żeby nie zależeć od ustawienia projektu.
  const hash = parsed.hash.startsWith('#')
    ? new URLSearchParams(parsed.hash.slice(1))
    : new URLSearchParams()

  const error = query.get('error_description') ?? query.get('error')
    ?? hash.get('error_description') ?? hash.get('error')
  if (error) return { kind: 'error', message: error }

  const code = query.get('code') ?? hash.get('code')
  return code ? { kind: 'code', code } : null
}
