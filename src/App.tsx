import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from './hooks/useSession'
import { C, F } from './lib/tokens'
import { db } from './lib/supabase'
import { refineLangByGeo } from './lib/i18n'
import { registerServiceWorker, refreshPushSubscription, registerNativePushTapHandler, ensurePushRegistered, getDevicePushState } from './lib/push'
import type { EventWithMeta } from './lib/types'
import Welcome from './screens/Welcome'
import { Landing } from './pages/Landing'
import { isNativePlatform, isAndroid } from './lib/platform'
import { createBackExitGate, BACK_EXIT_WINDOW_MS } from './lib/backExit'
import { parseOAuthCallback } from './lib/oauthCallback'
import { Geolocation } from '@capacitor/geolocation'
import { App as CapApp } from '@capacitor/app'
import MapScreen from './screens/MapScreen'
import EventSheet from './screens/EventSheet'
import CreateSheet from './screens/CreateSheet'
import Toast from './components/Toast'
import ProfilePanel from './screens/ProfilePanel'
import AccountPanel from './screens/AccountPanel'
import ConfettiBurst from './components/ConfettiBurst'
import AnimatedSplash from './components/AnimatedSplash'
import MyEventsScreen from './screens/MyEventsScreen'
import FollowedEventsScreen from './screens/FollowedEventsScreen'
import { StoreHint } from './components/StoreBadge'
import { deviceStoreOs } from './lib/stores'
import AppPromoSheet from './components/AppPromoSheet'
import LocationOnboardingModal from './components/LocationOnboardingModal'
import InterestsOnboardingModal from './components/InterestsOnboardingModal'
import InviteFriendsModal from './components/InviteFriendsModal'
import {
  readOnboardingState, writeOnboardingState, locationPromptDelayMs, DEFAULT_DELAY_MS,
  radiusFromNearest, MAX_ONBOARDING_RADIUS_KM,
} from './lib/onboarding'
import { startupZoom, kmToZoom, MAX_MAP_KM } from './lib/geo'
import { summariseProbe } from './lib/emptyState'
import { isScreenClear, type OverlayFlags } from './lib/overlays'
import { readPromoState, writePromoState, recordEventView, canShowPromo, markPromoShown, markPromoDismissed } from './lib/appPromo'
import PushAskModal from './components/PushAskModal'
import * as pushAsk from './lib/pushAsk'
import { resolvePushState } from './lib/pushState'
import { useUnreadEvents } from './hooks/useUnreadEvents'
import { track } from './lib/analytics'
import { getIpLocation } from './lib/geo'

type Screen = 'loading' | 'welcome' | 'map' | 'myEvents' | 'followedEvents'

export default function App() {
  const { t, i18n } = useTranslation()
  const { session, profile, ready, reloadProfile } = useSession()

  const [screen, setScreen] = useState<Screen>('loading')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [lastKnownPos] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const s = localStorage.getItem('meuwe_last_pos')
      if (s) return JSON.parse(s) as { lat: number; lng: number }
    } catch {}
    return null
  })
  const [ipPos, setIpPos] = useState<{ lat: number; lng: number } | null>(null)
  const [selEvent, setSelEvent] = useState<EventWithMeta | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backExitRef = useRef(createBackExitGate())
  const [showConfetti, setShowConfetti] = useState(false)
  // Animated launch splash — native only (web has the landing page). Shows once per cold start.
  const [showSplash, setShowSplash] = useState(isNativePlatform())
  const [myEventSelected, setMyEventSelected] = useState<EventWithMeta | null>(null)
  const [followedEventSelected, setFollowedEventSelected] = useState<EventWithMeta | null>(null)
  const [pickingLocation, setPickingLocation] = useState(false)
  const [createPos, setCreatePos] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPicked, setLocationPicked] = useState(false)
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0)
  const [editingEvent, setEditingEvent] = useState<EventWithMeta | null>(null)
  const [authModal, setAuthModal] = useState<'event' | 'chat' | null>(null)
  const [deepLinkEvent, setDeepLinkEvent] = useState<EventWithMeta | null>(null)
  const [initialMapZoom, setInitialMapZoom] = useState(15)
  // The zoom goToMap settled on. MapScreen reads it when the first GPS fix
  // arrives, which used to slam the map to a hardcoded 15 and throw the whole
  // calculation away a second after it was made.
  const startupZoomRef = useRef<number | null>(null)
  const flyToFnRef = useRef<((lat: number, lng: number) => void) | null>(null)
  // Captured at render time, before the mount effect strips ?event= from the URL.
  const deepLinkIdRef = useRef<string | null>(
    new URLSearchParams(window.location.search).get('event')
  )
  // Deep link / QR to a specific map spot: ?lat=..&lng=..[&zoom=..|&km=..] opens the map
  // centred there — as a guest when there's no session, or as the logged-in user when there
  // is one. `km` (the weekly digest sends it) names the distance to frame rather than a zoom
  // level, because the zoom that shows a given distance depends on this screen's size.
  const urlSpotRef = useRef<{ lat: number; lng: number; zoom?: number } | null>((() => {
    const p = new URLSearchParams(window.location.search)
    const lat = parseFloat(p.get('lat') ?? '')
    const lng = parseFloat(p.get('lng') ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const km = parseFloat(p.get('km') ?? '')
    if (Number.isFinite(km)) return { lat, lng, zoom: kmToZoom(km, lat) }
    const z = parseInt(p.get('zoom') ?? '', 10)
    return { lat, lng, zoom: Number.isFinite(z) ? z : undefined }
  })())
  // Map spot to center on. Seeded from the boot-time URL (web) and later updated by native
  // Universal-Link / App-Link opens (appUrlOpen), which arrive after the WebView has booted.
  const [urlSpot, setUrlSpot] = useState<{ lat: number; lng: number } | null>(urlSpotRef.current)
  // Fly-to that honors an explicit zoom and applies no event-sheet offset (smart-link spots
  // have no sheet). Registered by MapScreen; used for warm opens when the map already exists.
  const flySpotRef = useRef<((lat: number, lng: number, zoom: number) => void) | null>(null)
  const openEventId = selEvent?.id ?? myEventSelected?.id ?? followedEventSelected?.id ?? null
  const unread = useUnreadEvents(session, openEventId)
  // Boot-time listeners (service worker messages) need the current session, not
  // the one captured when they were installed.
  const sessionRef = useRef(session)
  useEffect(() => { sessionRef.current = session }, [session])

  // ── Native first run ───────────────────────────────────────────────────────
  // On the web the browser owns the permission prompt, so nothing is gated there.
  const [nativeGeoAllowed, setNativeGeoAllowed] = useState(!isNativePlatform())
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [interestsModalOpen, setInterestsModalOpen] = useState(false)
  // Worked out from how far away the nearest event actually is, at the moment
  // the step opens. Until then, the widest setting — see radiusFromNearest.
  const [interestsRadiusKm, setInterestsRadiusKm] = useState(MAX_ONBOARDING_RADIUS_KM)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const onboardingRef = useRef(readOnboardingState())

  // ── "Get the app" nudge (mobile web only) ──────────────────────────────────
  // deviceStoreOs() is null on desktop, inside the app, and while that store has
  // no listing, which is all the "never show" cases in one check.
  const promoOs = deviceStoreOs()
  const [promoOpen, setPromoOpen] = useState(false)
  const promoStateRef = useRef(readPromoState())
  const arrivedAtRef = useRef(Date.now())
  // Closing the sheet is the refusal, not opening it: a showing nobody saw must
  // not count towards the three that buy three days of silence.
  const dismissPromo = () => {
    promoStateRef.current = markPromoDismissed(promoStateRef.current, Date.now())
    writePromoState(promoStateRef.current)
    setPromoOpen(false)
  }

  // ── Asking for notifications ───────────────────────────────────────────────
  // EventSheet writes to the same ledger when someone follows, so every change
  // here is a read-modify-write against storage rather than a long-lived copy
  // in memory — two writers, one book.
  const [pushAskOpen, setPushAskOpen] = useState(false)
  const sessionCountedRef = useRef(false)
  const updatePushAsk = (fn: (s: pushAsk.PushAskState) => pushAsk.PushAskState) => {
    const next = fn(pushAsk.readPushAskState())
    pushAsk.writePushAskState(next)
    return next
  }

  const NAV_KEY = 'meuwe_nav'
  const NAV_TTL = 30 * 60_000
  const navStateRef = useRef({ screen, myEventSelected, followedEventSelected })
  const navRestoredRef = useRef(false)
  const navLayersRef = useRef({
    authModal,
    selEvent,
    myEventSelected,
    followedEventSelected,
    createOpen,
    accountOpen,
    profileOpen,
    screen,
  })

  // Mirror of every layer, refreshed on each render so the two polled cards read
  // the truth rather than whatever their interval closed over. isScreenClear
  // (lib/overlays) is the single rule both of them ask.
  const overlayRef = useRef<OverlayFlags | null>(null)
  overlayRef.current = {
    screen,
    authModal: !!authModal,
    selEvent: !!selEvent,
    myEventSelected: !!myEventSelected,
    followedEventSelected: !!followedEventSelected,
    createOpen,
    profileOpen,
    accountOpen,
    pickingLocation,
    promoOpen,
    locationModalOpen,
    interestsModalOpen,
    inviteModalOpen,
    pushAskOpen,
  }
  const screenIsClear = () => !!overlayRef.current && isScreenClear(overlayRef.current)

  useEffect(() => {
    navStateRef.current = { screen, myEventSelected, followedEventSelected }
    navLayersRef.current = {
      authModal,
      selEvent,
      myEventSelected,
      followedEventSelected,
      createOpen,
      accountOpen,
      profileOpen,
      screen,
    }
  }, [screen, myEventSelected, followedEventSelected, authModal, selEvent, createOpen, accountOpen, profileOpen])

  useEffect(() => {
    function onPopState() {
      const s = navLayersRef.current
      // Zamknij najwyższą otwartą warstwę
      if (s.authModal) { setAuthModal(null); return }
      if (s.selEvent || s.myEventSelected || s.followedEventSelected) {
        setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
        return
      }
      if (s.createOpen) { setCreateOpen(false); setCreatePos(null); setLocationPicked(false); setEditingEvent(null); return }
      if (s.accountOpen) { setAccountOpen(false); return }
      if (s.profileOpen) { setProfileOpen(false); return }
      if (s.screen === 'myEvents') { setScreen('map'); return }
      if (s.screen === 'followedEvents') { setScreen('map'); return }
      // Na mapie — pushujemy z powrotem żeby nie wyjść z apki
      window.history.pushState({ layer: 'map' }, '')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onVisibilityChange() {
      if (!document.hidden) return
      const { screen, myEventSelected, followedEventSelected } = navStateRef.current
      if (screen !== 'myEvents' && screen !== 'followedEvents') {
        localStorage.removeItem(NAV_KEY)
        return
      }
      localStorage.setItem(NAV_KEY, JSON.stringify({
        screen,
        myEventId: myEventSelected?.id ?? null,
        followedEventId: followedEventSelected?.id ?? null,
        ts: Date.now(),
      }))
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // On mount: check ?event=<id> deep link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // The weekly digest tags its map link, so opens are countable.
    if (params.get('src') === 'digest') db.trackClick('digest_open')
    const eventId = params.get('event')
    if (!eventId) return
    window.history.replaceState({}, '', '/')
    db.getEventById(eventId).then(ev => { if (ev) setDeepLinkEvent(ev) })
  }, [])

  // Open deep link event once map is ready
  useEffect(() => {
    if (screen !== 'map' || !deepLinkEvent) return
    setSelEvent(deepLinkEvent)
    window.history.pushState({ layer: 'event' }, '')
    setDeepLinkEvent(null)
    const ev = deepLinkEvent
    // Auto-follow private events for logged-in users who don't already follow them.
    // Silent — no toast, no confirmation.
    if (ev.is_private && session) {
      db.isFollowingEvent(ev.id).then(following => {
        if (!following) db.followEvent(ev.id)
      })
    }
    const tryFly = () => {
      if (flyToFnRef.current) flyToFnRef.current(ev.lat, ev.lng)
      else setTimeout(tryFly, 150)
    }
    setTimeout(tryFly, 100)
  }, [screen, deepLinkEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Analytics
  useEffect(() => { if (selEvent) track.viewEvent(selEvent.id, selEvent.title) }, [selEvent])

  // Interest signal for the app nudge: distinct events opened. The same signal
  // counts towards asking for notifications, kept in its own ledger because the
  // two have different ceilings and cooldowns.
  useEffect(() => {
    if (!selEvent) return
    const next = recordEventView(promoStateRef.current, selEvent.id)
    if (next !== promoStateRef.current) {
      promoStateRef.current = next
      writePromoState(next)
    }
    updatePushAsk(s => pushAsk.recordEventView(s, selEvent.id))
  }, [selEvent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Second session is a trigger of its own, so it is counted once per cold start.
  useEffect(() => {
    if (screen !== 'map' || sessionCountedRef.current) return
    sessionCountedRef.current = true
    updatePushAsk(pushAsk.recordSessionStart)
  }, [screen])

  // Decide when to surface it. Polled rather than event-driven because one of
  // the triggers is simply time spent, and because the sheet must wait for a
  // clear screen: no event sheet, no create flow, no other modal.
  useEffect(() => {
    if (!promoOs) return
    const tick = () => {
      if (!screenIsClear()) return
      const now = Date.now()
      const seconds = (now - arrivedAtRef.current) / 1000
      if (!canShowPromo(promoStateRef.current, seconds, now)) return
      promoStateRef.current = markPromoShown(promoStateRef.current, now)
      writePromoState(promoStateRef.current)
      setPromoOpen(true)
    }
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
    // The tick reads the layer mirror rather than this closure, so the interval
    // no longer has to be rebuilt whenever a layer opens or shuts.
  }, [promoOs])

  // Same shape for the notification ask: polled, because the triggers fire at
  // moments when another layer is usually open and the card has to wait for a
  // clear screen. The device is only queried once the cheap half says yes.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    const uid = session.user.id
    const tick = async () => {
      if (cancelled || !screenIsClear()) return
      if (!pushAsk.isPushAskDue(pushAsk.readPushAskState(), Date.now())) return
      const device = await getDevicePushState(uid)
      if (cancelled) return
      const state = resolvePushState(!!profile?.push_enabled, device)
      // No calendar to fall back on here, so a device that cannot be repaired
      // in-app is left alone rather than shown a button that does nothing.
      if (!pushAsk.canAskForPush(pushAsk.readPushAskState(), { pushState: state, canOfferFallback: false }, Date.now())) return
      updatePushAsk(s => pushAsk.markAsked(s, Date.now()))
      setPushAskOpen(true)
    }
    const id = setInterval(tick, 10_000)
    return () => { cancelled = true; clearInterval(id) }
    // Same here: the layer list lives in the mirror, not in these deps.
  }, [session, profile?.push_enabled])
  useEffect(() => { if (createOpen) track.openCreate() }, [createOpen])
  useEffect(() => { if (session) track.login() }, [session])

  // Native: decide whether to explain the location permission, and when. The
  // system dialog is never raised from here — only from the modal's button.
  useEffect(() => {
    if (!isNativePlatform() || screen !== 'map') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    Geolocation.checkPermissions()
      .then(perm => {
        if (cancelled) return
        if (perm.location === 'granted' || perm.coarseLocation === 'granted') {
          setNativeGeoAllowed(true)
          return
        }
        // Already answered once: respect it and leave the map on its fallbacks.
        if (onboardingRef.current.locationDone) return
        const delay = locationPromptDelayMs({
          fromDeepLink: !!deepLinkIdRef.current || !!urlSpotRef.current,
          hasAnyPosition: !!(userPos || lastKnownPos || ipPos || urlSpotRef.current),
        })
        timer = setTimeout(() => { if (!cancelled) setLocationModalOpen(true) }, delay)
      })
      .catch(err => console.error('[geo] checkPermissions failed:', err))
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

  // The interests step outside the native permission chain: on the web, where
  // the location card never runs, and on a native install that already holds the
  // permission — in both cases finishLocationStep is never called, so without
  // this the step would reach nobody. Guests are skipped: the write needs an
  // account, and the effect re-runs when one appears.
  useEffect(() => {
    if (screen !== 'map' || !session) return
    if (onboardingRef.current.interestsDone) return
    // The location card is open or still pending — it hands over on its own.
    if (isNativePlatform() && !nativeGeoAllowed && !onboardingRef.current.locationDone) return
    if (locationModalOpen) return

    const timer = setTimeout(() => {
      if (onboardingRef.current.interestsDone) return
      const layers = navLayersRef.current
      const busy = layers.authModal || layers.selEvent || layers.myEventSelected
        || layers.followedEventSelected || layers.createOpen || layers.profileOpen
        || layers.accountOpen || layers.screen !== 'map'
        || pickingLocation || promoOpen || inviteModalOpen
      if (busy) return
      void openInterestsStep()
    }, DEFAULT_DELAY_MS)
    return () => clearTimeout(timer)
    // openInterestsStep is redefined every render; listing it would restart the
    // timer on each one and the card would never reach the end of its delay.
  }, [screen, session, nativeGeoAllowed, locationModalOpen, pickingLocation, promoOpen, inviteModalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Start geo only after user enters the map (avoids permission prompt on landing page)
  useEffect(() => {
    if (screen !== 'map') return
    refineLangByGeo()

    const onPos = (lat: number, lng: number) => {
      const pos = { lat, lng }
      try { localStorage.setItem('meuwe_last_pos', JSON.stringify(pos)) } catch {}
      setUserPos(pos)
    }

    if (isNativePlatform()) {
      // Gated: watching would raise the system dialog behind the explanation.
      if (!nativeGeoAllowed) return
      const watchPromise = Geolocation.watchPosition(
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
        (p) => { if (p) onPos(p.coords.latitude, p.coords.longitude) },
      )
      watchPromise.catch(() => {})
      return () => { watchPromise.then(id => Geolocation.clearWatch({ id })).catch(() => {}) }
    }

    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      p => onPos(p.coords.latitude, p.coords.longitude),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [screen, nativeGeoAllowed])

  // Rejestruj service worker przy starcie
  useEffect(() => {
    registerServiceWorker().then(reg => {
      if (!reg) return
      // Nasłuchuj wiadomości od SW (OPEN_EVENT, OPEN_SPOT, PUSH_SUBSCRIPTION_CHANGED)
      navigator.serviceWorker.addEventListener('message', e => {
        const { type, eventId, lat, lng, km } = e.data || {}
        if (type === 'OPEN_EVENT' && eventId) {
          db.getEventById(eventId).then(ev => { if (ev) setSelEvent(ev) })
        }
        // Tapnięcie w digest przy otwartej karcie: wycentruj mapę na punkcie,
        // dla którego policzono liczbę z powiadomienia.
        if (type === 'OPEN_SPOT' && Number.isFinite(lat) && Number.isFinite(lng)) {
          db.trackClick('digest_open')
          goToSpot(lat, lng, Number.isFinite(km) ? kmToZoom(km, lat) : undefined)
        }
        // Read through the ref: this listener is installed once at boot, when
        // `session` is still null, so the captured value would never be a user.
        const current = sessionRef.current
        if (type === 'PUSH_SUBSCRIPTION_CHANGED' && current) {
          refreshPushSubscription(current.user.id)
        }
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reconcile push after login. Registers a delivery target only when the system
  // permission is ALREADY granted, so it can never raise a prompt at startup.
  // A missing permission is left alone and surfaces in the profile toggle as a
  // repairable mismatch. On native this is also what registers the FCM token for
  // people who never touch the toggle; delivery still depends on push_enabled.
  useEffect(() => {
    if (!session) return
    ensurePushRegistered(session.user.id)
  }, [session?.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register native FCM tap handler — an event push opens the event, a digest
  // centres the map on the spot its count was computed for.
  useEffect(() => {
    registerNativePushTapHandler({
      openEvent: (eventId) => {
        db.getEventById(eventId).then(ev => { if (ev) setDeepLinkEvent(ev) })
      },
      openSpot: (lat, lng, km) => {
        db.trackClick('digest_open')
        goToSpot(lat, lng, km != null ? kmToZoom(km, lat) : undefined)
      },
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Smart-link "layer 2": when a Universal Link (iOS) / App Link (Android) opens the app,
  // Capacitor delivers the tapped https URL via appUrlOpen *after* boot — window.location
  // never sees it. Parse it here and route the same way the web boot path does.
  useEffect(() => {
    if (!isNativePlatform()) return
    let remove: (() => void) | undefined
    CapApp.addListener('appUrlOpen', ({ url }) => {
      // Powrót z logowania OAuth otwartego w przeglądarce (Android + Apple).
      const oauth = parseOAuthCallback(url)
      if (oauth) {
        if (oauth.kind === 'error') {
          console.error('[appUrlOpen] oauth error:', oauth.message)
          showToast(i18n.t('auth.signInFailed'))
          return
        }
        db.completeOAuth(oauth.code).catch((e: unknown) => {
          console.error('[appUrlOpen] exchangeCodeForSession:', e)
          showToast(i18n.t('auth.signInFailed'))
        })
        return
      }
      let parsed: URL
      try { parsed = new URL(url) } catch { return }
      const p = parsed.searchParams
      const eventId = p.get('event')
      if (eventId) {
        setScreen('map') // the deepLinkEvent effect opens it once the map is ready
        db.getEventById(eventId).then(ev => { if (ev) setDeepLinkEvent(ev) })
        return
      }
      const lat = parseFloat(p.get('lat') ?? '')
      const lng = parseFloat(p.get('lng') ?? '')
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      if (p.get('src') === 'digest') db.trackClick('digest_open')
      // km (digest) wins over zoom: it names a distance, and only this device
      // knows what zoom shows that distance on its screen.
      const km = parseFloat(p.get('km') ?? '')
      const z = parseInt(p.get('zoom') ?? '', 10)
      goToSpot(lat, lng, Number.isFinite(km) ? kmToZoom(km, lat) : Number.isFinite(z) ? z : undefined)
    }).then(handle => { remove = () => handle.remove() })
    return () => { remove?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Systemowy przycisk/gest wstecz (Android). Rejestracja listenera odbiera
  // Capacitorowi domyślną obsługę — i dobrze, bo od API 36 (predictive back)
  // domyślna ścieżka gubi kolejne naciśnięcia: pierwsze wstecz dawało popstate,
  // następne już nie. Warstwy zamyka nadal jeden handler popstate, tu tylko
  // wywołujemy history.back(). Na gołej mapie nie ma dokąd wracać: pierwsze
  // wstecz podpowiada, drugie w ciągu 4 s minimalizuje apkę.
  // iOS pomijamy — nie ma tam systemowego wstecz wychodzącego z aplikacji,
  // a minimalizacja z kodu jest zabroniona (prywatne API = odrzucenie w App Store).
  useEffect(() => {
    if (!isAndroid()) return
    let remove: (() => void) | undefined
    CapApp.addListener('backButton', () => {
      const s = navLayersRef.current
      const layerOpen = !!(s.authModal || s.selEvent || s.myEventSelected || s.followedEventSelected ||
        s.createOpen || s.accountOpen || s.profileOpen ||
        s.screen === 'myEvents' || s.screen === 'followedEvents')
      if (layerOpen) { window.history.back(); return }
      if (backExitRef.current.press()) { CapApp.minimizeApp(); return }
      showToast(i18n.t('map.backAgainToExit'), BACK_EXIT_WINDOW_MS)
    }).then(handle => { remove = () => handle.remove() })
    return () => { remove?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Center the map on a spot. Sets it as MapScreen's initial view (cold open) and also flies
  // there imperatively (warm open, map already mounted). Retries the fly until the map exists.
  function goToSpot(lat: number, lng: number, zoom?: number) {
    if (zoom != null) setInitialMapZoom(zoom)
    setUrlSpot({ lat, lng })
    setScreen('map')
    const tryFly = () => {
      if (flySpotRef.current) flySpotRef.current(lat, lng, zoom ?? 16)
      else setTimeout(tryFly, 150)
    }
    setTimeout(tryFly, 120)
  }

  // First launch only (no cached position): fetch a coarse IP-based center so the
  // map doesn't fall back to Warsaw while GPS warms up. Non-blocking; GPS overrides.
  // The result is cached to meuwe_last_pos so later launches start warm.
  useEffect(() => {
    if (lastKnownPos) return
    let cancelled = false
    getIpLocation().then(res => {
      if (cancelled || !res) return
      const pos = { lat: res.lat, lng: res.lng }
      setIpPos(pos)
      try { localStorage.setItem('meuwe_last_pos', JSON.stringify(pos)) } catch {}
    })
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Aktualizuj lokalizację w profilu co 5 minut gdy zalogowany
  // (Edge Functions jej potrzebują do filtrowania "w okolicy")
  useEffect(() => {
    if (!session || !userPos) return
    // Zapisz natychmiast przy pierwszym GPS fix
    db.updateProfileLocation(session.user.id, userPos.lat, userPos.lng)
    const interval = setInterval(() => {
      db.updateProfileLocation(session.user.id, userPos.lat, userPos.lng)
    }, 5 * 60_000)
    return () => clearInterval(interval)
  }, [session?.user.id, !!userPos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist the user's UI language so edge functions can localize push notifications.
  useEffect(() => {
    if (!session) return
    const write = () => db.updateProfileLanguage(session.user.id, i18n.language)
    write()
    i18n.on('languageChanged', write)
    return () => { i18n.off('languageChanged', write) }
  }, [session?.user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial routing once session is resolved
  useEffect(() => {
    if (!ready || screen !== 'loading') return
    if (deepLinkIdRef.current) { setScreen('map'); return }
    if (urlSpotRef.current) {
      if (urlSpotRef.current.zoom != null) setInitialMapZoom(urlSpotRef.current.zoom)
      setScreen('map'); return
    }
    if (session) {
      try {
        const raw = localStorage.getItem(NAV_KEY)
        if (raw) {
          const saved = JSON.parse(raw)
          localStorage.removeItem(NAV_KEY)
          if (Date.now() - saved.ts < NAV_TTL && (saved.screen === 'myEvents' || saved.screen === 'followedEvents')) {
            navRestoredRef.current = true
            if (saved.myEventId) {
              db.getEventById(saved.myEventId).then(ev => { setMyEventSelected(ev || null); setScreen(saved.screen) })
            } else if (saved.followedEventId) {
              db.getEventById(saved.followedEventId).then(ev => { setFollowedEventSelected(ev || null); setScreen(saved.screen) })
            } else {
              setScreen(saved.screen)
            }
            return
          }
        }
      } catch {}
      goToMap(); return
    }
    setScreen('welcome')
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Login → map (skipped when restoring saved nav state).
  // Also recovers a deep-link event that was saved to sessionStorage before OAuth redirect.
  useEffect(() => {
    if (!session) return
    const pendingId = sessionStorage.getItem('pending_event')
    if (pendingId) {
      sessionStorage.removeItem('pending_event')
      db.getEventById(pendingId).then(ev => { if (ev) setDeepLinkEvent(ev) })
    }
    if (!navRestoredRef.current) goToMap()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Opens the map, then works out how far to zoom and applies it.
   *
   * It used to await up to two full getEvents calls before the map was even
   * shown, so a slow connection held the user on the previous screen for the
   * whole round trip. The map now opens immediately at the widest sensible
   * view and tightens once the probe answers — moving in on something is a
   * readable gesture, and moving in on nothing costs nobody anything.
   */
  async function goToMap() {
    setScreen('map')
    window.history.replaceState({ layer: 'map' }, '')

    // Only a real fix earns a computed zoom. An IP guess is city-level accurate,
    // so framing it tightly around "the nearest event" would be confident about
    // a centre we are not confident about; MapScreen keeps its coarse IP_ZOOM
    // for that case.
    const pos = userPos || lastKnownPos
    if (!pos) return
    const events = await db.probeNearby(pos.lat, pos.lng)
    if (events === null) return // query failed; leave the view where it is
    const { nearestKm } = summariseProbe(events, {
      lat: pos.lat, lng: pos.lng, viewKm: MAX_MAP_KM, now: new Date(),
    })
    startupZoomRef.current = startupZoom(nearestKm, pos.lat)
    setInitialMapZoom(startupZoomRef.current)
    flySpotRef.current?.(pos.lat, pos.lng, startupZoomRef.current)
  }

  function showToast(msg: string, ms = 2600) {
    setToast(msg)
    // Bez czyszczenia poprzedniego timera dłuższy komunikat zniknąłby wcześniej,
    // bo zamknąłby go timer wcześniejszego toasta.
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), ms)
  }

  // Logowanie natywne rzuca wyjątkiem (brak idToken, błąd Firebase, brak
  // uprawnienia), a webowe zwraca `error` w odpowiedzi. Dotąd nikt tego nie
  // odbierał, więc nieudana próba kończyła się ciszą — użytkownik widział
  // martwy przycisk i nie miał pojęcia, co poszło nie tak.
  function startSignIn(provider: 'google' | 'apple') {
    db.trackClick(provider === 'apple' ? 'signin_apple' : 'signin_google')
    if (deepLinkIdRef.current) sessionStorage.setItem('pending_event', deepLinkIdRef.current)
    Promise.resolve(provider === 'apple' ? db.signInApple() : db.signInGoogle())
      .then(res => {
        const err = (res as { error?: { message?: string } } | void)?.error
        if (err) throw new Error(err.message ?? 'sign-in returned an error')
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[signIn:${provider}]`, msg)
        // Zamknięcie arkusza przez użytkownika to nie awaria.
        if (/cancel/i.test(msg)) return
        showToast(t('auth.signInFailed'))
      })
  }

  // Never two dialogs at once: each step hands over only once its own card is
  // gone. location → interests → invite, and each is offered exactly once.
  function finishLocationStep() {
    onboardingRef.current = { ...onboardingRef.current, locationDone: true }
    writeOnboardingState(onboardingRef.current)
    setLocationModalOpen(false)
    // The interests step needs an account to write to; a guest goes straight to
    // the invite and is asked after signing in (see the effect below).
    if (session && !onboardingRef.current.interestsDone) {
      setTimeout(() => { void openInterestsStep() }, 900)
      return
    }
    offerInvite()
  }

  // The radius is not a question any more: it is twice the distance to the
  // nearest thing happening, worked out here so the card can just state the
  // outcome. A failed lookup is not fatal — radiusFromNearest(null) opens up to
  // the widest setting, which is the safe direction for someone with nothing
  // nearby.
  async function openInterestsStep() {
    const pos = userPos || lastKnownPos || ipPos
    let nearestKm: number | null = null
    if (pos) {
      try {
        const nearby = await db.getEvents(pos.lat, pos.lng, MAX_ONBOARDING_RADIUS_KM, 0)
        if (nearby.length > 0) {
          nearestKm = nearby.reduce((a, b) => a.distKm < b.distKm ? a : b).distKm
        }
      } catch (err) {
        console.error('[onboarding] nearest-event lookup failed:', err)
      }
    }
    setInterestsRadiusKm(radiusFromNearest(nearestKm))
    setInterestsModalOpen(true)
  }

  function finishInterestsStep() {
    onboardingRef.current = { ...onboardingRef.current, interestsDone: true }
    writeOnboardingState(onboardingRef.current)
    setInterestsModalOpen(false)
    reloadProfile()
    offerInvite()
  }

  function offerInvite() {
    if (onboardingRef.current.inviteDone) return
    onboardingRef.current = { ...onboardingRef.current, inviteDone: true }
    writeOnboardingState(onboardingRef.current)
    setTimeout(() => setInviteModalOpen(true), 900)
  }

  async function handleAllowLocation() {
    try {
      const res = await Geolocation.requestPermissions()
      const ok = res.location === 'granted' || res.coarseLocation === 'granted'
      setNativeGeoAllowed(ok)
      // A refusal is stated, not hidden: the map keeps working on the fallback
      // chain and the toast says where to change it later.
      if (!ok) showToast(t('onboarding.locationDenied'))
    } catch (err) {
      console.error('[geo] requestPermissions failed:', err)
      showToast(t('onboarding.locationDenied'))
    }
    finishLocationStep()
  }

  async function handleSignOut() {
    await db.signOut()
    try { localStorage.removeItem('meuwe_last_pos') } catch {}
    setScreen('welcome')
    window.history.replaceState({ layer: 'welcome' }, '')
  }

  // The account is already gone server-side and the local session was cleared
  // by deleteAccount(); this only puts the UI back where a signed-out person
  // belongs.
  function handleAccountDeleted() {
    setAccountOpen(false)
    setProfileOpen(false)
    setSelEvent(null)
    setScreen('welcome')
    window.history.replaceState({ layer: 'welcome' }, '')
    showToast(t('account.deleted'))
  }

  function handleEdit(ev: EventWithMeta) {
    // Edit is launched from EventSheet, which can live in the MyEvents/Followed
    // overlays where CreateSheet is gated `!isOverlay`. Route every edit through
    // the map context so the single mounted CreateSheet is usable and we can
    // re-open the updated event afterward.
    setSelEvent(null); setMyEventSelected(null); setFollowedEventSelected(null)
    setProfileOpen(false)
    setScreen('map')
    setEditingEvent(ev)
    setCreatePos({ lat: ev.lat, lng: ev.lng })
    setLocationPicked(true)
    setCreateOpen(true)
    window.history.replaceState({ layer: 'create' }, '')
  }

  function handleSubmit(_data: unknown) {
    setCreateOpen(false)
    setCreatePos(null)
    setLocationPicked(false)
    setEventsRefreshKey(k => k + 1)
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 900)
    showToast(t('create.added'))
    track.createEvent('')
    // Someone who just put an event on the map has the clearest reason to want
    // to hear about the ones around it.
    updatePushAsk(pushAsk.recordCreate)
  }

  // Animated launch splash covers the boot (session resolves behind it), then reveals the app.
  if (showSplash) return <AnimatedSplash onDone={() => setShowSplash(false)} />

  // Loading screen — faithful port of prototype lines 1077-1089
  if (screen === 'loading') return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: C.cream, gap: 20,
    }}>
      <div style={{
        fontFamily: F.display, fontWeight: 900, fontSize: 56,
        letterSpacing: -2, lineHeight: 1, display: 'flex',
      }}>
        <span style={{ color: C.primary }}>me</span>
        <span style={{ color: C.sky }}>u</span>
        <span style={{ color: C.grass }}>we</span>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid rgba(255,122,69,0.25)', borderTopColor: C.primary,
        animation: 'spin 0.9s linear infinite',
      }} />
    </div>
  )

  if (screen === 'welcome') {
    const signIn = (mode: 'google' | 'apple' | 'skip') => {
      if (mode === 'skip') { goToMap(); return }
      startSignIn(mode)
    }
    if (isNativePlatform()) return <Welcome onSignIn={signIn} />
    return <Landing onSignIn={signIn} />
  }

  const isMyEvents = screen === 'myEvents'
  const isFollowedEvents = screen === 'followedEvents'
  const isOverlay = isMyEvents || isFollowedEvents

  // Single MapScreen instance shared between 'map' and 'myEvents' to prevent remount on screen switch
  return (
    <>
      <MapScreen
        session={session}
        profile={profile}
        onMapClick={() => { if (!isOverlay) { setSelEvent(null); setCreateOpen(false); setProfileOpen(false) } }}
        onRegisterFlyTo={fn => { flyToFnRef.current = fn }}
        onRegisterFlyToSpot={fn => { flySpotRef.current = fn }}
        onOpenProfile={() => {
          if (!isOverlay) {
            setProfileOpen(true); setSelEvent(null); setCreateOpen(false)
            window.history.pushState({ layer: 'profile' }, '')
          }
        }}
        unreadMenu={unread.hasAny}
        onOpenCreate={() => {
          if (!isOverlay) {
            setSelEvent(null); setProfileOpen(false); setCreateOpen(true)
            window.history.pushState({ layer: 'create' }, '')
          }
        }}
        onOpenEvent={ev => {
          if (!isOverlay) {
            setSelEvent(ev); setCreateOpen(false); setProfileOpen(false)
            window.history.pushState({ layer: 'event' }, '')
          }
        }}
        onAuthNeeded={() => { setAuthModal('event'); window.history.pushState({ layer: 'auth' }, '') }}
        userPos={userPos}
        lastKnownPos={lastKnownPos}
        ipPos={ipPos}
        initialZoom={initialMapZoom}
        initialCenter={urlSpot}
        eventsRefreshKey={eventsRefreshKey}
        pickingLocation={pickingLocation && !isOverlay}
        onLocationPicked={pos => {
          setCreatePos(pos)
          setLocationPicked(true)
          setPickingLocation(false)
          setCreateOpen(true)
        }}
      />

      {/* MyEvents overlay */}
      {isMyEvents && !myEventSelected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <MyEventsScreen
            session={session}
            onBack={() => window.history.back()}
            onOpenEvent={ev => {
              setMyEventSelected({ ...ev, distKm: 0, distStr: '' })
              flyToFnRef.current?.(ev.lat, ev.lng)
              window.history.pushState({ layer: 'event' }, '')
            }}
            isUnread={unread.isUnread}
          />
        </div>
      )}

      {/* EventSheet — from MyEvents, FollowedEvents, or from map */}
      {isMyEvents && myEventSelected && (
        <EventSheet
          event={myEventSelected}
          onClose={() => window.history.back()}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(myEventSelected.lat, myEventSelected.lng)}
          onAuthNeeded={() => { setAuthModal('event'); window.history.pushState({ layer: 'auth' }, '') }}
          onChatAuthNeeded={() => setAuthModal('chat')}
          onEdit={handleEdit}
          onProfileChanged={reloadProfile}
        />
      )}
      {isFollowedEvents && followedEventSelected && (
        <EventSheet
          event={followedEventSelected}
          onClose={() => window.history.back()}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(followedEventSelected.lat, followedEventSelected.lng)}
          onAuthNeeded={() => { setAuthModal('event'); window.history.pushState({ layer: 'auth' }, '') }}
          onChatAuthNeeded={() => setAuthModal('chat')}
          onEdit={handleEdit}
          onProfileChanged={reloadProfile}
        />
      )}
      {!isOverlay && selEvent && (
        <EventSheet
          event={selEvent}
          onClose={() => window.history.back()}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(selEvent.lat, selEvent.lng)}
          onAuthNeeded={() => { setAuthModal('event'); window.history.pushState({ layer: 'auth' }, '') }}
          onChatAuthNeeded={() => setAuthModal('chat')}
          onEdit={handleEdit}
          onProfileChanged={reloadProfile}
        />
      )}

      {/* FollowedEvents overlay */}
      {isFollowedEvents && !followedEventSelected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <FollowedEventsScreen
            session={session}
            onBack={() => window.history.back()}
            onOpenEvent={ev => {
              setFollowedEventSelected({ ...ev, distKm: 0, distStr: '' })
              flyToFnRef.current?.(ev.lat, ev.lng)
              window.history.pushState({ layer: 'event' }, '')
            }}
            isUnread={unread.isUnread}
          />
        </div>
      )}

      <CreateSheet
        open={createOpen && !isOverlay}
        onClose={() => window.history.back()}
        onSubmit={handleSubmit}
        defaultPos={createPos || userPos}
        locationPicked={locationPicked}
        onPickLocation={() => { setCreateOpen(false); setPickingLocation(true) }}
        editEvent={editingEvent}
        onUpdated={(updated) => {
          setEditingEvent(null)
          setCreateOpen(false)
          setCreatePos(null)
          setLocationPicked(false)
          setEventsRefreshKey(k => k + 1)
          setSelEvent(updated)
          flyToFnRef.current?.(updated.lat, updated.lng)
          showToast(t('edit.updated'))
          track.editEvent(updated.id)
        }}
      />
      <Toast visible={!!toast} label={toast || ''} />
      <ProfilePanel
        open={profileOpen && !isOverlay}
        onClose={() => window.history.back()}
        session={session}
        profile={profile}
        onSignOut={handleSignOut}
        reloadProfile={reloadProfile}
        onOpenAccount={() => {
          setAccountOpen(true)
          window.history.pushState({ layer: 'account' }, '')
        }}
        onOpenMyEvents={() => {
          setProfileOpen(false); setScreen('myEvents')
          window.history.pushState({ layer: 'myEvents' }, '')
        }}
        onOpenFollowedEvents={() => {
          setProfileOpen(false); setScreen('followedEvents')
          window.history.pushState({ layer: 'followedEvents' }, '')
        }}
        myEventsUnread={unread.hasOwned}
        followedUnread={unread.hasFollowed}
      />
      <ConfettiBurst visible={showConfetti} />
      {promoOpen && promoOs && (
        <AppPromoSheet os={promoOs} onClose={dismissPromo} />
      )}
      <AccountPanel
        open={accountOpen && !isOverlay}
        onClose={() => window.history.back()}
        onDeleted={handleAccountDeleted}
        currentName={profile?.name_shown || profile?.display_name || session?.user.email?.split('@')[0] || ''}
        onNicknameSaved={() => { reloadProfile(); showToast(t('account.nicknameSaved')) }}
      />
      {locationModalOpen && (
        <LocationOnboardingModal onAllow={handleAllowLocation} onSkip={finishLocationStep} />
      )}
      {interestsModalOpen && session && (
        <InterestsOnboardingModal
          userId={session.user.id}
          radiusKm={interestsRadiusKm}
          initial={(profile?.name_shown || profile?.display_name || session.user.email || '?')[0]}
          onDone={finishInterestsStep}
        />
      )}
      {inviteModalOpen && (
        <InviteFriendsModal onClose={() => setInviteModalOpen(false)} />
      )}
      {pushAskOpen && session && (
        <PushAskModal
          userId={session.user.id}
          onEnabled={() => {
            setPushAskOpen(false)
            reloadProfile()
            showToast(t('followNotify.enabled'))
          }}
          onDecline={() => {
            updatePushAsk(s => pushAsk.markDeclined(s, Date.now()))
            setPushAskOpen(false)
            // A refusal can still have written something — the card records the
            // wish when the system prompt is denied, so the profile can offer
            // the repair. Without this reload the menu kept showing the state
            // from before the card was ever opened.
            reloadProfile()
          }}
        />
      )}
      {authModal && (
        <div
          onClick={() => window.history.back()}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(45,43,42,0.35)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 0 32px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.cream,
              borderRadius: 28, border: `2.5px solid ${C.ink}`,
              boxShadow: `0 6px 0 ${C.ink}22`,
              padding: '32px 24px 28px', width: 'calc(100% - 32px)', maxWidth: 400,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 52, lineHeight: 1, display: 'flex', alignItems: 'baseline' }}>
              <span style={{ color: C.primary }}>me</span>
              <span style={{ color: C.sky }}>u</span>
              <span style={{ color: C.grass }}>we</span>
            </div>
            <p style={{ margin: 0, fontFamily: F.body, fontWeight: 600, fontSize: 16, color: C.ink, lineHeight: 1.5, maxWidth: 260 }}>
              {authModal === 'chat' ? t('auth.chatPrompt') : t('auth.createEventPrompt')}
            </p>
            <button
              onClick={() => {
                setAuthModal(null)
                startSignIn('google')
              }}
              style={{
                width: '100%', padding: '16px 24px', borderRadius: 999,
                background: '#fff', border: `2.5px solid ${C.ink}`, boxShadow: `0 4px 0 ${C.ink}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                fontSize: 16, fontWeight: 700, color: C.ink, cursor: 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4C13 4 4 13 4 24s9 20 20 20s20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
                <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.5 2.4c-5.2 0-9.6-3.3-11.3-8L6.1 32.8C9.4 39.5 16.1 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5c-.5.4 7.4-5.4 7.4-15.2c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              {t('welcome.google')}
            </button>
            {/* Same button as Welcome.tsx: black fill, white Apple mark, official
                wording — Apple requires Sign in with Apple wherever Google is offered. */}
            <button
              onClick={() => {
                setAuthModal(null)
                startSignIn('apple')
              }}
              style={{
                width: '100%', padding: '16px 24px', borderRadius: 999,
                background: '#000', border: `2.5px solid ${C.ink}`, boxShadow: `0 4px 0 ${C.ink}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                fontSize: 16, fontWeight: 700, color: '#fff', cursor: 'pointer',
                marginTop: -8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 384 512" fill="#fff" aria-hidden="true">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              {t('welcome.apple')}
            </button>
            {/* Only on a phone whose store listing exists — nothing on desktop,
                nothing inside the app, nothing while the App Store URL is empty. */}
            <StoreHint />
            <button
              onClick={() => window.history.back()}
              style={{ background: 'none', border: 'none', color: C.inkSoft, fontSize: 14, cursor: 'pointer', fontWeight: 700, fontFamily: F.body }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
