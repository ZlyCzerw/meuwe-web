import { supabase } from './supabase'
import { isNativePlatform, isAndroid } from './platform'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import type { DevicePushState, PushPermission } from './pushState'

// Klucz publiczny VAPID — ustaw w .env jako VITE_VAPID_PUBLIC_KEY
// Generujesz: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

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

let tapHandlerReady = false
let tapHandler: ((eventId: string) => void) | null = null
export async function registerNativePushTapHandler(navigateToEvent: (eventId: string) => void): Promise<void> {
  if (!isNativePlatform()) return
  // Keep the newest callback but only ever attach one listener, so a remount
  // (StrictMode in dev) cannot open the same event twice.
  tapHandler = navigateToEvent
  if (tapHandlerReady) return
  tapHandlerReady = true
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    const data = (event.notification?.data ?? {}) as Record<string, string>
    if (data.eventId) tapHandler?.(data.eventId)
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
    if (permission !== 'granted' || !userId) return { permission, registered: false }
    const token = await getNativeToken()
    if (!token) return { permission, registered: false }
    return { permission, registered: await isTokenStored(userId, token) }
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { permission: 'unsupported', registered: false }
  }
  const permission: PushPermission =
    Notification.permission === 'granted' ? 'granted'
    : Notification.permission === 'denied' ? 'denied'
    : 'prompt'
  if (permission !== 'granted' || !userId) return { permission, registered: false }

  const sub = await getWebSubscription()
  if (!sub) return { permission, registered: false }
  return { permission, registered: await isEndpointStored(userId, sub.endpoint) }
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

async function getWebSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return null
    return await reg.pushManager.getSubscription()
  } catch (err) {
    console.error('[push] getSubscription failed:', err)
    return null
  }
}

async function isTokenStored(userId: string, token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('fcm_token', token)
    .maybeSingle()
  if (error) {
    console.error('[push] push_devices lookup failed:', error)
    return false
  }
  return !!data
}

async function isEndpointStored(userId: string, endpoint: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error) {
    console.error('[push] push_subscriptions lookup failed:', error)
    return false
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
    if (permission !== 'granted') return { permission, registered: false }
    return { permission, registered: await registerNativeToken() }
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { permission: 'unsupported', registered: false }
  }
  if (!VAPID_PUBLIC_KEY) {
    console.error('[push] VITE_VAPID_PUBLIC_KEY not set')
    return { permission: 'unsupported', registered: false }
  }

  const result = await Notification.requestPermission()
  if (result !== 'granted') {
    // 'denied' is final; 'default' means the prompt was dismissed and can return.
    return { permission: result === 'denied' ? 'denied' : 'prompt', registered: false }
  }
  return { permission: 'granted', registered: await subscribeWeb(userId) }
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
  return { permission: 'granted', registered }
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

  let sub = await getWebSubscription()
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

  const sub = await getWebSubscription()
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
