import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithGoogle = vi.fn()
const signInWithIdToken = vi.fn()

vi.mock('@capacitor-firebase/authentication', () => ({
  FirebaseAuthentication: { signInWithGoogle: (...a: any[]) => signInWithGoogle(...a) },
}))
vi.mock('./supabase', () => ({
  supabase: { auth: { signInWithIdToken: (...a: any[]) => signInWithIdToken(...a) } },
}))

import { signInGoogleNative } from './nativeAuth'

describe('signInGoogleNative', () => {
  beforeEach(() => { signInWithGoogle.mockReset(); signInWithIdToken.mockReset() })

  it('passes the Google idToken to supabase signInWithIdToken', async () => {
    signInWithGoogle.mockResolvedValue({ credential: { idToken: 'GTOKEN' } })
    signInWithIdToken.mockResolvedValue({ data: {}, error: null })

    await signInGoogleNative()

    expect(signInWithGoogle).toHaveBeenCalledWith({ skipNativeAuth: true })
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'GTOKEN' })
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
