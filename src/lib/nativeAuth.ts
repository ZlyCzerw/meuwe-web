import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { supabase } from './supabase'

/**
 * Clears the native provider state that Supabase's signOut does not touch.
 *
 * On Android this reaches GoogleSignInClient.signOut() and on iOS
 * GIDSignIn.sharedInstance.signOut() (FirebaseAuthentication 6.3.1). That cached
 * account is the reason a second sign-in used to walk straight back into the
 * account the user had just left, with no picker in between. skipNativeAuth on
 * the way in makes no difference to it: that only skips Firebase Auth, not the
 * provider's own memory.
 */
export async function signOutNative(): Promise<void> {
  await FirebaseAuthentication.signOut()
}

export async function signInGoogleNative(): Promise<void> {
  // Also cleared on the way in, for everyone who signed out on a build that had
  // no signOutNative — their cached account is already there, and without this
  // the fix would only start working after their next sign-out. Failing to clear
  // is not a reason to refuse to sign in.
  try {
    await FirebaseAuthentication.signOut()
  } catch (err) {
    console.error('[auth] clearing the native provider before sign-in failed:', err)
  }
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
  const idToken = result.credential?.idToken
  if (!idToken) throw new Error('Google sign-in returned no idToken')
  // iOS GoogleSignIn embeds a hashed nonce in the id_token; forward the raw nonce so
  // Supabase can verify it. Android returns no nonce, so it stays omitted.
  // iOS GoogleSignIn (7.1.0, pinned by the plugin) embeds a nonce in the id_token but does
  // not surface the raw value, so it can't be forwarded here. The Google provider in Supabase
  // must have "Skip Nonce Check" enabled (Dashboard → Auth → Providers → Google) — the
  // official Supabase option for native mobile flows. `credential.nonce` is still forwarded
  // when present (Apple / future SDKs); on iOS Google it is undefined.
  const nonce = result.credential?.nonce
  const { error } = await supabase.auth.signInWithIdToken(
    nonce ? { provider: 'google', token: idToken, nonce } : { provider: 'google', token: idToken }
  )
  if (error) throw new Error(error.message)
}

export async function signInAppleNative(): Promise<void> {
  const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true })
  const idToken = result.credential?.idToken
  if (!idToken) throw new Error('Apple sign-in returned no idToken')
  const nonce = result.credential?.nonce
  const { error } = await supabase.auth.signInWithIdToken(
    nonce ? { provider: 'apple', token: idToken, nonce } : { provider: 'apple', token: idToken }
  )
  if (error) throw new Error(error.message)
}
