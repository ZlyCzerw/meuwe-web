// Web Push — RFC 8291 (payload encryption) + RFC 8188 (aes128gcm content encoding)
// Używa natywnego Web Crypto API (Deno) — zero zewnętrznych zależności

export interface PushSubscriptionRecord {
  id: string
  endpoint: string
  p256dh: string   // base64url, 65-byte uncompressed EC public key
  auth_key: string // base64url, 16-byte auth secret
}

export interface PushPayload {
  title: string
  body: string
  type: 'new_event' | 'event_start' | 'message'
  eventId?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const enc = new TextEncoder()

function b64u(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  return Uint8Array.from(
    atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  )
}

function u8b64(u8: Uint8Array): string {
  return btoa(String.fromCharCode(...u8))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function cat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

// Native HKDF: Extract + Expand in one call via Web Crypto
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  byteLength: number
): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw', ikm, { name: 'HKDF' }, false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    byteLength * 8
  )
  return new Uint8Array(bits)
}

// ── VAPID JWT (ES256) ─────────────────────────────────────────────────────────

async function makeVapidJwt(
  audience: string,
  subject: string,
  privateKeyB64: string, // base64url raw 32-byte EC private key scalar
  publicKeyB64: string   // base64url uncompressed 65-byte EC public key
): Promise<string> {
  const header  = u8b64(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const now     = Math.floor(Date.now() / 1000)
  const payload = u8b64(enc.encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject })))
  const signingInput = `${header}.${payload}`

  // Build JWK from raw private scalar + uncompressed public key bytes
  const pub = b64u(publicKeyB64)
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privateKeyB64,
    x: u8b64(pub.slice(1, 33)),
    y: u8b64(pub.slice(33, 65)),
    key_ops: ['sign'],
    ext: true,
  }

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)
  )

  return `${signingInput}.${u8b64(new Uint8Array(sig))}`
}

// ── RFC 8291 payload encryption ───────────────────────────────────────────────
//
// Key derivation (RFC 8291 §3.4):
//   shared      = ECDH(server_priv, client_pub)   → 32 bytes (x-coordinate)
//   IKM         = HKDF(salt=auth_secret, ikm=shared,
//                       info="WebPush: info\0" || ua_pub || as_pub, L=32)
//   CEK         = HKDF(salt=salt_16, ikm=IKM,
//                       info="Content-Encoding: aes128gcm\0", L=16)
//   NONCE       = HKDF(salt=salt_16, ikm=IKM,
//                       info="Content-Encoding: nonce\0", L=12)
//
// Plaintext padding (RFC 8188 §2.5):  content || 0x02  (last-record delimiter)
//
// Body (RFC 8188 §2):
//   salt(16) || uint32be(rs=4096) || uint8(idlen=65) || as_pub(65) || ciphertext

async function encryptPayload(
  clientP256dh: string,
  clientAuth: string,
  plaintext: string
): Promise<Uint8Array> {
  // Random 16-byte salt for this encryption
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Server ephemeral key pair
  const serverKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  )
  const serverPub = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey))

  // Client (subscriber) public key
  const clientPubBytes = b64u(clientP256dh)
  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPubBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // ECDH shared secret — 32-byte x-coordinate of shared point
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientPubKey },
      serverKP.privateKey,
      256
    )
  )

  const authSecret = b64u(clientAuth)

  // Step 1: IKM  (RFC 8291 §3.4)
  const keyInfo = cat(enc.encode('WebPush: info\x00'), clientPubBytes, serverPub)
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32)

  // Step 2: CEK  (16 bytes for AES-128-GCM)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\x00'), 16)

  // Step 3: NONCE (12 bytes for AES-GCM IV)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\x00'), 12)

  // Encrypt with AES-128-GCM; append 0x02 padding delimiter (last record)
  const contentKey = await crypto.subtle.importKey(
    'raw', cek, { name: 'AES-GCM' }, false, ['encrypt']
  )
  const padded    = cat(enc.encode(plaintext), new Uint8Array([0x02]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, contentKey, padded)
  )

  // RFC 8188 header: salt(16) | rs uint32be(4) | idlen uint8(1) | keyid(idlen)
  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096, false)
  header[20] = 65  // server public key is the key ID

  return cat(header, serverPub, ciphertext)
}

// ── Send one notification ─────────────────────────────────────────────────────

export async function sendPushNotification(
  sub: PushSubscriptionRecord,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<boolean> {
  try {
    const url      = new URL(sub.endpoint)
    const audience = `${url.protocol}//${url.host}`
    const jwt      = await makeVapidJwt(audience, vapidSubject, vapidPrivateKey, vapidPublicKey)
    const body     = await encryptPayload(sub.p256dh, sub.auth_key, JSON.stringify(payload))

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':     'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL':              '86400',
        'Urgency':          payload.type === 'message' ? 'high' : 'normal',
        'Authorization':    `vapid t=${jwt},k=${vapidPublicKey}`,
      },
      body,
    })

    console.log(`[push] → ${res.status} ${sub.endpoint.slice(0, 60)}`)
    if (!res.ok && res.status !== 201) {
      const text = await res.text().catch(() => '')
      console.error(`[push] error body: ${text.slice(0, 200)}`)
    }

    if (res.status === 410 || res.status === 404) return false  // expired subscription
    return res.ok || res.status === 201
  } catch (err) {
    console.error('[push] fetch error:', err)
    return true  // don't remove subscription on network errors
  }
}

// ── Send to many subscriptions ────────────────────────────────────────────────

export async function sendToMany(
  subs: PushSubscriptionRecord[],
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
  // deno-lint-ignore no-explicit-any
  admin: any
): Promise<void> {
  await Promise.allSettled(subs.map(async sub => {
    const ok = await sendPushNotification(sub, payload, vapidPublicKey, vapidPrivateKey, vapidSubject)
    if (!ok) {
      console.log(`[push] removing expired sub ${sub.id}`)
      await admin.from('push_subscriptions').delete().eq('id', sub.id)
    }
  }))
}
