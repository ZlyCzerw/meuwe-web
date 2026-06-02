import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from './hooks/useSession'
import { C, F } from './lib/tokens'
import { db } from './lib/supabase'
import { refineLangByGeo } from './lib/i18n'
import { registerServiceWorker, refreshPushSubscription } from './lib/push'
import type { EventWithMeta } from './lib/types'
import Welcome from './screens/Welcome'
import MapScreen from './screens/MapScreen'
import EventSheet from './screens/EventSheet'
import CreateSheet from './screens/CreateSheet'
import Toast from './components/Toast'
import ProfilePanel from './screens/ProfilePanel'
import ConfettiBurst from './components/ConfettiBurst'
import MyEventsScreen from './screens/MyEventsScreen'
import FollowedEventsScreen from './screens/FollowedEventsScreen'
import { useUnreadEvents } from './hooks/useUnreadEvents'

type Screen = 'loading' | 'welcome' | 'map' | 'myEvents' | 'followedEvents'

export default function App() {
  const { t } = useTranslation()
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
  const [selEvent, setSelEvent] = useState<EventWithMeta | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [myEventSelected, setMyEventSelected] = useState<EventWithMeta | null>(null)
  const [followedEventSelected, setFollowedEventSelected] = useState<EventWithMeta | null>(null)
  const [pickingLocation, setPickingLocation] = useState(false)
  const [createPos, setCreatePos] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPicked, setLocationPicked] = useState(false)
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [deepLinkEvent, setDeepLinkEvent] = useState<EventWithMeta | null>(null)
  const [initialMapZoom, setInitialMapZoom] = useState(15)
  const flyToFnRef = useRef<((lat: number, lng: number) => void) | null>(null)
  const openEventId = selEvent?.id ?? myEventSelected?.id ?? followedEventSelected?.id ?? null
  const unread = useUnreadEvents(session, openEventId)

  // On mount: check ?event=<id> deep link
  useEffect(() => {
    const eventId = new URLSearchParams(window.location.search).get('event')
    if (!eventId) return
    window.history.replaceState({}, '', '/')
    db.getEventById(eventId).then(ev => { if (ev) setDeepLinkEvent(ev) })
  }, [])

  // Open deep link event once map is ready
  useEffect(() => {
    if (screen !== 'map' || !deepLinkEvent) return
    setSelEvent(deepLinkEvent)
    setDeepLinkEvent(null)
    const ev = deepLinkEvent
    const tryFly = () => {
      if (flyToFnRef.current) flyToFnRef.current(ev.lat, ev.lng)
      else setTimeout(tryFly, 150)
    }
    setTimeout(tryFly, 100)
  }, [screen, deepLinkEvent]) // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: refine language by geo and watch position
  useEffect(() => {
    refineLangByGeo()
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      p => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        try { localStorage.setItem('meuwe_last_pos', JSON.stringify(pos)) } catch {}
        setUserPos(pos)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // Rejestruj service worker przy starcie
  useEffect(() => {
    registerServiceWorker().then(reg => {
      if (!reg) return
      // Nasłuchuj wiadomości od SW (OPEN_EVENT, PUSH_SUBSCRIPTION_CHANGED)
      navigator.serviceWorker.addEventListener('message', e => {
        const { type, eventId } = e.data || {}
        if (type === 'OPEN_EVENT' && eventId) {
          db.getEventById(eventId).then(ev => { if (ev) setSelEvent(ev) })
        }
        if (type === 'PUSH_SUBSCRIPTION_CHANGED' && session) {
          refreshPushSubscription(session.user.id)
        }
      })
    })
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

  // Initial routing once session is resolved
  useEffect(() => {
    if (!ready || screen !== 'loading') return
    const hasDeepLink = !!new URLSearchParams(window.location.search).get('event')
    if (hasDeepLink) { setScreen('map'); return }
    if (session) { goToMap(); return }
    setScreen('welcome')
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Login → map
  useEffect(() => {
    if (session) goToMap()
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  // Visible half-width on portrait phone = shorter screen edge / 2.
  // Solve: (shortPx/2) × 40075 × cos(lat) / (256 × 2^Z) = targetKm
  function kmToZoom(targetKm: number, lat: number): number {
    const shortPx = Math.min(window.innerWidth, window.innerHeight)
    const cosLat = Math.cos(lat * Math.PI / 180)
    const z = Math.log2((shortPx / 2) * 40075 * cosLat / (256 * targetKm))
    return Math.max(9, Math.min(15, Math.round(z)))
  }

  async function goToMap() {
    const pos = userPos || lastKnownPos
    const maxKm = profile?.radius_km ?? 30
    let zoom = 15
    if (pos) {
      const nearby = await db.getEvents(pos.lat, pos.lng, 15, 0)
      if (nearby.length === 0) {
        const wider = await db.getEvents(pos.lat, pos.lng, maxKm, 0)
        if (wider.length === 0) {
          zoom = kmToZoom(maxKm, pos.lat)
        } else {
          const nearest = wider.reduce((a, b) => a.distKm < b.distKm ? a : b)
          zoom = kmToZoom(Math.min(nearest.distKm * 2, maxKm), pos.lat)
        }
      }
    }
    setInitialMapZoom(zoom)
    setScreen('map')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  async function handleSignOut() {
    await db.signOut()
    try { localStorage.removeItem('meuwe_last_pos') } catch {}
    setScreen('welcome')
  }

  function handleSubmit(_data: unknown) {
    setCreateOpen(false)
    setCreatePos(null)
    setLocationPicked(false)
    setEventsRefreshKey(k => k + 1)
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 900)
    showToast(t('create.added'))
  }

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

  if (screen === 'welcome') return (
    <Welcome onSignIn={mode => {
      if (mode === 'skip') { goToMap(); return }
      db.signInGoogle()
    }} />
  )

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
        onOpenProfile={() => { if (!isOverlay) { setProfileOpen(true); setSelEvent(null); setCreateOpen(false) } }}
        unreadMenu={unread.hasAny}
        onOpenCreate={() => { if (!isOverlay) { setSelEvent(null); setProfileOpen(false); setCreateOpen(true) } }}
        onOpenEvent={ev => { if (!isOverlay) { setSelEvent(ev); setCreateOpen(false); setProfileOpen(false) } }}
        onAuthNeeded={() => setAuthModalOpen(true)}
        userPos={userPos}
        lastKnownPos={lastKnownPos}
        initialZoom={initialMapZoom}
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
            onBack={() => { setScreen('map'); setMyEventSelected(null) }}
            onOpenEvent={ev => {
              setMyEventSelected({ ...ev, distKm: 0, distStr: '' })
              flyToFnRef.current?.(ev.lat, ev.lng)
            }}
            isUnread={unread.isUnread}
          />
        </div>
      )}

      {/* EventSheet — from MyEvents, FollowedEvents, or from map */}
      {isMyEvents && myEventSelected && (
        <EventSheet
          event={myEventSelected}
          onClose={() => setMyEventSelected(null)}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(myEventSelected.lat, myEventSelected.lng)}
          onAuthNeeded={() => setAuthModalOpen(true)}
        />
      )}
      {isFollowedEvents && followedEventSelected && (
        <EventSheet
          event={followedEventSelected}
          onClose={() => setFollowedEventSelected(null)}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(followedEventSelected.lat, followedEventSelected.lng)}
          onAuthNeeded={() => setAuthModalOpen(true)}
        />
      )}
      {!isOverlay && selEvent && (
        <EventSheet
          event={selEvent}
          onClose={() => setSelEvent(null)}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(selEvent.lat, selEvent.lng)}
          onAuthNeeded={() => setAuthModalOpen(true)}
        />
      )}

      {/* FollowedEvents overlay */}
      {isFollowedEvents && !followedEventSelected && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <FollowedEventsScreen
            session={session}
            onBack={() => { setScreen('map'); setFollowedEventSelected(null) }}
            onOpenEvent={ev => {
              setFollowedEventSelected({ ...ev, distKm: 0, distStr: '' })
              flyToFnRef.current?.(ev.lat, ev.lng)
            }}
            isUnread={unread.isUnread}
          />
        </div>
      )}

      <CreateSheet
        open={createOpen && !isOverlay}
        onClose={() => { setCreateOpen(false); setCreatePos(null); setLocationPicked(false) }}
        onSubmit={handleSubmit}
        defaultPos={createPos || userPos}
        locationPicked={locationPicked}
        onPickLocation={() => { setCreateOpen(false); setPickingLocation(true) }}
      />
      <Toast visible={!!toast} label={toast || ''} />
      <ProfilePanel
        open={profileOpen && !isOverlay}
        onClose={() => setProfileOpen(false)}
        session={session}
        profile={profile}
        onSignOut={handleSignOut}
        onSignIn={() => db.signInGoogle()}
        reloadProfile={reloadProfile}
        onOpenMyEvents={() => { setProfileOpen(false); setScreen('myEvents') }}
        onOpenFollowedEvents={() => { setProfileOpen(false); setScreen('followedEvents') }}
        myEventsUnread={unread.hasOwned}
        followedUnread={unread.hasFollowed}
      />
      <ConfettiBurst visible={showConfetti} />
      {authModalOpen && (
        <div
          onClick={() => setAuthModalOpen(false)}
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
              {t('auth.createEventPrompt')}
            </p>
            <button
              onClick={() => { setAuthModalOpen(false); db.trackClick('signin_google'); db.signInGoogle() }}
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
            <button
              onClick={() => setAuthModalOpen(false)}
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
