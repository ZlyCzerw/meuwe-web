// The native half of the update check: everything that has to talk to a store.
// Kept apart from appUpdate.ts so the decisions there stay testable without a
// phone, and so the web build never reaches for a plugin it does not have.

import {
  AppUpdate, AppUpdateAvailability, AppUpdateResultCode, type AppUpdateInfo,
} from '@capawesome/capacitor-app-update'
import { IOS_STORE_URL } from './appConfig'
import { isAndroid, isIOS, isNativePlatform } from './platform'
import {
  appleAppId, decideUpdate, dismissalKey, fetchMinSupported, readDismissedVersion,
  storefrontCountry, type UpdateOs, type UpdateVerdict,
} from './appUpdate'

export interface PendingUpdate {
  verdict: Exclude<UpdateVerdict, 'none'>
  /** What to remember if this one is waved away. */
  key: string
}

const nativeOs = (): UpdateOs | null =>
  !isNativePlatform() ? null : isIOS() ? 'ios' : isAndroid() ? 'android' : null

/**
 * The store's answer, or null. On iOS the lookup is storefront-specific and a
 * miss throws, so a wrong guess about the region gets one more try without one
 * rather than costing us the whole check.
 */
async function storeInfo(os: UpdateOs): Promise<AppUpdateInfo | null> {
  const country = os === 'ios' ? storefrontCountry(navigator.language) : null
  try {
    return await AppUpdate.getAppUpdateInfo(country ? { country } : undefined)
  } catch {
    if (!country) return null
    try { return await AppUpdate.getAppUpdateInfo() } catch { return null }
  }
}

/**
 * Whether to say anything on this start, and what. Null means silence — which
 * is also what every failure below turns into, deliberately: an update notice
 * has no business breaking the app it is trying to improve.
 */
export async function checkForUpdate(): Promise<PendingUpdate | null> {
  const os = nativeOs()
  if (!os) return null

  const info = await storeInfo(os)
  if (!info) return null

  const updateAvailable = info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
  const facts = {
    installed: info.currentVersionName ?? null,
    updateAvailable,
    // iOS names the waiting version, Android only numbers it. Either is fine as
    // an identity; neither is ever ordered against the other.
    availableLabel: info.availableVersionName ?? info.availableVersionCode ?? null,
    // Only worth a request when there is something to update to: without an
    // available build the floor cannot change the answer anyway.
    minSupported: updateAvailable ? await fetchMinSupported(os) : null,
    dismissed: readDismissedVersion(),
  }

  const verdict = decideUpdate(facts)
  return verdict === 'none' ? null : { verdict, key: dismissalKey(facts) }
}

async function openStore(): Promise<void> {
  const appId = appleAppId(IOS_STORE_URL)
  try {
    await AppUpdate.openAppStore(isIOS() && appId ? { appId } : undefined)
  } catch { /* nothing left to try; the sheet stays up */ }
}

/**
 * Acts on the button. Android can do the whole thing in place — an immediate
 * update takes over the screen, a flexible one downloads behind the app and
 * restarts it once accepted — and anything that platform will not do falls
 * back to the same store page iOS gets.
 */
export async function startUpdate(verdict: PendingUpdate['verdict']): Promise<void> {
  if (!isAndroid()) return openStore()

  // The Play API refuses a request it has no fresh info for (INFO_MISSING),
  // and this call may come minutes after the check that raised the sheet.
  const info = await storeInfo('android')
  try {
    if (verdict === 'blocking' && info?.immediateUpdateAllowed) {
      const { code } = await AppUpdate.performImmediateUpdate()
      // OK never returns here — the app is replaced mid-flow.
      if (code === AppUpdateResultCode.OK) return
    } else if (info?.flexibleUpdateAllowed) {
      const { code } = await AppUpdate.startFlexibleUpdate()
      if (code === AppUpdateResultCode.OK) { await AppUpdate.completeFlexibleUpdate(); return }
      // A cancelled download is a decision, not a failure: sending them to the
      // Play page after they just said no would be arguing with them.
      if (code === AppUpdateResultCode.CANCELED) return
    }
  } catch { /* fall through to the store */ }

  return openStore()
}
