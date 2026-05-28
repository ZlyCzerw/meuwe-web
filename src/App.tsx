import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from './hooks/useSession'
import { C, F } from './lib/tokens'
import { db } from './lib/supabase'
import { refineLangByGeo } from './lib/i18n'
import { registerServiceWorker, refreshPushSubscription } from './lib/push'
import type { EventWithMeta, EventWithMsgCount } from './lib/types'
import Welcome from './screens/Welcome'
import MapScreen from './screens/MapScreen'
import EventSheet from './screens/EventSheet'
import CreateSheet from './screens/CreateSheet'
import Toast from './components/Toast'
import ProfilePanel from './screens/ProfilePanel'
import ConfettiBurst from './components/ConfettiBurst'
import MyEventsScreen from './screens/MyEventsScreen'

type Screen = 'loading' | 'welcome' | 'map' | 'myEvents'

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
  const [pickingLocation, setPickingLocation] = useState(false)
  const [createPos, setCreatePos] = useState<{ lat: number; lng: number } | null>(null)
  const [locationPicked, setLocationPicked] = useState(false)
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0)
  const flyToFnRef = useRef<((lat: number, lng: number) => void) | null>(null)

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
          // TODO: otworzyć event po ID — wymaga dodania db.getEventById
          // setSelEvent(...)
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
    if (ready && screen === 'loading') setScreen(session ? 'map' : 'welcome')
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Login → map
  useEffect(() => {
    if (session) setScreen('map')
  }, [session])

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
      if (mode === 'skip') { setScreen('map'); return }
      db.signInGoogle()
    }} />
  )

  const isMyEvents = screen === 'myEvents'

  // Single MapScreen instance shared between 'map' and 'myEvents' to prevent remount on screen switch
  return (
    <>
      <MapScreen
        session={session}
        profile={profile}
        onMapClick={() => { if (!isMyEvents) { setSelEvent(null); setCreateOpen(false); setProfileOpen(false) } }}
        onRegisterFlyTo={fn => { flyToFnRef.current = fn }}
        onOpenProfile={() => { if (!isMyEvents) { setProfileOpen(true); setSelEvent(null); setCreateOpen(false) } }}
        onOpenCreate={() => { if (!isMyEvents) { setSelEvent(null); setProfileOpen(false); setCreateOpen(true) } }}
        onOpenEvent={ev => { if (!isMyEvents) { setSelEvent(ev); setCreateOpen(false); setProfileOpen(false) } }}
        onAuthNeeded={() => setScreen('welcome')}
        userPos={userPos}
        lastKnownPos={lastKnownPos}
        eventsRefreshKey={eventsRefreshKey}
        pickingLocation={pickingLocation && !isMyEvents}
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
          />
        </div>
      )}

      {/* EventSheet — from MyEvents or from map */}
      {isMyEvents && myEventSelected && (
        <EventSheet
          event={myEventSelected}
          onClose={() => setMyEventSelected(null)}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(myEventSelected.lat, myEventSelected.lng)}
        />
      )}
      {!isMyEvents && selEvent && (
        <EventSheet
          event={selEvent}
          onClose={() => setSelEvent(null)}
          session={session}
          profile={profile}
          userPos={userPos}
          onLocate={() => flyToFnRef.current?.(selEvent.lat, selEvent.lng)}
        />
      )}

      <CreateSheet
        open={createOpen && !isMyEvents}
        onClose={() => { setCreateOpen(false); setCreatePos(null); setLocationPicked(false) }}
        onSubmit={handleSubmit}
        defaultPos={createPos || userPos}
        locationPicked={locationPicked}
        onPickLocation={() => { setCreateOpen(false); setPickingLocation(true) }}
      />
      <Toast visible={!!toast} label={toast || ''} />
      <ProfilePanel
        open={profileOpen && !isMyEvents}
        onClose={() => setProfileOpen(false)}
        session={session}
        profile={profile}
        onSignOut={handleSignOut}
        onSignIn={() => db.signInGoogle()}
        reloadProfile={reloadProfile}
        onOpenMyEvents={() => { setProfileOpen(false); setScreen('myEvents') }}
      />
      <ConfettiBurst visible={showConfetti} />
    </>
  )
}
