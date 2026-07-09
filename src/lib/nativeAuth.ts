import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { supabase } from './supabase'

export async function signInGoogleNative(): Promise<void> {
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
  const idToken = result.credential?.idToken
  if (!idToken) throw new Error('Google sign-in returned no idToken')
  // iOS GoogleSignIn embeds a hashed nonce in the id_token; forward the raw nonce so
  // Supabase can verify it. Android returns no nonce, so it stays omitted.
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
