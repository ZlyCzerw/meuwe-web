import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { supabase } from './supabase'

export async function signInGoogleNative(): Promise<void> {
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true })
  const idToken = result.credential?.idToken
  if (!idToken) throw new Error('Google sign-in returned no idToken')
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  if (error) throw new Error(error.message)
}
