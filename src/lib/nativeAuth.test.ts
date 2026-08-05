import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithGoogle = vi.fn()
const signInWithApple = vi.fn()
const signInWithIdToken = vi.fn()
const firebaseSignOut = vi.fn()

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: {
    signInWithGoogle: (...a: any[]) => signInWithGoogle(...a),
    signInWithApple: (...a: any[]) => signInWithApple(...a),
    signOut: () => firebaseSignOut(),
  },
}))
vi.mock('./supabase', () => ({
  supabase: { auth: { signInWithIdToken: (...a: any[]) => signInWithIdToken(...a) } },
}))

import { signInGoogleNative, signInAppleNative, signOutNative } from './nativeAuth'

describe('signOutNative', () => {
  beforeEach(() => { firebaseSignOut.mockReset() })

  // Supabase's own signOut leaves the provider alone, and the provider is what
  // remembers the account. Without this the picker never appears again.
  it('clears the provider that remembers the account', async () => {
    firebaseSignOut.mockResolvedValue(undefined)
    await signOutNative()
    expect(firebaseSignOut).toHaveBeenCalled()
  })
})

describe('signInGoogleNative', () => {
  beforeEach(() => { signInWithGoogle.mockReset(); signInWithIdToken.mockReset(); firebaseSignOut.mockReset() })

  // Anyone who signed out on a build without signOutNative still has a cached
  // account. Clearing it here is what makes the fix work for them too, rather
  // than only from their next sign-out onwards.
  it('clears the remembered account before offering the picker', async () => {
    const order: string[] = []
    firebaseSignOut.mockImplementation(() => { order.push('signOut'); return Promise.resolve() })
    signInWithGoogle.mockImplementation(() => {
      order.push('signIn')
      return Promise.resolve({ credential: { idToken: 'GTOKEN' } })
    })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInGoogleNative()

    expect(order).toEqual(['signOut', 'signIn'])
  })

  // A provider that will not sign out is no reason to refuse to sign in.
  it('signs in anyway when clearing the provider fails', async () => {
    firebaseSignOut.mockRejectedValue(new Error('no user'))
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'GTOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInGoogleNative()

    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'GTOKEN' })
  })

  it('passes the Google idToken to supabase signInWithIdToken', async () => {
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'GTOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInGoogleNative()

    expect(signInWithGoogle).toHaveBeenCalledWith({ skipNativeAuth: true })
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'GTOKEN' })
  })

  it('passes the nonce when the Google credential includes one (iOS)', async () => {
    // On iOS GoogleSignIn puts a hashed nonce in the id_token; Supabase rejects the token
    // ("Passed nonce and nonce in id_token should either both exist or not") unless the raw
    // nonce is forwarded. On Android the credential has no nonce, so it stays omitted.
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'GTOKEN', nonce: 'NONCE1' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInGoogleNative()

    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'GTOKEN', nonce: 'NONCE1' })
  })

  it('throws when no idToken is returned', async () => {
    signInWithGoogle.mockResolvedValue({ credential: { idToken: null } })
    await expect(signInGoogleNative()).rejects.toThrow(/idToken/)
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it('surfaces supabase errors', async () => {
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'GTOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: null, error: { message: 'bad token' } })
    await expect(signInGoogleNative()).rejects.toThrow(/bad token/)
  })
})

describe('signInAppleNative', () => {
  beforeEach(() => { signInWithApple.mockReset(); signInWithIdToken.mockReset() })

  it('passes the Apple idToken and nonce to supabase signInWithIdToken', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: 'ATOKEN', nonce: 'NONCE1' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInAppleNative()

    expect(signInWithApple).toHaveBeenCalledWith({ skipNativeAuth: true })
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'ATOKEN', nonce: 'NONCE1' })
  })

  it('omits nonce when the provider does not return one', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: 'ATOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })
    await signInAppleNative()
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'ATOKEN' })
  })

  it('throws when no idToken is returned', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: null } })
    await expect(signInAppleNative()).rejects.toThrow(/idToken/)
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it('surfaces supabase errors', async () => {
    signInWithApple.mockResolvedValue({ credential: { idToken: 'ATOKEN', nonce: 'N' } })
    signInWithIdToken.mockResolvedValue({ data: null, error: { message: 'bad apple token' } })
    await expect(signInAppleNative()).rejects.toThrow(/bad apple token/)
  })
})
