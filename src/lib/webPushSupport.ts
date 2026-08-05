// Can this browser actually receive a push?
//
// It used to be answered in two places that disagreed. getDevicePushState asked
// only whether the APIs exist; enablePushOnThisDevice also required our VAPID
// public key, because PushManager.subscribe cannot be called without one.
//
// On a deployment built without the key that gap is the whole bug: the first
// function reports a device that merely has not been asked yet, the app decides
// it may offer to turn notifications on, and the button then does nothing at
// all — no prompt, no error, no change the user can see.
//
// One function, asked by both.

export interface WebPushCapabilities {
  serviceWorker: boolean
  PushManager: boolean
  Notification: boolean
  /** VITE_VAPID_PUBLIC_KEY is set. Without it there is nothing to subscribe with. */
  hasVapidKey: boolean
}

export function webPushSupported(c: WebPushCapabilities): boolean {
  return c.serviceWorker && c.PushManager && c.Notification && c.hasVapidKey
}
