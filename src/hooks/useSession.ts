import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from '../lib/supabase'
import type { Profile } from '../lib/types'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    db.getSession().then(s => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      setReady(true)
    })
    const { data: { subscription } } = db.onAuthChange(s => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
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
