import { useEffect, useState } from 'react'
import { useSession } from './hooks/useSession'
import { C, F } from './lib/tokens'
import { db } from './lib/supabase'
import { getCurrentPosition } from './lib/geo'
import { refineLangByGeo } from './lib/i18n'
import type { EventWithMeta } from './lib/types'
import Welcome from './screens/Welcome'

type Screen = 'loading' | 'welcome' | 'map'

export default function App() {
  const { session, profile, ready, reloadProfile } = useSession()

  const [screen, setScreen] = useState<Screen>('loading')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [selEvent, setSelEvent] = useState<EventWithMeta | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // On mount: refine language by geo and get position
  useEffect(() => {
    refineLangByGeo()
    getCurrentPosition().then(p => { if (p) setUserPos(p) })
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

  // map screen — placeholder (Stage 2 will replace this)
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: C.cream, color: C.inkSoft, fontWeight: 800,
      flexDirection: 'column', gap: 8,
    }}>
      <div>map placeholder — signed in: {String(!!session)}</div>
      <div style={{ fontSize: 12, fontWeight: 400 }}>
        pos: {userPos ? `${userPos.lat.toFixed(3)},${userPos.lng.toFixed(3)}` : 'acquiring…'}
        {' | '}
        profile: {profile?.display_name ?? 'none'}
      </div>
      {/* state wired for Stage 2/3/4 */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: C.primary, color: '#fff', padding: '10px 20px', borderRadius: 999, fontWeight: 700, fontSize: 14 }}>
          {toast}
        </div>
      )}
      {/* selEvent, createOpen, profileOpen, showToast, handleSignOut, reloadProfile consumed below to avoid TS unused-var errors */}
      <button
        style={{ display: 'none' }}
        onClick={() => {
          void selEvent
          void setSelEvent
          void createOpen
          void setCreateOpen
          void profileOpen
          void setProfileOpen
          showToast('test')
          handleSignOut()
          reloadProfile()
        }}
      />
    </div>
  )
}
