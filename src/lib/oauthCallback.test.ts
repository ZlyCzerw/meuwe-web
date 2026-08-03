import { describe, it, expect } from 'vitest'
import { parseOAuthCallback } from './oauthCallback'

describe('parseOAuthCallback', () => {
  it('reads the PKCE code from the query string', () => {
    expect(parseOAuthCallback('https://meuwe.eu/?code=abc123')).toEqual({ kind: 'code', code: 'abc123' })
  })

  it('reads a code that arrives in the hash (implicit-style callback)', () => {
    expect(parseOAuthCallback('https://meuwe.eu/#code=abc123')).toEqual({ kind: 'code', code: 'abc123' })
  })

  it('surfaces the provider error instead of silently returning nothing', () => {
    const res = parseOAuthCallback('https://meuwe.eu/?error=access_denied&error_description=User%20cancelled')
    expect(res).toEqual({ kind: 'error', message: 'User cancelled' })
  })

  it('prefers error over code when both are present', () => {
    const res = parseOAuthCallback('https://meuwe.eu/?code=abc&error=server_error')
    expect(res).toEqual({ kind: 'error', message: 'server_error' })
  })

  it('ignores links that are not OAuth callbacks', () => {
    expect(parseOAuthCallback('https://meuwe.eu/?event=42')).toBeNull()
    expect(parseOAuthCallback('https://meuwe.eu/?lat=50.04&lng=21.99')).toBeNull()
    expect(parseOAuthCallback('https://meuwe.eu/')).toBeNull()
  })

  it('does not throw on garbage input', () => {
    expect(parseOAuthCallback('not a url')).toBeNull()
    expect(parseOAuthCallback('')).toBeNull()
  })
})
