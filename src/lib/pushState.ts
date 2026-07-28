// Notification state is two independent facts that must never be derived from
// each other:
//
//   intent — profile.push_enabled. One flag per USER: "do I want notifications".
//   device — what THIS device can actually do: the system permission plus a
//            push subscription (web) or FCM token (native) stored for the user.
//
// Deriving the toggle from intent alone is what made the UI lie: someone who
// enabled push in the browser and later installed the native app has
// intent = true on a device that was never granted permission and has no token.
// That person sees "notifications on" and receives nothing.

export type PushPermission =
  | 'granted'      // system permission held by this device
  | 'denied'       // user (or the OS) blocked it — cannot be re-prompted in-app
  | 'prompt'       // never asked, or asked and dismissed
  | 'unsupported'  // no Web Push at all (e.g. iOS Safari outside a home-screen app)

export interface DevicePushState {
  permission: PushPermission
  /** A subscription (web) or FCM token (native) exists AND is stored for this user. */
  registered: boolean
}

export type PushUiState =
  | 'unsupported'
  | 'off'                // intent no
  | 'on'                 // intent yes, this device is registered and will receive
  | 'needsPermission'    // intent yes, this device never granted the system permission
  | 'blocked'            // intent yes, permission denied at system level
  | 'needsRegistration'  // intent yes, permission granted but no token / subscription

export function resolvePushState(intent: boolean, device: DevicePushState): PushUiState {
  if (device.permission === 'unsupported') return 'unsupported'
  if (!intent) return 'off'
  if (device.permission === 'denied') return 'blocked'
  if (device.permission === 'prompt') return 'needsPermission'
  return device.registered ? 'on' : 'needsRegistration'
}

/** True only when this device will actually receive a push right now. */
export function isDelivering(state: PushUiState): boolean {
  return state === 'on'
}

/**
 * True when the user asked for notifications but this device does not deliver
 * them. Every such state MUST be paired with a visible explanation and a way
 * out — that is the whole point of splitting intent from device state.
 */
export function needsRepair(state: PushUiState): boolean {
  return state === 'needsPermission' || state === 'blocked' || state === 'needsRegistration'
}

/**
 * Can an in-app action still fix this? 'blocked' cannot: once the system
 * permission is denied, neither the browser nor iOS/Android will show the
 * prompt again, so the only cure is the system settings screen.
 */
export function isRepairableInApp(state: PushUiState): boolean {
  return state === 'needsPermission' || state === 'needsRegistration'
}
