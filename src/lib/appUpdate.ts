// Telling someone their app is out of date.
//
// Two questions, two sources, and they are not interchangeable:
//
//  - "Is there a newer build this phone could install right now?" Only the
//    store knows. Play rolls releases out in stages, so a version that exists
//    is not a version this particular device can get; asking the store (via
//    appUpdateNative.ts) is what keeps us from pointing people at a download
//    that is not theirs yet.
//  - "Which builds does our backend still serve?" Only we know, so it lives in
//    a file we publish: WEB_ORIGIN/app-support.json.
//
// Everything below is pure or fails to null. A nudge to update must never be
// able to break the app it is nudging from.

import { WEB_ORIGIN } from './appConfig'

export const UPDATE_KEY = 'meuwe_app_update'

/** Where the support floor is published. Public, tiny, uncached. */
export const SUPPORT_URL = `${WEB_ORIGIN}/app-support.json`

/** Past this, a phone with no answer is treated as a phone with no update. */
const FETCH_TIMEOUT_MS = 4000

export type UpdateVerdict = 'none' | 'optional' | 'blocking'
export type UpdateOs = 'ios' | 'android'

export interface UpdateFacts {
  /** What this device is running. Null when the platform will not say. */
  installed: string | null
  /** Whether the store has a build this device can install right now. */
  updateAvailable: boolean
  /**
   * What identifies that waiting build: its version name on iOS, its version
   * code on Android — the two stores answer in different currencies and the
   * plugin passes that difference straight through. Only ever compared for
   * equality, never ordered, so the mismatch is harmless here.
   */
  availableLabel: string | null
  /** Oldest build the backend still supports. Null when unknown. */
  minSupported: string | null
  /** The waiting build already waved away, if any. */
  dismissed: string | null
}

// Build metadata after a dash or plus ("1.1.7-rc1") orders nothing we care
// about — two builds of the same version are the same version to a user.
const core = (v: string): string => v.trim().split(/[-+]/)[0]

const VERSION = /^\d+(\.\d+)*$/

/** Whether a string is a version we are willing to reason about at all. */
export function isVersion(v: unknown): v is string {
  return typeof v === 'string' && VERSION.test(core(v))
}

const segments = (v: string): number[] => core(v).split('.').map(Number)

/**
 * -1, 0, 1. Segment by segment, because as strings "1.1.10" sorts below
 * "1.1.9" and every tenth release would go unannounced.
 */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [segments(a), segments(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d < 0 ? -1 : 1
  }
  return 0
}

/**
 * What a dismissal is remembered as. The store's own label when there is one,
 * and otherwise the version being dismissed from — so a phone whose store
 * names nothing still gets silence, right up until it is updated.
 */
export function dismissalKey({ installed, availableLabel }: UpdateFacts): string {
  return availableLabel ?? `from:${installed ?? 'unknown'}`
}

/**
 * What, if anything, to say. Anything unknown or malformed lands on 'none':
 * silence is always safe, and this runs on every cold start.
 */
export function decideUpdate(facts: UpdateFacts): UpdateVerdict {
  const { installed, updateAvailable, minSupported, dismissed } = facts
  if (!isVersion(installed) || !updateAvailable) return 'none'

  // Blocking needs somewhere to send people, which is what updateAvailable
  // already vouches for. Without a reachable newer build an unsupported
  // version stays usable and fails honestly instead — the kinder half of a bad
  // situation, and the reason the support floor must only ever be raised to a
  // version already published in both stores.
  if (isVersion(minSupported) && compareVersions(installed, minSupported) < 0) return 'blocking'

  return dismissed === dismissalKey(facts) ? 'none' : 'optional'
}

export function readDismissedVersion(): string | null {
  try { return localStorage.getItem(UPDATE_KEY) }
  catch { return null } // private mode
}

export function writeDismissedVersion(version: string): void {
  try { localStorage.setItem(UPDATE_KEY, version) } catch { /* private mode */ }
}

/** The support floor for one platform, out of a document of unknown shape. */
export function parseMinSupported(doc: unknown, os: UpdateOs): string | null {
  if (typeof doc !== 'object' || doc === null) return null
  const entry = (doc as Record<string, unknown>)[os]
  if (typeof entry !== 'object' || entry === null) return null
  const min = (entry as Record<string, unknown>).minSupported
  return isVersion(min) ? min : null
}

/**
 * Reads the published floor. Never throws and never blocks a cold start for
 * long: a phone on a train gets null and hears nothing about updates.
 */
export async function fetchMinSupported(os: UpdateOs): Promise<string | null> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(SUPPORT_URL, { cache: 'no-store', signal: abort.signal })
    if (!res.ok) return null
    return parseMinSupported(await res.json(), os)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The storefront to ask about an iOS release. The App Store lookup answers for
 * the United States unless told otherwise, and meuwe is not sold there — so
 * without this every iPhone would be told there is never an update. The region
 * of the device's own language tag is the closest thing to its storefront that
 * a webview can see; it is a guess, and a wrong guess costs only silence.
 */
export function storefrontCountry(languageTag: string | undefined): string | null {
  const region = (languageTag ?? '').split('-')[1] ?? ''
  return /^[A-Za-z]{2}$/.test(region) ? region.toUpperCase() : null
}

/** The numeric Apple id out of the store link, so appConfig stays the one copy. */
export function appleAppId(storeUrl: string): string | null {
  return storeUrl.match(/\/id(\d+)/)?.[1] ?? null
}
