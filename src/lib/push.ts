import { supabase } from './supabase'
import { isNativePlatform, isAndroid } from './platform'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'

// Klucz publiczny VAPID — ustaw w .env jako VITE_VAPID_PUBLIC_KEY
// Generujesz: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

// ── Stan powiadomień ─────────────────────────────────────────────────────────

export type PushStatus =
  | 'unsupported'   // przeglądarka nie obsługuje Web Push
  | 'denied'        // user zablokował
  | 'subscribed'    // aktywna subskrypcja
  | 'unsubscribed'  // obsługuje, ale nie zapisany

// ── Native FCM helpers ────────────────────────────────────────────────────────

async function saveFcmToken(token: string): Promise<void> {
  // SECURITY DEFINER RPC (not a direct upsert) so a token previously owned by
  // another account on this device is reassigned to the current user.
  const { error } = await supabase.rpc('register_push_device', {
    p_fcm_token: token,
    p_platform: isAndroid() ? 'android' : 'ios',
  })
  if (error) console.error('[push] register_push_device failed:', error)
}

export async function registerNativePushTapHandler(navigateToEvent: (eventId: string) => void): Promise<void> {
  if (!isNativePlatform()) return
  await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
    const data = (event.notification?.data ?? {}) as Record<string, string>
    if (data.eventId) navigateToEvent(data.eventId)
  })
}

export async function registerNativePush(_userId: string): Promise<PushStatus> {
  const perm = await FirebaseMessaging.requestPermissions()
  if (perm.receive !== 'granted') return 'denied'

  const { token } = await FirebaseMessaging.getToken()
  if (!token) return 'unsubscribed'
  await saveFcmToken(token)

  // Token rotation
  await FirebaseMessaging.removeAllListeners()
  await FirebaseMessaging.addListener('tokenReceived', ({ token: t }) => {
    if (t) saveFcmToken(t)
  })
  return 'subscribed'
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

// ── Status powiadomień ────────────────────────────────────────────────────────

export async function getPushStatus(): Promise<PushStatus> {
  if (isNativePlatform()) {
    const perm = await FirebaseMessaging.checkPermissions()
    return perm.receive === 'granted' ? 'subscribed' : perm.receive === 'denied' ? 'denied' : 'unsubscribed'
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return 'unsubscribed'
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'subscribed' : 'unsubscribed'
  } catch {
    return 'unsubscribed'
  }
}

// ── Subskrypcja ───────────────────────────────────────────────────────────────

export async function subscribePush(userId: string): Promise<PushStatus> {
  if (isNativePlatform()) return registerNativePush(userId)

  if (!VAPID_PUBLIC_KEY) {
    console.error('[push] VITE_VAPID_PUBLIC_KEY not set')
    return 'unsupported'
  }

  // 1. Poproś o pozwolenie
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  // 2. Zarejestruj SW (idempotent)
  const reg = await registerServiceWorker()
  if (!reg) return 'unsupported'

  // 3. Subskrybuj push
  let sub: PushSubscription
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    })
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return 'denied'
  }

  // 4. Zapisz w Supabase
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
    return 'unsubscribed'
  }

  return 'subscribed'
}

// ── Anulowanie subskrypcji ────────────────────────────────────────────────────

export async function unsubscribePush(): Promise<void> {
  if (isNativePlatform()) {
    const { token } = await FirebaseMessaging.getToken().catch(() => ({ token: null as string | null }))
    if (token) await supabase.from('push_devices').delete().eq('fcm_token', token)
    await FirebaseMessaging.deleteToken().catch(() => {})
    return
  }

  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return

  const sub = await reg.pushManager.getSubscription()
  if (!sub) return

  const endpoint = sub.endpoint

  await sub.unsubscribe()

  // Usuń z Supabase
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// ── Odświeżenie subskrypcji (pushsubscriptionchange) ─────────────────────────

export async function refreshPushSubscription(userId: string): Promise<void> {
  const status = await getPushStatus()
  if (status === 'subscribed') return
  if (status === 'unsubscribed') await subscribePush(userId)
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
