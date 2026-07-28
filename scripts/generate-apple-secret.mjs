// Generates the Apple "client secret" JWT for Supabase's Sign in with Apple (web/OAuth).
// Runs fully locally — your .p8 never leaves your machine. Paste the printed JWT into
// Supabase → Auth → Providers → Apple → "Secret Key (for OAuth)".
//
// Usage:  node scripts/generate-apple-secret.mjs /path/to/AuthKey_7JL3CD9P8L.p8
//
// The same JWT works for BOTH Supabase projects (staging + prod) because it identifies
// the Services ID to Apple, not a specific project. Apple caps validity at 6 months —
// re-run this to refresh before it expires.

import crypto from 'node:crypto'
import fs from 'node:fs'

const TEAM_ID = '43N9P5F3KV'      // Apple Team ID
const KEY_ID = '7JL3CD9P8L'       // Sign in with Apple key ID
const SERVICES_ID = 'eu.meuwe.auth' // Services ID (the OAuth "sub")

const p8Path = process.argv[2]
if (!p8Path) {
  console.error('Usage: node scripts/generate-apple-secret.mjs /path/to/AuthKey_XXX.p8')
  process.exit(1)
}
const privateKey = fs.readFileSync(p8Path, 'utf8')

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const header = { alg: 'ES256', kid: KEY_ID }
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp: now + 60 * 60 * 24 * 180, // 180 days (Apple max is 6 months)
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
}

const signingInput = `${b64url(header)}.${b64url(payload)}`
// ES256 → raw r||s signature (JOSE format), not DER.
const signature = crypto
  .sign('SHA256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' })
  .toString('base64url')

console.log(`${signingInput}.${signature}`)
