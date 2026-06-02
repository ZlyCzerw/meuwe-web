import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from '../lib/supabase'
import { applyIncomingMessage, type UnreadState } from '../lib/unread'

export function useUnreadEvents(session: Session | null, openEventId: string | null) {
  const [unread, setUnread] = useState<UnreadState>({})
  const ctxRef = useRef({ followedIds: new Set<string>(), ownedIds: new Set<string>() })
  const openRef = useRef<string | null>(openEventId)
  const me = session?.user.id ?? null

  // Keep openRef in sync without triggering re-renders
  useEffect(() => { openRef.current = openEventId }, [openEventId])

  const reconcile = useCallback(async () => {
    if (!me) { setUnread({}); return }
    const [rows, ctx] = await Promise.all([db.getUnreadEventIds(), db.getNotifContext()])
    ctxRef.current = { followedIds: new Set(ctx.followedIds), ownedIds: new Set(ctx.ownedIds) }
    const next: UnreadState = {}
    for (const r of rows) if (r.eventId !== openRef.current) next[r.eventId] = { isOwner: r.isOwner }
    setUnread(next)
  }, [me])

  // Initial load + whenever the logged-in user changes
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile is async; setState fires after the effect body returns
  useEffect(() => { reconcile() }, [reconcile])

  // Live: global message inserts → reducer
  useEffect(() => {
    if (!me) return
    const ch = db.subscribeAllMessages(m => {
      setUnread(prev => applyIncomingMessage(prev, m, {
        me,
        followedIds: ctxRef.current.followedIds,
        ownedIds: ctxRef.current.ownedIds,
        openEventId: openRef.current,
      }))
    })
    return () => db.unsub(ch)
  }, [me])

  // Reconcile when the app returns to the foreground (drops ended, fixes drift)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') reconcile() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [reconcile])

  const markRead = useCallback((id: string) => {
    setUnread(prev => {
      if (!prev[id]) return prev
      const n = { ...prev }
      delete n[id]
      return n
    })
    db.markEventRead(id)
  }, [])

  // Mark the open event read on open, and again on close (covers messages seen
  // while viewing). The open event never accrues a dot (reducer + reconcile skip it).
  useEffect(() => {
    if (!openEventId || !me) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mark-read on event open/close
    markRead(openEventId)
    return () => { markRead(openEventId) }
  }, [openEventId, me, markRead])

  const hasOwned = Object.values(unread).some(v => v.isOwner)
  const hasFollowed = Object.values(unread).some(v => !v.isOwner)
  const isUnread = useCallback((id: string) => !!unread[id], [unread])

  return {
    hasAny: Object.keys(unread).length > 0,
    hasOwned,
    hasFollowed,
    isUnread,
    markRead,
  }
}
