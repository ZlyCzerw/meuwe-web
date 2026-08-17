import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import DragHandle from '../components/DragHandle'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import Avatar from '../components/Avatar'
import StatusPill from '../components/StatusPill'
import ActionRow, { ActionBtn } from '../components/ActionRow'
import EventPhotoStrip from './event/EventPhotoStrip'
import EventChatPanel from './event/EventChatPanel'
import PhotoLightbox from './event/PhotoLightbox'
import { C, INK, F, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { db } from '../lib/supabase'
import { haversineKm } from '../lib/geo'
import { isNativePlatform } from '../lib/platform'
import { computeStatus } from '../lib/eventStatus'
import { authorLabel, authorInitial } from '../lib/authorLabel'
import { truncateDescription } from '../lib/text'
import { addToCalendar, type CalendarResult } from '../lib/calendar'
import CalendarChooserModal from '../components/CalendarChooserModal'
import { getDevicePushState } from '../lib/push'
import { resolvePushState } from '../lib/pushState'
import {
  readPushAskState, writePushAskState, recordFollow, isPushAskDue, canAskForPush,
  markAsked, markDeclined,
} from '../lib/pushAsk'
import FollowNotifyModal from '../components/FollowNotifyModal'
import ChainArrow from '../components/ChainArrow'
import { useCardDrag } from '../hooks/useCardDrag'
import type { Dir } from '../lib/eventChain'
import type { EventWithMeta, Message } from '../lib/types'

type Snap = 'peek' | 'half' | 'full'

/** How long "another calendar" stays offered after an attempt. */
const CALENDAR_HINT_MS = 9000

/**
 * Zawartość trybu half ma stałą wysokość, nie stały udział w ekranie: te same
 * ~480 px to 61% iPhone'a 15 i 72% iPhone'a SE. Procent zawsze gdzieś zawiedzie,
 * więc kartę ustawia pomiar, a te liczby tylko go ograniczają.
 */
const HALF_MIN = 320
const HALF_MAX_VH = 78
/** Uchwyt plus górny odstęp listy — pomiar obejmuje samą zawartość. */
const HALF_CHROME = 29

/**
 * Wysokość na czas, zanim pomiar dotrze.
 *
 * Bez tego karta spadała na `HALF_MIN`, a że w trybie half treść jest przycięta
 * (`overflow: hidden`) i nie ma czego przewijać, wszystko poniżej zdjęcia
 * stawało się nieosiągalne. Na telefonie obserwator odpowiada od razu i nikt
 * tego nie zobaczy — ale nie ma powodu, żeby ta jedna klatka była pułapką.
 */
const HALF_FALLBACK = '56%'

/**
 * Próg, poniżej którego pomiar uznajemy za ten sam.
 *
 * Wysokość karty bierze się z pomiaru elementu leżącego w tej karcie, więc
 * każde drgnienie o ułamek piksela mogłoby budzić kolejne — dokładnie ten
 * kształt, który kończy się ostrzeżeniem "ResizeObserver loop completed with
 * undelivered notifications".
 */
const HALF_EPSILON = 1

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

const iconProps = {
  width: 16, height: 16, viewBox: '0 0 20 20', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

const AttendIcon = (
  <svg {...iconProps}>
    <circle cx="7.5" cy="6" r="3" />
    <path d="M2 16.2c0-2.9 2.5-4.4 5.5-4.4.8 0 1.6.1 2.3.3" />
    <path d="M12.2 14.4l1.9 1.9 3.6-4" />
  </svg>
)

const CalendarIcon = (
  <svg {...iconProps}>
    <rect x="2.6" y="4.4" width="14.8" height="13" rx="3" />
    <path d="M2.6 8.4h14.8M6.6 2.6v3.2M13.4 2.6v3.2" />
    <path d="M10 10.8v4M8 12.8h4" />
  </svg>
)

const ShareIcon = (
  <svg {...iconProps}>
    <path d="M10 12.8V3.2" />
    <path d="M6.6 6.4L10 3l3.4 3.4" />
    <path d="M5.4 9.4H4.4a1.6 1.6 0 00-1.6 1.6v4.6a1.6 1.6 0 001.6 1.6h11.2a1.6 1.6 0 001.6-1.6v-4.6a1.6 1.6 0 00-1.6-1.6h-1" />
  </svg>
)

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
  chatOpen: chatOpenProp,
  onChatOpenChange,
  onChainStep,
  chainCanGo,
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
  /** Czat jest warstwą historii — stanem zarządza App, żeby „wstecz" go zamykał. */
  chatOpen?: boolean
  onChatOpenChange?: (open: boolean) => void
  /** Krok po sznurku wydarzeń. Brak = karta stoi sama, bez strzałek i swipe'u. */
  /** Zwraca, czy krok się udał; karta rysuje z tego dwie różne animacje. */
  onChainStep?: (dir: Dir) => boolean
  chainCanGo?: (dir: Dir) => boolean
}) {
  const { t, i18n } = useTranslation()
  const [snap, setSnap] = useState<Snap>('half')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sendErr, setSendErr] = useState('')
  const [photoModal, setPhotoModal] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [notifyReason, setNotifyReason] = useState<'ask' | 'blocked' | 'unsupported' | null>(null)
  // The card calls onEnabled and then onClose on the way out, so the close
  // handler has to know which of the two endings it is closing.
  const notifyEnabledRef = useRef(false)
  const [calendarBusy, setCalendarBusy] = useState(false)
  const [calendarHint, setCalendarHint] = useState<'ok' | 'failed' | null>(null)
  const [calendarChooser, setCalendarChooser] = useState(false)
  const [followers, setFollowers] = useState<{ avatar_color: string | null; display_name: string | null }[]>([])
  const [halfContentH, setHalfContentH] = useState(0)
  const halfRef = useRef<HTMLDivElement | null>(null)

  const chatOpen = !!chatOpenProp

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
  const lastSendRef = useRef<number>(0)

  // How the account signed in, which is how lib/calendarRoute knows whether the
  // calendar can be guessed at instead of asked about.
  const authProvider = (session?.user.app_metadata?.provider as string | undefined) ?? null

  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }

  const isFull = snap === 'full'
  const isPeek = snap === 'peek'
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const meta = TAG_META[event.category as Category] || TAG_META.party
  const loc = LOC_MAP[i18n.language] || 'en-US'

  const computedStatus = computeStatus(event, messages)

  const distStr = userPos
    ? (() => {
        const dk = haversineKm(userPos.lat, userPos.lng, event.lat, event.lng)
        return dk < 1 ? `${Math.round(dk * 1000)} m` : `${dk.toFixed(1)} km`
      })()
    : null

  const desc = truncateDescription(event.description)

  const followersLabel = followers.length === 0
    ? ''
    : followers.length <= 3
      ? t(followers.length === 1 ? 'follow.followsThis' : 'follow.followThis')
      : t(followers.length - 3 === 1 ? 'follow.othersFollowOne' : 'follow.othersFollowMany', { count: followers.length - 3 })

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
    setDescOpen(false)
    db.getMessages(event.id).then(setMessages)
    db.unsub(chanRef.current)
    chanRef.current = db.subscribeMessages(event.id, m => setMessages(p => [...p, m]))
    return () => db.unsub(chanRef.current)
  }, [event?.id])

  // Wysokość karty w trybie half wynika z zawartości, więc dwuwierszowy tytuł,
  // ósmy tag czy pojawienie się paska obserwujących dopasowują ją same.
  useEffect(() => {
    const el = halfRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.height
      // Nowa wartość tylko wtedy, gdy naprawdę jest nowa: pomiar siedzi w karcie,
      // której wysokość ustawia, więc drgnienie o pół piksela zapętliłoby obie
      // strony na siebie nawzajem.
      setHalfContentH(prev => (Math.abs(prev - next) < HALF_EPSILON ? prev : next))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [event?.id])

  // Reset scroll when event opens or snap returns to half
  useEffect(() => {
    if (listRef.current && !isFull) listRef.current.scrollTop = 0
  }, [event?.id, isFull])

  // App podaje onChainStep jako świeżo domkniętą funkcję przy każdym renderze.
  // Przez ref nasłuch podpina się raz, zamiast odpinać i podpinać w kółko.
  const chainStepRef = useRef(onChainStep)
  useEffect(() => { chainStepRef.current = onChainStep }, [onChainStep])

  // Strzałki klawiatury robią to samo, co daszki — ale nie wtedy, gdy ktoś
  // pisze wiadomość albo patrzy na warstwę leżącą nad kartą.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const stepFn = chainStepRef.current
      if (!stepFn) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (chatOpen || photoModal !== null || notifyReason || calendarChooser) return
      e.preventDefault()
      // Klawisz idzie za daszkiem, nie za palcem. Swipe w lewo znaczy wschód,
      // bo karta wyjeżdża w lewo i następna nadchodzi z prawej — ale przy
      // klawiaturze nic nie jedzie. Widać dwa daszki, prawy podpisany
      // „następne", więc strzałka w prawo musi robić dokładnie to samo.
      stepFn(e.key === 'ArrowRight' ? 'east' : 'west')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chatOpen, photoModal, notifyReason, calendarChooser])

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

  function openChat() {
    if (!session) { onChatAuthNeeded?.(); window.history.pushState({ layer: 'auth' }, ''); return }
    if (!isFull) setSnap('full')
    onChatOpenChange?.(true)
  }

  function onVertical(dy: number) {
    if (dy > 80) {
      if (snap === 'full') setSnap('half')
      else if (snap === 'half') setSnap('peek')
      else onClose()
    } else if (dy < -80) {
      if (snap === 'peek') setSnap('half')
      else if (snap === 'half') setSnap('full')
    }
  }

  const drag = useCardDrag({
    // Czat leży na całej karcie i ma własne przewijanie; sznurek pod nim
    // milczy.
    enabled: !!onChainStep && !chatOpen,
    onCommitX: dir => onChainStep?.(dir) ?? false,
    // W trybie full lista przewija się natywnie i pionowy gest do niej należy —
    // dokładnie jak przed sznurkiem.
    onCommitY: dy => { if (!isFull) onVertical(dy) },
  })

  if (!event) return null

  const sheetHeight =
    snap === 'peek' ? '130px'
      : snap === 'full' ? '93%'
      : halfContentH === 0 ? HALF_FALLBACK
      : `clamp(${HALF_MIN}px, ${Math.round(halfContentH + HALF_CHROME)}px, ${HALF_MAX_VH}vh)`

  const startsAt = new Date(event.start_time)
  const endsAt = new Date(event.end_time)
  const hhmm = (d: Date) => d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="event-sheet" style={{
      position: 'absolute', height: sheetHeight,
      transition: 'height 380ms cubic-bezier(0.32,1.4,0.4,1)',
      zIndex: 40,
    }}>
      <div className="event-sheet-card" style={{
        height: '100%',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        // Treść jedzie za palcem; po puszczeniu wraca do zera niezależnie od
        // tego, czy wydarzenie się zmieniło.
        transform: `translateX(${drag.dx}px)`,
        transition: drag.transition,
      }}>
      <div {...drag.bind} style={{ flexShrink: 0, position: 'relative' }}>
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
          <div {...drag.bind} style={{ padding: '4px 20px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
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
          // Czat kładzie się na całej tej okolicy (inset: 0), więc to ona musi być
          // układem odniesienia — inaczej rozlałby się na cały ekran.
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div
              ref={listRef}
              // W trybie half nie ma czego przewijać (karta jest dokładnie na
              // miarę treści), więc rozwinięcie musi wziąć się z gestu, nie ze
              // zdarzenia scroll, które nigdy nie padnie.
              {...drag.bind}
              onWheel={!isFull ? (e) => { if (e.deltaY > 0) setSnap('full') } : undefined}
              style={{ flex: 1, overflowY: isFull ? 'auto' : 'hidden', padding: '4px 20px 0' }}
            >
              {/* Wszystko, co widać w trybie half — to jest mierzone. */}
              <div ref={halfRef}>
                <EventPhotoStrip
                  photos={event.photos}
                  category={event.category as Category}
                  tags={event.tags ?? []}
                  followers={followers}
                  followersLabel={followersLabel}
                  onClose={onClose}
                  onOpenPhoto={setPhotoModal}
                />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    flex: 1, fontFamily: F.display, fontSize: 19, fontWeight: 900,
                    color: C.ink, lineHeight: 1.2, letterSpacing: -0.3,
                  }}>{event.title}</div>
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    <StatusPill status={computedStatus} />
                  </div>
                </div>

                {/* Fakty w jednym pudełku: kiedy i gdzie. Dwie rzeczy, po które
                    sięga się najczęściej, więc nie mogą być rozsypane po karcie. */}
                <div style={{ background: C.cream, borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="10" cy="10" r="7.4" />
                      <path d="M10 5.8V10l2.8 1.8" />
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>
                        {startsAt.toLocaleDateString(loc, { day: 'numeric', month: 'long', weekday: 'long' })}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: C.inkSoft, marginTop: 2 }}>
                        {hhmm(startsAt)} – {hhmm(endsAt)}
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 1, background: '#EDE0CC', margin: '10px 0' }} />

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M10 17.5s5.4-5 5.4-9.1A5.4 5.4 0 0010 3a5.4 5.4 0 00-5.4 5.4c0 4.1 5.4 9.1 5.4 9.1z" />
                      <circle cx="10" cy="8.3" r="2" />
                    </svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {event.place_name && (
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>
                          {event.place_name}
                        </div>
                      )}
                      {distStr && (
                        <button
                          onClick={onLocate}
                          disabled={!onLocate}
                          style={{
                            background: 'none', border: 'none', padding: 0, marginTop: event.place_name ? 2 : 0,
                            cursor: onLocate ? 'pointer' : 'default',
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                          }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: C.primary, boxShadow: `0 0 0 3px ${C.primarySoft}` }} />
                          <span style={{
                            fontSize: 12.5, fontWeight: 700, color: C.primary,
                            textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3,
                          }}>{t('event.distanceFrom', { dist: distStr })}</span>
                        </button>
                      )}
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        flexShrink: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '6px 11px', borderRadius: 999, background: '#fff', border: `1.5px solid ${INK}22`,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.ink }}>{t('event.directions')}</span>
                    </a>
                  </div>
                </div>

                <ActionRow>
                  <ActionBtn
                    icon={AttendIcon}
                    label={isFollowing ? t('event.attending') : t('event.attend')}
                    ariaLabel={isFollowing ? t('event.attending') : t('event.attend')}
                    active={isFollowing}
                    onClick={toggleFollow}
                  />
                  <ActionBtn
                    icon={CalendarIcon}
                    label={t('calendar.add')}
                    ariaLabel={t('calendar.add')}
                    disabled={calendarBusy}
                    onClick={handleCalendar}
                  />
                  <ActionBtn
                    icon={ShareIcon}
                    label={t('share.share')}
                    ariaLabel={t('share.share')}
                    onClick={() => handleShare(event, () => showToast(t('share.linkCopied')))}
                  />
                </ActionRow>

                {/* Oddech pod paskiem akcji — mierzony razem z resztą, więc
                    karta w trybie half nie kończy się na krawędzi przycisków. */}
                <div style={{ height: 14 }} />
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

              {desc.preview && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {desc.truncated && !descOpen ? `${desc.preview}…` : (event.description ?? '').trim()}
                  </div>
                  {desc.truncated && (
                    <button
                      onClick={() => setDescOpen(o => !o)}
                      style={{
                        marginTop: 6, padding: 0, background: 'none', border: 'none',
                        fontSize: 13, fontWeight: 800, color: C.primary, cursor: 'pointer',
                      }}
                    >
                      {descOpen ? t('event.readLess') : t('event.readMore')}
                    </button>
                  )}
                </div>
              )}

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

              {/* Zajawka rozmowy — czat otwiera się jako warstwa nad kartą. */}
              <button
                data-testid="chat-teaser"
                onClick={openChat}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 20, background: C.cream, border: `2px solid ${INK}22`, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', marginBottom: 80 }}
              >
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
            </div>

            {chatOpen && (
              <EventChatPanel
                messages={messages}
                meId={session?.user.id ?? null}
                loc={loc}
                deletedLabels={deletedLabels}
                title={event.title}
                onBack={() => onChatOpenChange?.(false)}
                input={input}
                onInputChange={setInput}
                onSend={send}
                sendErr={sendErr}
                canWrite={!!session}
              />
            )}
          </div>
        )
      }

      {photoModal !== null && event.photos && event.photos.length > 0 && (
        <PhotoLightbox photos={event.photos} index={photoModal} onClose={() => setPhotoModal(null)} />
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

      {isDesktop && onChainStep && (
        <>
          <div style={{ position: 'absolute', left: -44, top: '50%', transform: 'translateY(-50%)', zIndex: 41 }}>
            <ChainArrow
              dir="left" label={t('event.chainPrev')}
              disabled={!chainCanGo?.('west')}
              onClick={() => onChainStep('west')}
            />
          </div>
          <div style={{ position: 'absolute', right: -44, top: '50%', transform: 'translateY(-50%)', zIndex: 41 }}>
            <ChainArrow
              dir="right" label={t('event.chainNext')}
              disabled={!chainCanGo?.('east')}
              onClick={() => onChainStep('east')}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default EventSheet
