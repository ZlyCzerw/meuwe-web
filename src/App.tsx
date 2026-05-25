import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from './hooks/useSession'
import { C, F } from './lib/tokens'
import { db } from './lib/supabase'
import { refineLangByGeo } from './lib/i18n'
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
  const [selEvent, setSelEvent] = useState<EventWithMeta | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [myEventSelected, setMyEventSelected] = useState<EventWithMsgCount | null>(null)
  const [pickingLocation, setPickingLocation] = useState(false)
  const [createPos, setCreatePos] = useState<{ lat: number; lng: number } | null>(null)
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0)

  // On mount: refine language by geo and watch position
  useEffect(() => {
    refineLangByGeo()
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

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
    setScreen('welcome')
  }

  function handleSubmit(_data: unknown) {
    setCreateOpen(false)
    setCreatePos(null)
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

  if (screen === 'myEvents') return (
    <>
      <MyEventsScreen
        session={session}
        onBack={() => setScreen('map')}
        onOpenEvent={ev => {
          setMyEventSelected(ev)
          setScreen('map')
        }}
      />
      {myEventSelected && (
        <EventSheet
          event={myEventSelected}
          onClose={() => setMyEventSelected(null)}
          session={session}
          profile={profile}
        />
      )}
    </>
  )

  // map screen
  return (
    <>
      <MapScreen
        session={session}
        profile={profile}
        onOpenProfile={() => { setProfileOpen(true); setSelEvent(null) }}
        onOpenCreate={() => { setSelEvent(null); setCreateOpen(true) }}
        onOpenEvent={ev => { setSelEvent(ev); setCreateOpen(false); setProfileOpen(false) }}
        onAuthNeeded={() => setScreen('welcome')}
        userPos={userPos}
        eventsRefreshKey={eventsRefreshKey}
        pickingLocation={pickingLocation}
        onLocationPicked={pos => {
          setCreatePos(pos)
          setPickingLocation(false)
          setCreateOpen(true)
        }}
      />
      {selEvent && (
        <EventSheet
          event={selEvent}
          onClose={() => setSelEvent(null)}
          session={session}
          profile={profile}
        />
      )}
      <CreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleSubmit}
        defaultPos={createPos || userPos}
        onPickLocation={() => { setCreateOpen(false); setPickingLocation(true) }}
      />
      <Toast visible={!!toast} label={toast || ''} />
      <ProfilePanel
        open={profileOpen}
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
