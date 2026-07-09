import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithGoogle = vi.fn()
const signInWithApple = vi.fn()
const signInWithIdToken = vi.fn()

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: {
    signInWithGoogle: (...a: any[]) => signInWithGoogle(...a),
    signInWithApple: (...a: any[]) => signInWithApple(...a),
  },
}))
vi.mock('./supabase', () => ({
  supabase: { auth: { signInWithIdToken: (...a: any[]) => signInWithIdToken(...a) } },
}))

import { signInGoogleNative, signInAppleNative } from './nativeAuth'

describe('signInGoogleNative', () => {
  beforeEach(() => { signInWithGoogle.mockReset(); signInWithIdToken.mockReset() })

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
