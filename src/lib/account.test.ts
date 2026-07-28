import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteAccount } from './account'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
  },
}))

const invoke = vi.mocked(supabase.functions.invoke)
const signOut = vi.mocked(supabase.auth.signOut)

beforeEach(() => {
  vi.clearAllMocks()
  signOut.mockResolvedValue({ error: null })
  localStorage.clear()
  localStorage.setItem('meuwe_nav', 'x')
  localStorage.setItem('meuwe_app_promo', 'x')
  localStorage.setItem('meuwe_lang', 'pl')
})

describe('deleteAccount', () => {
  it('reports a failure when the function errors, and keeps the session', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') } as never)

    expect(await deleteAccount()).toBe('failed')
    expect(signOut).not.toHaveBeenCalled()
    // Nothing local is thrown away while the account may still exist.
    expect(localStorage.getItem('meuwe_nav')).toBe('x')
  })

  it('treats a 200 without ok as a failure rather than assuming success', async () => {
    invoke.mockResolvedValue({ data: { something: 'else' }, error: null } as never)

    expect(await deleteAccount()).toBe('failed')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('signs out locally on success, because the JWT outlives the account', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null } as never)

    expect(await deleteAccount()).toBe('ok')
    // Local scope: a server-side sign out would call an endpoint for a user
    // that no longer exists.
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('clears the account keys but leaves the device language alone', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null } as never)

    await deleteAccount()

    expect(localStorage.getItem('meuwe_nav')).toBeNull()
    expect(localStorage.getItem('meuwe_app_promo')).toBeNull()
    expect(localStorage.getItem('meuwe_lang')).toBe('pl')
  })

  it('still reports success if the local sign out complains', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null } as never)
    signOut.mockResolvedValue({ error: new Error('no session') } as never)

    // The account is already gone server-side; a noisy local sign out does not
    // change that, and telling the user it failed would be wrong.
    expect(await deleteAccount()).toBe('ok')
  })
})
