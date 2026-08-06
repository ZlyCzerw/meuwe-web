import { supabase } from './supabase'
import { isNativePlatform, isAndroid } from './platform'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import type { DevicePushState, PushPermission } from './pushState'
import { webPushSupported } from './webPushSupport'

// Klucz publiczny VAPID — ustaw w .env jako VITE_VAPID_PUBLIC_KEY
// Generujesz: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

/**
 * Asked by both the "what can this device do" and the "turn it on" paths, so
 * they can never again disagree about whether web push is available here.
 * Without the key PushManager.subscribe has nothing to subscribe with, and a
 * browser holding every API is still a browser that cannot receive anything.
 */
function thisBrowserCanPush(): boolean {
  const ok = webPushSupported({
    serviceWorker: 'serviceWorker' in navigator,
    PushManager: 'PushManager' in window,
    Notification: 'Notification' in window,
    hasVapidKey: !!VAPID_PUBLIC_KEY,
  })
  if (!ok && !VAPID_PUBLIC_KEY) console.warn('[push] VITE_VAPID_PUBLIC_KEY not set — web push is off')
  return ok
}

// This module answers exactly one question: what can THIS device do right now.
// Whether the user *wants* notifications lives in profile.push_enabled and is
// never inferred here. See pushState.ts for how the two are combined.

// ── Native FCM helpers ────────────────────────────────────────────────────────

/** @returns true when the token was stored for the current user. */
async function saveFcmToken(token: string): Promise<boolean> {
  // SECURITY DEFINER RPC (not a direct upsert) so a token previously owned by
  // another account on this device is reassigned to the current user.
  const { error } = await supabase.rpc('register_push_device', {
    p_fcm_token: token,
    p_platform: isAndroid() ? 'android' : 'ios',
  })
  if (error) {
    console.error('[push] register_push_device failed:', error)
    return false
  }
  return true
}

// Registered once per app run. `removeAllListeners()` used to be called here on
// every toggle, which also tore down the notificationActionPerformed listener
// installed at boot by registerNativePushTapHandler — after enabling push in the
// profile, tapping a notification no longer opened the event. Never call it.
let tokenListenerReady = false
async function ensureTokenRotationListener(): Promise<void> {
  if (tokenListenerReady) return
  tokenListenerReady = true
  await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
    if (token) saveFcmToken(token)
  })
}

export interface PushTapHandlers {
  openEvent: (eventId: string) => void
  /** Digest tap: centre the map on the spot the count was computed for. */
  openSpot: (lat: number, lng: number, km?: number) => void
}

let tapHandlerReady = false
let tapHandler: PushTapHandlers | null = null
export async function registerNativePushTapHandler(handlers: PushTapHandlers): Promise<void> {
  if (!isNativePlatform()) return
  // Keep the newest callbacks but only ever attach one listener, so a remount
  // (StrictMode in dev) cannot open the same event twice.
  tapHandler = handlers
  if (tapHandlerReady) return
  tapHandlerReady = true
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    // A native tap delivers no URL, only this data bag — so the digest's spot
    // rides in the payload (as strings; FCM data allows nothing else).
    const data = (event.notification?.data ?? {}) as Record<string, string>
    if (data.eventId) { tapHandler?.openEvent(data.eventId); return }
    const lat = parseFloat(data.lat ?? '')
    const lng = parseFloat(data.lng ?? '')
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const km = parseFloat(data.km ?? '')
      tapHandler?.openSpot(lat, lng, Number.isFinite(km) ? km : undefined)
    }
  })
}

function mapNativePermission(receive: string): PushPermission {
  if (receive === 'granted') return 'granted'
  if (receive === 'denied') return 'denied'
  return 'prompt' // 'prompt' | 'prompt-with-rationale'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// ── Rejestracja Service Workera ───────────────────────────────────────────────

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (isNativePlatform()) return null
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (err) {
    console.error('[push] SW registration failed:', err)
    return null
  }
}

// ── Stan urządzenia ───────────────────────────────────────────────────────────

/**
 * What this device can do. Never prompts.
 *
 * `registered` means the delivery target is stored server-side for `userId`.
 * When it cannot be confirmed (no session, failed query) it stays false: the UI
 * then offers a repair instead of claiming delivery it cannot vouch for.
 */
export async function getDevicePushState(userId: string | null): Promise<DevicePushState> {
  if (isNativePlatform()) {
    const perm = await FirebaseMessaging.checkPermissions()
    const permission = mapNativePermission(perm.receive)
    if (permission !== 'granted' || !userId) return { permission, registered: false, confirmed: true }
    const token = await getNativeToken()
    // No token is not the same as no registration: FCM returns nothing while it
    // is still initialising or offline, which is the state a cold start is in.
    if (!token) return { permission, registered: false, confirmed: false }
    const stored = await isTokenStored(userId, token)
    return { permission, registered: stored === true, confirmed: stored !== null }
  }

  if (!thisBrowserCanPush()) return { permission: 'unsupported', registered: false, confirmed: true }
  const permission: PushPermission =
    Notification.permission === 'granted' ? 'granted'
    : Notification.permission === 'denied' ? 'denied'
    : 'prompt'
  if (permission !== 'granted' || !userId) return { permission, registered: false, confirmed: true }

  const lookup = await getWebSubscription()
  if (!lookup.ok) return { permission, registered: false, confirmed: false }
  if (!lookup.sub) return { permission, registered: false, confirmed: true }
  const stored = await isEndpointStored(userId, lookup.sub.endpoint)
  return { permission, registered: stored === true, confirmed: stored !== null }
}

async function getNativeToken(): Promise<string | null> {
  try {
    const { token } = await FirebaseMessaging.getToken()
    return token || null
  } catch (err) {
    console.error('[push] getToken failed:', err)
    return null
  }
}

/**
 * `ok: false` means the question could not be put at all — no service worker
 * registration yet (it is registered in parallel at boot), or the call threw.
 * `ok: true, sub: null` is a real answer: this browser holds no subscription.
 */
type SubscriptionLookup = { ok: true; sub: PushSubscription | null } | { ok: false }

async function getWebSubscription(): Promise<SubscriptionLookup> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return { ok: false }
    return { ok: true, sub: await reg.pushManager.getSubscription() }
  } catch (err) {
    console.error('[push] getSubscription failed:', err)
    return { ok: false }
  }
}

/** `null` when the lookup itself failed — not the same as "no row". */
async function isTokenStored(userId: string, token: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('push_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('fcm_token', token)
    .maybeSingle()
  if (error) {
    console.error('[push] push_devices lookup failed:', error)
    return null
  }
  return !!data
}

/** `null` when the lookup itself failed — not the same as "no row". */
async function isEndpointStored(userId: string, endpoint: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error) {
    console.error('[push] push_subscriptions lookup failed:', error)
    return null
  }
  return !!data
}

// ── Włączenie na tym urządzeniu ───────────────────────────────────────────────

/**
 * Ask for the system permission (if it can still be asked for) and register the
 * delivery target. Must be called from a user gesture. Returns the resulting
 * device state — the caller decides what to tell the user; nothing is swallowed.
 */
export async function enablePushOnThisDevice(userId: string): Promise<DevicePushState> {
  if (isNativePlatform()) {
    const perm = await FirebaseMessaging.requestPermissions()
    const permission = mapNativePermission(perm.receive)
    if (permission !== 'granted') return { permission, registered: false, confirmed: true }
    return { permission, registered: await registerNativeToken(), confirmed: true }
  }

  if (!thisBrowserCanPush()) return { permission: 'unsupported', registered: false, confirmed: true }
  const result = await Notification.requestPermission()
  if (result !== 'granted') {
    // 'denied' is final; 'default' means the prompt was dismissed and can return.
    return { permission: result === 'denied' ? 'denied' : 'prompt', registered: false, confirmed: true }
  }
  return { permission: 'granted', registered: await subscribeWeb(userId), confirmed: true }
}

/**
 * Silent path used at startup. Registers only when the system permission is
 * ALREADY granted, so it can never raise a prompt out of nowhere. When the
 * permission is missing it just reports it, and the profile toggle renders the
 * mismatch instead of hiding it.
 *
 * The user's intent is deliberately not consulted: a token is only an address,
 * delivery is still gated server-side by profile.push_enabled.
 */
export async function ensurePushRegistered(userId: string): Promise<DevicePushState> {
  const state = await getDevicePushState(userId)
  if (state.permission !== 'granted' || state.registered) return state

  const registered = isNativePlatform()
    ? await registerNativeToken()
    : await subscribeWeb(userId)
  return { permission: 'granted', registered, confirmed: true }
}

// No userId parameter: register_push_device derives the owner from the
// authenticated session, which is also what makes account switching work.
async function registerNativeToken(): Promise<boolean> {
  const token = await getNativeToken()
  if (!token) {
    console.error('[push] permission granted but FCM returned no token')
    return false
  }
  const saved = await saveFcmToken(token)
  await ensureTokenRotationListener()
  return saved
}

async function subscribeWeb(userId: string): Promise<boolean> {
  const reg = await registerServiceWorker()
  if (!reg) return false

  const lookup = await getWebSubscription()
  let sub = lookup.ok ? lookup.sub : null
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      })
    } catch (err) {
      console.error('[push] subscribe failed:', err)
      return false
    }
  }

  const json = sub.toJSON()
  const keys = json.keys as { p256dh: string; auth: string }
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth_key: keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) {
    console.error('[push] save subscription failed:', error)
    return false
  }
  return true
}

// ── Wyłączenie na tym urządzeniu ──────────────────────────────────────────────

export async function disablePushOnThisDevice(): Promise<void> {
  if (isNativePlatform()) {
    const token = await getNativeToken()
    if (token) await supabase.from('push_devices').delete().eq('fcm_token', token)
    try { await FirebaseMessaging.deleteToken() }
    catch (err) { console.error('[push] deleteToken failed:', err) }
    return
  }

  const lookup = await getWebSubscription()
  const sub = lookup.ok ? lookup.sub : null
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// ── Odświeżenie subskrypcji (pushsubscriptionchange) ─────────────────────────

export async function refreshPushSubscription(userId: string): Promise<void> {
  await ensurePushRegistered(userId)
}

// ── Mute/unmute eventu ────────────────────────────────────────────────────────

export async function muteEvent(userId: string, eventId: string): Promise<void> {
  await supabase.from('notification_mutes').upsert(
    { user_id: userId, event_id: eventId },
    { onConflict: 'user_id,event_id' }
  )
}

export async function unmuteEvent(userId: string, eventId: string): Promise<void> {
  await supabase
    .from('notification_mutes')
    .delete()
    .match({ user_id: userId, event_id: eventId })
}

export async function getEventMutes(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('notification_mutes')
    .select('event_id')
    .eq('user_id', userId)
  return (data || []).map((r: { event_id: string }) => r.event_id)
}
