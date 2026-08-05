// Whether the next Google sign-in should ask which account to use.
//
// On the web the provider decides that, and by default it reuses whichever
// Google account the browser is already signed into — so someone who signs out
// of meuwe to switch accounts is put straight back into the one they just left.
// `prompt=select_account` fixes it, but sending everyone through the picker on
// every login is a tap for nothing: a first-time visitor and someone whose
// session merely expired have not asked to switch anything.
//
// So it is armed by an actual sign-out and spent by the login that follows.
// (Native does not need this: there the provider's own cached account is
// cleared outright — see signOutNative in nativeAuth.ts.)

export const SIGNED_OUT_KEY = 'meuwe_signed_out'

export function markSignedOut(): void {
  try { localStorage.setItem(SIGNED_OUT_KEY, '1') } catch { /* private mode */ }
}

/** Reads the flag and clears it: the picker belongs on one login, not all of them. */
export function takeSignedOutFlag(): boolean {
  try {
    const armed = localStorage.getItem(SIGNED_OUT_KEY) !== null
    if (armed) localStorage.removeItem(SIGNED_OUT_KEY)
    return armed
  } catch { return false } // private mode
}

export function googleOAuthOptions(
  redirectTo: string,
  askForAccount: boolean,
): { redirectTo: string; queryParams?: { prompt: string } } {
  return askForAccount
    ? { redirectTo, queryParams: { prompt: 'select_account' } }
    : { redirectTo }
}
