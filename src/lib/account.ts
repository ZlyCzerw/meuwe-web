import { supabase } from './supabase'

// Account deletion, client side. The work happens in the delete-account edge
// function; this only calls it and then makes sure nothing of the account is
// left on the device.

export type DeleteAccountResult = 'ok' | 'failed'

/** localStorage keys tied to the signed-in person, cleared on deletion. */
const ACCOUNT_KEYS = [
  'meuwe_nav',
  'meuwe_last_pos',
  'meuwe_app_promo',
  'meuwe_onboarding_v1',
  'meuwe_follow_notify_asked',
]

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' })

  if (error) {
    console.error('[account] delete-account failed:', error)
    return 'failed'
  }
  // A 200 that does not say ok is still a failure; never assume success.
  if (!data || (data as { ok?: boolean }).ok !== true) {
    console.error('[account] delete-account returned an unexpected body:', data)
    return 'failed'
  }

  // The access token is a JWT: deleting the row in auth.users does not revoke
  // it, it simply keeps working until it expires. So the session has to go now,
  // locally — a server-side sign out would call an endpoint for a user that no
  // longer exists.
  const { error: signOutErr } = await supabase.auth.signOut({ scope: 'local' })
  if (signOutErr) console.error('[account] local sign out after deletion failed:', signOutErr)

  // The language choice is left alone: it is a device preference, not account data.
  for (const key of ACCOUNT_KEYS) {
    try { localStorage.removeItem(key) } catch { /* private mode */ }
  }

  return 'ok'
}
