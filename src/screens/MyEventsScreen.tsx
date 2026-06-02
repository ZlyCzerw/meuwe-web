import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import StatusPill from '../components/StatusPill'
import { C, F, INK, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { db } from '../lib/supabase'
import { computeStatus } from '../lib/eventStatus'
import { muteEvent, unmuteEvent, getEventMutes } from '../lib/push'
import type { EventWithMsgCount } from '../lib/types'
import NotificationDot from '../components/NotificationDot'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE' }

export default function MyEventsScreen({
  session,
  onBack,
  onOpenEvent,
  isUnread,
}: {
  session: Session | null
  onBack: () => void
  onOpenEvent: (ev: EventWithMsgCount) => void
  isUnread?: (id: string) => boolean
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'
  const [events, setEvents] = useState<EventWithMsgCount[]>([])
  const [loading, setLoading] = useState(true)
  const [mutes, setMutes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!session) return
    db.getMyEvents(session.user.id).then(data => {
      setEvents(data)
      setLoading(false)
    })
    getEventMutes(session.user.id).then(ids => setMutes(new Set(ids)))
  }, [session])

  async function handleToggleMute(eventId: string) {
    if (!session) return
    if (mutes.has(eventId)) {
      await unmuteEvent(session.user.id, eventId)
      setMutes(prev => { const s = new Set(prev); s.delete(eventId); return s })
    } else {
      await muteEvent(session.user.id, eventId)
      setMutes(prev => new Set([...prev, eventId]))
    }
  }

  // Group by real-time computed status (no messages available here — uses end_time + 1h)
  const live     = events.filter(e => { const s = computeStatus(e); return s === 'live' || s === 'extended' })
  const upcoming = events.filter(e => computeStatus(e) === 'upcoming')
  const ended    = events.filter(e => computeStatus(e) === 'ended')

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  }

  function Section({ title, items, dim }: { title: string; items: EventWithMsgCount[]; dim?: boolean }) {
    if (items.length === 0) return null
    const scrollable = items.length > 5
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: C.inkSoft,
          textTransform: 'uppercase', letterSpacing: 0.8,
          padding: '10px 4px 6px',
        }}>{title}</div>
        <div style={scrollable ? { maxHeight: 420, overflowY: 'auto', paddingRight: 2 } : {}}>
          {items.map((ev, i) => {
            const meta = TAG_META[ev.category as Category] || TAG_META.party
            const computedStatus = computeStatus(ev)
            return (
              <div
                key={ev.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenEvent(ev)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenEvent(ev) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, marginBottom: 10, borderRadius: 22,
                  background: '#fff', boxShadow: '0 4px 16px rgba(78,50,30,0.08)',
                  textAlign: 'left', cursor: 'pointer',
                  opacity: dim ? 0.72 : 1,
                  filter: dim ? 'saturate(0.7)' : 'none',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <OrganicBlob
                    size={56}
                    color={meta.color}
                    idx={i}
                    face={<BlobFace size={38} mood={dim ? 'sleepy' : 'happy'} />}
                  />
                  {isUnread?.(ev.id) && (
                    <NotificationDot size={14} style={{ position: 'absolute', top: -2, right: -2 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.ink,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{ev.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <StatusPill status={computedStatus} size="sm" />
                    <span style={{ fontSize: 11, color: C.inkSoft, fontWeight: 700 }}>
                      {formatDate(ev.start_time)}
                    </span>
                  </div>
                  {ev.place_name && (
                    <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
                      {ev.place_name}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {/* Mute toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleMute(ev.id) }}
                    title={mutes.has(ev.id) ? t('event.muteOff') : t('event.muteOn')}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: mutes.has(ev.id) ? C.cream : 'transparent',
                      border: `1.5px solid ${mutes.has(ev.id) ? INK + '33' : 'transparent'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, cursor: 'pointer',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke={mutes.has(ev.id) ? C.inkSoft : C.ink}
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      {mutes.has(ev.id) && <line x1="1" y1="1" x2="23" y2="23"/>}
                    </svg>
                  </button>
                  {/* Message count */}
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '6px 10px', borderRadius: 14, background: C.cream,
                  }}>
                    <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: C.primary }}>
                      {ev.msgCount}
                    </div>
                    <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {t('event.messages')}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.cream }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#fff',
            border: `2px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
            fontSize: 20, fontWeight: 800, color: C.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>
        <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: C.ink, letterSpacing: -0.5 }}>
          {t('profile.myEvents')}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft, fontWeight: 700 }}>
            {t('common.loading')}
          </div>
        )}

        {!loading && events.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft, fontWeight: 700 }}>
            {t('event.noEvents')}
          </div>
        )}

        {!loading && (
          <>
            <Section title={t('event.sectionLive')} items={live} />
            <Section title={t('event.sectionUpcoming')} items={upcoming} />
            <Section title={t('event.sectionEnded')} items={ended} dim />
          </>
        )}
      </div>
    </div>
  )
}
