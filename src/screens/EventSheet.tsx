import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import DragHandle from '../components/DragHandle'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import Avatar from '../components/Avatar'
import StatusPill from '../components/StatusPill'
import TagChip from '../components/TagChip'
import { C, INK, F, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { db } from '../lib/supabase'
import { haversineKm } from '../lib/geo'
import { isNativePlatform } from '../lib/platform'
import { computeStatus } from '../lib/eventStatus'
import { authorLabel, authorInitial } from '../lib/authorLabel'
import { addToCalendar, type CalendarResult } from '../lib/calendar'
import CalendarChooserModal from '../components/CalendarChooserModal'
import { getDevicePushState } from '../lib/push'
import { resolvePushState } from '../lib/pushState'
import {
  readPushAskState, writePushAskState, recordFollow, isPushAskDue, canAskForPush,
  markAsked, markDeclined,
} from '../lib/pushAsk'
import FollowNotifyModal from '../components/FollowNotifyModal'
import type { EventWithMeta, Message } from '../lib/types'

type Snap = 'peek' | 'half' | 'full'

/** How long "another calendar" stays offered after an attempt. */
const CALENDAR_HINT_MS = 9000

const circleBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
  border: 'none', boxShadow: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'all 220ms cubic-bezier(0.34,1.56,0.64,1)',
}

const HEIGHTS: Record<Snap, string> = { peek: '130px', half: '56%', full: '93%' }

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE', sl: 'sl-SI' }

async function handleShare(event: { id: string; title: string }, showToast: () => void) {
  const origin = isNativePlatform() ? 'https://meuwe.eu' : window.location.origin
  const url = `${origin}/?event=${event.id}`
  track.share(event.id)
  if (navigator.share) {
    try {
      await navigator.share({ title: event.title, url })
    } catch { /* share dismissed or unsupported */ }
  } else {
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard unavailable */ }
    showToast()
  }
}

function EventSheet({
  event,
  onClose,
  session,
  profile,
  userPos,
  onLocate,
  onAuthNeeded,
  onChatAuthNeeded,
  onEdit,
  onProfileChanged,
}: {
  event: EventWithMeta
  onClose: () => void
  session: Session | null
  profile: { display_name: string | null; name_shown?: string | null; avatar_color: string | null; push_enabled?: boolean | null } | null
  userPos?: { lat: number; lng: number } | null
  onLocate?: () => void
  onAuthNeeded?: () => void
  onChatAuthNeeded?: () => void
  onEdit?: (event: EventWithMeta) => void
  /** Called after the follow flow changes push_enabled, so the app reloads it. */
  onProfileChanged?: () => void
}) {
  const { t, i18n } = useTranslation()
  const [snap, setSnap] = useState<Snap>('half')
  const [chatFocused, setChatFocused] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sendErr, setSendErr] = useState('')
  const [photoIdx, setPhotoIdx] = useState(0)
  const [photoModal, setPhotoModal] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [notifyReason, setNotifyReason] = useState<'ask' | 'blocked' | 'unsupported' | null>(null)
  // The card calls onEnabled and then onClose on the way out, so the close
  // handler has to know which of the two endings it is closing.
  const notifyEnabledRef = useRef(false)
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [calendarHint, setCalendarHint] = useState<'ok' | 'failed' | null>(null)
  const [calendarChooser, setCalendarChooser] = useState(false)
  const [followers, setFollowers] = useState<{ avatar_color: string | null; display_name: string | null }[]>([])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  // Needs no permission and behaves the same everywhere, so it is offered to
  // guests too — no session check.
  async function handleCalendar() {
    setCalendarBusy(true)
    db.trackClick('event_calendar')
    const result = await addToCalendar(event, { provider: authProvider })
    setCalendarBusy(false)
    settleCalendar(result)
  }

  /**
   * Says only what is known to have happened. 'handedOff' covers the system
   * screen on Android and a calendar site in a new tab — in both the story ends
   * somewhere we cannot see, and a toast claiming success would be a guess.
   */
  function settleCalendar(result: CalendarResult) {
    if (result === 'choose') { setCalendarChooser(true); return }
    setCalendarChooser(false)
    if (result === 'failed') {
      setCalendarHint('failed')
      showToast(t('calendar.failed'))
    } else {
      setCalendarHint('ok')
      if (result === 'added') showToast(t('calendar.added'))
      else if (result === 'downloaded') showToast(t('calendar.downloaded'))
    }
    setTimeout(() => setCalendarHint(null), CALENDAR_HINT_MS)
  }

  async function toggleFollow() {
    if (!session) { onAuthNeeded?.(); return }
    if (isFollowing) {
      setIsFollowing(false)
      await db.unfollowEvent(event.id)
    } else {
      setIsFollowing(true)
      track.followEvent(event.id)
      await db.followEvent(event.id)
      maybeAskForNotifications()
    }
  }

  // Following is only worth something if the news can reach you, and only when
  // this device would not deliver — never as a bare system prompt, always
  // through the modal that explains what it is for.
  //
  // The follow is one of four triggers now (see lib/pushAsk.ts) and shares one
  // ledger with the rest, so refusing here also holds off the other three. The
  // card still opens for a 'blocked' or 'unsupported' device because this is the
  // one place with a second answer: the calendar.
  async function maybeAskForNotifications() {
    if (!session) return
    const followed = recordFollow(readPushAskState())
    writePushAskState(followed)
    if (!isPushAskDue(followed, Date.now())) return
    const device = await getDevicePushState(session.user.id)
    const state = resolvePushState(!!profile?.push_enabled, device)
    if (!canAskForPush(followed, { pushState: state, canOfferFallback: true }, Date.now())) return
    writePushAskState(markAsked(readPushAskState(), Date.now()))
    notifyEnabledRef.current = false
    setNotifyReason(
      state === 'unsupported' ? 'unsupported'
        : state === 'blocked' ? 'blocked'
        : 'ask'
    )
  }

  /** Closing without turning them on is a refusal; it starts the cooldown. */
  function closeNotifyCard() {
    if (!notifyEnabledRef.current) writePushAskState(markDeclined(readPushAskState(), Date.now()))
    setNotifyReason(null)
  }
  const chanRef = useRef<ReturnType<typeof db.subscribeMessages> | null>(null)
  const followChanRef = useRef<ReturnType<typeof db.subscribeFollowers> | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)
  const touchStartY = useRef<number | null>(null)
  const lastSendRef = useRef<number>(0)

  // How the account signed in, which is how lib/calendarRoute knows whether the
  // calendar can be guessed at instead of asked about.
  const authProvider = (session?.user.app_metadata?.provider as string | undefined) ?? null

  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }

  const isFull = snap === 'full'
  const isPeek = snap === 'peek'
  const meta = TAG_META[event.category as Category] || TAG_META.party
  const loc = LOC_MAP[i18n.language] || 'en-US'

  const computedStatus = computeStatus(event, messages)

  const distStr = userPos
    ? (() => {
        const dk = haversineKm(userPos.lat, userPos.lng, event.lat, event.lng)
        return dk < 1 ? `${Math.round(dk * 1000)} m` : `${dk.toFixed(1)} km`
      })()
    : null

  useEffect(() => {
    if (!event?.id || !session) return
    db.isFollowingEvent(event.id).then(setIsFollowing)
  }, [event?.id, session])

  useEffect(() => {
    if (!event?.id) return
    db.getEventFollowers(event.id).then(setFollowers)
    db.unsub(followChanRef.current)
    followChanRef.current = db.subscribeFollowers(event.id, () => {
      db.getEventFollowers(event.id).then(setFollowers)
      db.isFollowingEvent(event.id).then(setIsFollowing)
    })
    return () => db.unsub(followChanRef.current)
  }, [event?.id])

  useEffect(() => {
    if (!event?.id) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset to half when a new event opens
    setSnap('half')
    db.getMessages(event.id).then(setMessages)
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeMessages(event.id, m => setMessages(p => [...p, m]))
    return () => db.unsub(chanRef.current)
  }, [event?.id])

  // Scroll the chat region to the newest message — both when expanding to full
  // and whenever a new message arrives while full. The card region above keeps
  // its own scroll position (independent).
  useEffect(() => {
    if (isFull && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isFull])

  // Reset scroll + photo when event opens or snap returns to half
  useEffect(() => {
    if (listRef.current && !isFull) listRef.current.scrollTop = 0
    if (!isFull) setChatFocused(false)
  }, [event?.id, isFull])

  // Reset photo index on new event
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when a new event opens
  useEffect(() => { setPhotoIdx(0) }, [event?.id])

  async function send() {
    if (!input.trim() || !session) return
    const now = Date.now()
    if (now - lastSendRef.current < 1500) return   // 1.5 s cooldown
    lastSendRef.current = now
    const text = input.trim()
    setInput('')
    setSendErr('')
    // Auto-follow when sending a message while not following
    if (!isFollowing) {
      setIsFollowing(true)
      db.followEvent(event.id)
    }
    // Nazwa wpisywana jest do wiadomości na stałe, więc bierzemy tę pokazywaną
    // dziś (nickname, a w jego braku nazwa od dostawcy). Starych wiadomości
    // zmiana nazwy nie dotyka — tak samo jak w każdym komunikatorze.
    const authorName =
      profile?.name_shown || profile?.display_name || session.user?.email?.split('@')[0] || '?'
    const authorColor = profile?.avatar_color || C.primary
    const result = await db.sendMessage(event.id, text, authorName, authorColor)
    if (result?.error) setSendErr(t('event.sendError'))
  }

  async function handleEndEvent() {
    const { error } = await db.endEvent(event.id)
    if (error) {
      console.error('endEvent failed:', error)
      return
    }
    onClose()
  }

  function onTS(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }
  function onTE(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null
    if (dy > 80) {
      if (snap === 'full') setSnap('half')
      else if (snap === 'half') setSnap('peek')
      else onClose()
    } else if (dy < -80) {
      if (snap === 'peek') setSnap('half')
      else if (snap === 'half') setSnap('full')
    }
  }

  if (!event) return null

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: HEIGHTS[snap],
      background: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
      boxShadow: '0 -8px 32px rgba(45,43,42,0.12)',
      transition: 'height 380ms cubic-bezier(0.32,1.4,0.4,1)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 40,
    }}>
      <div onTouchStart={onTS} onTouchEnd={onTE} style={{ flexShrink: 0, position: 'relative' }}>
        <DragHandle />
        <button
          onClick={() => {
            const next: Snap = snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'half'
            setSnap(next)
          }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32 }}
        />
      </div>

      {isPeek
        ? (
          <div style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <OrganicBlob size={42} color={meta.color} idx={0} face={<BlobFace size={28} />} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{event.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <StatusPill status={computedStatus} size="sm" />
                <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 700 }}>· {distStr}</span>
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%', background: C.cream,
              fontSize: 18, color: C.ink, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        )
        : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div
              ref={listRef}
              onClick={isFull ? () => setChatFocused(false) : undefined}
              style={isFull
                ? { flexShrink: 0, height: chatFocused ? '50%' : '70%', overflowY: 'auto', padding: '4px 20px 12px', transition: 'height 250ms ease' }
                : { flex: 1, overflowY: 'auto', padding: '4px 20px 0' }}
            >
              {/* Card content — shown in both half and full */}
              <>
                  {/* Followers bar */}
                  {followers.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ display: 'flex' }}>
                        {followers.slice(0, 3).map((f, i) => (
                          <div key={i} style={{
                            width: 26, height: 26, borderRadius: '50%',
                            background: f.avatar_color || C.primary,
                            border: `2.5px solid ${INK}`,
                            boxShadow: `0 2px 0 ${INK}33`,
                            marginLeft: i > 0 ? -8 : 0,
                            zIndex: 3 - i,
                            position: 'relative',
                            flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 900, color: INK,
                            fontFamily: F.display, letterSpacing: -0.3,
                          }}>
                            {(f.display_name || '?')[0].toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>
                        {followers.length <= 3
                          ? t(followers.length === 1 ? 'follow.followsThis' : 'follow.followThis')
                          : t(followers.length - 3 === 1 ? 'follow.othersFollowOne' : 'follow.othersFollowMany', { count: followers.length - 3 })}
                      </span>
                    </div>
                  )}

                  {/* Title + close */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.ink, lineHeight: 1.15, letterSpacing: -0.5 }}>{event.title}</div>
                    <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', background: C.cream, fontSize: 18, color: C.ink, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>

                  {/* Photo carousel — aligned with content width, rounded */}
                  {event.photos && event.photos.length > 0 && (
                    <div style={{ position: 'relative', margin: '0 0 16px' }}>
                      <img
                        src={event.photos[Math.min(photoIdx, event.photos.length - 1)]}
                        alt=""
                        onClick={() => setPhotoModal(photoIdx)}
                        style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block', cursor: 'pointer', borderRadius: 16 }}
                      />
                      {event.photos.length > 1 && (
                        <>
                          <button onClick={() => setPhotoIdx(i => Math.max(0, i - 1))} disabled={photoIdx === 0}
                            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, opacity: photoIdx === 0 ? 0.4 : 1 }}>‹</button>
                          <button onClick={() => setPhotoIdx(i => Math.min(event.photos!.length - 1, i + 1))} disabled={photoIdx === event.photos.length - 1}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, opacity: photoIdx === event.photos.length - 1 ? 0.4 : 1 }}>›</button>
                          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
                            {event.photos.map((_, i) => (
                              <div key={i} onClick={() => setPhotoIdx(i)} style={{ width: i === photoIdx ? 18 : 6, height: 6, borderRadius: 999, background: i === photoIdx ? '#fff' : 'rgba(255,255,255,0.55)', border: `1.5px solid ${INK}33`, transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)', cursor: 'pointer' }} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Status + time + Follow/Share row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    {/* Left: two info lines */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Line 1: status + time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <StatusPill status={computedStatus} />
                        {event.start_time && event.end_time && (
                          <span style={{ fontSize: 12, color: C.ink, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {new Date(event.start_time).toLocaleString(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            {' → '}
                            {new Date(event.end_time).toLocaleString(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      {/* Line 2: distance + trasa */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {distStr && (
                          <button onClick={onLocate} disabled={!onLocate} style={{ background: 'none', border: 'none', padding: 0, cursor: onLocate ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: C.primary, boxShadow: `0 0 0 3px ${C.primarySoft}` }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.primary, textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                              {t('event.distanceFrom', { dist: distStr })}
                            </span>
                          </button>
                        )}
                        {distStr && <span style={{ color: C.inkSoft, fontWeight: 700, fontSize: 13 }}>·</span>}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{t('event.directions')}</span>
                        </a>
                      </div>
                    </div>
                    {/* Right: Follow + Calendar + Share circles. 44 px, so three
                        of them still fit next to the distance column on a 360 px phone. */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                      <button
                        onClick={toggleFollow}
                        style={{ ...circleBtn, background: isFollowing ? C.primarySoft : C.cream }}
                        title={isFollowing ? t('follow.following') : t('follow.follow')}
                        aria-label={isFollowing ? t('follow.following') : t('follow.follow')}
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill={isFollowing ? C.primary : 'none'} stroke={isFollowing ? C.primary : INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                        </svg>
                      </button>
                      <button
                        onClick={handleCalendar}
                        disabled={calendarBusy}
                        style={{ ...circleBtn, background: C.cream, cursor: calendarBusy ? 'default' : 'pointer' }}
                        title={t('calendar.add')}
                        aria-label={t('calendar.add')}
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="5" width="18" height="16" rx="3"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                          <line x1="8" y1="3" x2="8" y2="7"/>
                          <line x1="16" y1="3" x2="16" y2="7"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleShare(event, () => showToast(t('share.linkCopied')))}
                        style={{ ...circleBtn, background: C.cream }}
                        title={t('share.share')}
                        aria-label={t('share.share')}
                      >
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 14 20 9 15 4"/>
                          <path d="M4 20v-7a4 4 0 014-4h12"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* The route we picked can still be the wrong one — a Google
                      account with an Outlook calendar, a phone whose calendar app
                      swallowed the hand-off. The way out stays offered for a while
                      after each attempt. */}
                  {calendarHint && (
                    <button
                      onClick={() => { setCalendarChooser(true); setCalendarHint(null) }}
                      style={{
                        display: 'block', margin: '-4px 0 12px auto', padding: '6px 12px',
                        borderRadius: 999, background: 'transparent', border: `2px solid ${INK}22`,
                        fontSize: 12, fontWeight: 700, color: C.ink, cursor: 'pointer',
                        animation: 'fadeIn 180ms ease',
                      }}
                    >
                      {t('calendar.other')}
                    </button>
                  )}

                  {/* Tags */}
                  {event.tags?.length > 0 && (() => {
                    const MAX = 3; const visible = event.tags.slice(0, MAX); const hidden = event.tags.length - MAX
                    return (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, overflow: 'hidden' }}>
                        {visible.map(tag => <TagChip key={tag} category={tag} selected />)}
                        {hidden > 0 && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 10px', borderRadius: 999, background: C.cream, border: `2.5px solid ${INK}`, boxShadow: `2px 2px 0 ${INK}`, fontSize: 12, fontWeight: 900, color: C.ink, position: 'relative', flexShrink: 0 }}>
                            +{hidden}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Creator — compact inline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Avatar size={28} initials={authorInitial(event.creator_id, event.profiles?.display_name, deletedLabels)} color={event.profiles?.avatar_color || C.sky} />
                    <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>
                      {/* A null creator_id means the account was deleted and the
                          event stayed. A missing name is something else entirely. */}
                      {t('event.organizer')} <strong style={{ color: C.ink }}>{authorLabel(event.creator_id, event.profiles?.display_name, deletedLabels)}</strong>
                    </span>
                    {session?.user.id === event.creator_id && (
                      <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 999, background: C.primarySoft, color: C.primaryPress, fontSize: 11, fontWeight: 800 }}>{t('event.moderator')}</span>
                    )}
                  </div>

                  {/* Edit + End (creator only, while not ended) */}
                  {session?.user.id === event.creator_id && computedStatus !== 'ended' && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      <button
                        onClick={() => onEdit?.(event)}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: C.primary, border: `2px solid ${INK}`, color: '#fff', fontSize: 14, fontWeight: 800, boxShadow: '0 4px 12px rgba(255,122,69,0.30)' }}
                      >
                        {t('event.editEvent')}
                      </button>
                      <button
                        onClick={handleEndEvent}
                        style={{ flex: 1, padding: '12px 16px', borderRadius: 999, background: 'transparent', border: `2px solid ${C.primarySoft}`, color: C.primaryPress, fontSize: 14, fontWeight: 800 }}
                      >
                        {t('event.endEvent')}
                      </button>
                    </div>
                  )}

                  {/* Description */}
                  {event.description && (
                    <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, lineHeight: 1.55, marginBottom: 12 }}>
                      {event.description}
                    </div>
                  )}

                  {/* Chat teaser (half only) — tap to expand to full */}
                  {!isFull && (
                    <button onClick={() => { if (!session) { onChatAuthNeeded?.(); window.history.pushState({ layer: 'auth' }, '') } else { setSnap('full') } }} style={{ width: '100%', padding: '14px 16px', borderRadius: 20, background: C.cream, border: `2px solid ${INK}22`, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', marginBottom: 80 }}>
                      {messages.length > 0 && (
                        <div style={{ display: 'flex', marginRight: -4 }}>
                          {[...new Map(messages.map(m => [m.author_id, m.author_color])).values()].slice(0, 3).map((color, i) => (
                            <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: color || C.sky, border: `2px solid ${INK}`, marginLeft: i === 0 ? 0 : -10 }} />
                          ))}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{t('event.conversation')}</div>
                        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>{t('event.messageCount', { count: messages.length })}</div>
                      </div>
                      <div style={{ fontSize: 18, color: C.primary, fontWeight: 900 }}>↑</div>
                    </button>
                  )}
                </>
            </div>

            {/* Chat region (full) — scroll + input wrapped together for dynamic height split */}
            {isFull && (
              <div
                onClick={() => setChatFocused(true)}
                style={{ flexShrink: 0, height: chatFocused ? '50%' : '30%', display: 'flex', flexDirection: 'column', borderTop: '1px solid #F1E9DA', transition: 'height 250ms ease' }}
              >
                <div
                  ref={chatRef}
                  style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 8px' }}
                >
                  {/* Conversation header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.grass, animation: 'breathe-sm 1.4s ease-in-out infinite' }} />
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{t('event.conversation')}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>· {t('event.messageCount', { count: messages.length })}</div>
                  </div>
                  <div style={{
                    fontSize: 11, color: C.inkSoft, fontWeight: 700,
                    textAlign: 'center', margin: '0 0 16px', letterSpacing: 0.5,
                  }}>{t('event.today')}</div>
                  {messages.map((m, i) => {
                    const isMe = session && m.author_id === session.user.id
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 10,
                        }}
                      >
                        {!isMe && i % 3 === 0 && (
                          <div style={{
                            fontSize: 11, color: C.inkSoft, fontWeight: 700,
                            marginBottom: 4, marginLeft: 44,
                          }}>
                            {authorLabel(m.author_id, m.author_name, deletedLabels)} · {new Date(m.created_at).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '82%' }}>
                          {!isMe && (
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: m.author_color || C.sky, border: `2px solid ${INK}`, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 900, color: INK,
                            }}>
                              {authorInitial(m.author_id, m.author_name, deletedLabels)}
                            </div>
                          )}
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isMe ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                            background: isMe ? C.primarySoft : '#fff', color: C.ink,
                            fontSize: 14, fontWeight: 600, lineHeight: 1.4,
                            boxShadow: isMe ? 'none' : '0 4px 16px rgba(45,43,42,0.08)',
                            animation: isMe && i === messages.length - 1 ? 'bubble-up 280ms ease' : 'none',
                          }}>{m.text}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{
                  flexShrink: 0, padding: '8px 16px 28px', background: 'rgba(255,255,255,0.96)',
                  borderTop: '1px solid #F1E9DA',
                }}>
                  {sendErr && (
                    <div style={{
                      marginBottom: 8, padding: '6px 12px', borderRadius: 10,
                      background: '#FFE8E8', color: '#c0392b', fontSize: 12, fontWeight: 700,
                    }}>{sendErr}</div>
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                      flex: 1, padding: '10px 18px', borderRadius: 999, background: C.cream,
                      display: 'flex', alignItems: 'center',
                    }}>
                      <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && send()}
                        placeholder={session ? t('event.writeMessage') : t('event.loginToWrite')}
                        disabled={!session}
                        maxLength={500}
                        style={{ flex: 1, fontSize: 16, fontWeight: 600 }}
                      />
                    </div>
                    <button
                      onClick={send}
                      disabled={!session || !input.trim()}
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: input.trim() && session ? C.primary : '#E8DFD0',
                        border: `2px solid ${INK}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: input.trim() ? '0 4px 12px rgba(255,122,69,0.35)' : 'none',
                        transition: 'all 200ms ease',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20">
                        <path
                          d="M3 10 L17 10 M11 5 L17 10 L11 15"
                          stroke={input.trim() && session ? '#fff' : C.inkSoft}
                          strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }
      {/* Photo modal */}
      {photoModal !== null && event?.photos && (
        <div
          onClick={() => setPhotoModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 210,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <button
            onClick={() => setPhotoModal(null)}
            style={{
              position: 'absolute', top: 20, right: 20,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
              color: '#fff', fontSize: 20, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >×</button>

          <img
            src={event.photos[photoModal]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh',
              objectFit: 'contain', borderRadius: 12,
              display: 'block',
            }}
          />

          {event.photos.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setPhotoModal(Math.max(0, photoModal - 1)) }}
                disabled={photoModal === 0}
                style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
                  color: '#fff', fontSize: 22, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: photoModal === 0 ? 0.3 : 1,
                }}
              >‹</button>
              <button
                onClick={e => { e.stopPropagation(); setPhotoModal(Math.min(event.photos!.length - 1, photoModal + 1)) }}
                disabled={photoModal === event.photos!.length - 1}
                style={{
                  position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
                  color: '#fff', fontSize: 22, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', opacity: photoModal === event.photos!.length - 1 ? 0.3 : 1,
                }}
              >›</button>
            </>
          )}
        </div>
      )}

      {/* Transient confirmations (link copied, notifications enabled) */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: C.ink, color: '#fff', borderRadius: 999,
          padding: '8px 18px', fontSize: 13, fontWeight: 700,
          whiteSpace: 'nowrap', zIndex: 10,
          animation: 'fadeIn 180ms ease',
        }}>
          {toast}
        </div>
      )}

      {notifyReason && session && (
        <FollowNotifyModal
          event={event}
          userId={session.user.id}
          provider={authProvider}
          reason={notifyReason}
          onEnabled={() => {
            notifyEnabledRef.current = true
            onProfileChanged?.(); showToast(t('followNotify.enabled'))
          }}
          onClose={closeNotifyCard}
        />
      )}

      {calendarChooser && (
        <CalendarChooserModal
          event={event}
          onPicked={settleCalendar}
          onClose={() => setCalendarChooser(false)}
        />
      )}
    </div>
  )
}

export default EventSheet
