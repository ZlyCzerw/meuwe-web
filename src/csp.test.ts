import { describe, it, expect } from 'vitest'
import html from '../index.html?raw'
import headers from '../public/_headers?raw'
import { CONSENT_STORAGE_KEY } from './lib/consent'

const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])

async function sha256Base64(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
}

// Content-Security-Policy w public/_headers pinuje inline script z index.html
// po hashu. Każda poprawka tego skryptu bez nowego hasha = przeglądarka go
// blokuje i analityka cicho gaśnie na produkcji.
describe('index.html inline scripts vs CSP', () => {
  it('has exactly one inline script', () => {
    expect(inline).toHaveLength(1)
  })

  it('is allowed by the sha256 in public/_headers', async () => {
    const hash = await sha256Base64(inline[0])
    expect(headers, `wpisz do public/_headers: 'sha256-${hash}'`).toContain(`'sha256-${hash}'`)
  })

  it('reads the same consent key the app writes', () => {
    expect(inline[0]).toContain(`'${CONSENT_STORAGE_KEY}'`)
  })

  it('declares a consent default before configuring gtag', () => {
    const def = inline[0].indexOf("'consent', 'default'")
    const cfg = inline[0].indexOf("'config'")
    expect(def).toBeGreaterThan(-1)
    expect(cfg).toBeGreaterThan(def)
  })
})
