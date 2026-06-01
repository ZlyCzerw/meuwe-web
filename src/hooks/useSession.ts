import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from '../lib/supabase'
import type { Profile } from '../lib/types'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Fallback: if getSession() hangs (stale token + poor mobile network), unblock after 5s
    const fallback = setTimeout(() => setReady(true), 5000)

    db.getSession().then(s => {
      clearTimeout(fallback)
      setSession(s)
      if (s) loadProfile(s.user.id)
      setReady(true)
    })
    const { data: { subscription } } = db.onAuthChange(s => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => { subscription.unsubscribe(); clearTimeout(fallback) }
  }, [])

  async function loadProfile(uid: string) {
    setProfile(await db.getProfile(uid))
  }

  return {
    session,
    profile,
    ready,
    reloadProfile: () => { if (session) loadProfile(session.user.id) },
  }
}
