import { SignJWT, importPKCS8 } from 'npm:jose@5'

export interface FcmPayload {
  title: string
  body: string
  type: 'new_event' | 'event_start' | 'update' | 'message'
  eventId: string
}

export interface FcmMessage {
  token: string
  notification: { title: string; body: string }
  data: Record<string, string>
}

export function buildFcmMessage(token: string, p: FcmPayload): FcmMessage {
  return {
    token,
    notification: { title: p.title, body: p.body },
    data: { type: p.type, eventId: p.eventId },
  }
}

interface ServiceAccount { client_email: string; private_key: string; project_id: string }

let cachedToken: { value: string; exp: number } | null = null

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value

  const key = await importPKCS8(sa.private_key, 'RS256')
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) throw new Error(`FCM token exchange failed: ${res.status}`)
  const json = await res.json()
  cachedToken = { value: json.access_token, exp: now + (json.expires_in ?? 3600) }
  return cachedToken.value
}

/**
 * Send one FCM message per device token. Deletes dead tokens (404/410) from
 * push_devices via the provided admin client. Returns number sent OK.
 */
export async function sendFcmToMany(
  tokens: string[],
  payload: FcmPayload,
  admin: { from: (t: string) => any },
): Promise<number> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  if (!raw) { console.error('[fcm] FCM_SERVICE_ACCOUNT_JSON not set'); return 0 }
  const sa: ServiceAccount = JSON.parse(raw)
  const accessToken = await getAccessToken(sa)
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

  let sent = 0
  for (const token of tokens) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: buildFcmMessage(token, payload) }),
    })
    if (res.ok) { sent++; continue }
    if (res.status === 404 || res.status === 410) {
      await admin.from('push_devices').delete().eq('fcm_token', token)
    } else {
      console.error(`[fcm] send failed ${res.status}:`, (await res.text()).slice(0, 200))
    }
  }
  return sent
}
