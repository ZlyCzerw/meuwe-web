import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import StatusPill from '../components/StatusPill'
import { C, F, INK, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { db } from '../lib/supabase'
import type { EventWithMsgCount } from '../lib/types'

type Tab = 'active' | 'ended'

export default function MyEventsScreen({
  session,
  onBack,
  onOpenEvent,
}: {
  session: Session | null
  onBack: () => void
  onOpenEvent: (ev: EventWithMsgCount) => void
}) {
  const [tab, setTab] = useState<Tab>('active')
  const [events, setEvents] = useState<EventWithMsgCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    db.getMyEvents(session.user.id).then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [session])

  const filtered = events.filter(e =>
    tab === 'active'
      ? e.status !== 'ended'
      : e.status === 'ended'
  )

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) +
      ' · ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
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
          Moje wydarzenia
        </div>
      </div>

      {/* Segmented toggle */}
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{
          display: 'flex', padding: 4, background: '#fff', borderRadius: 999,
          boxShadow: '0 4px 16px rgba(78,50,30,0.08)',
        }}>
          {(['active', 'ended'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 999,
                background: tab === t ? C.primary : 'transparent',
                color: tab === t ? '#fff' : C.inkSoft,
                fontSize: 13, fontWeight: 800,
                transition: 'all 240ms ease',
              }}
            >
              {t === 'active' ? 'Aktywne' : 'Zakończone'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft, fontWeight: 700 }}>
            Ładowanie…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.inkSoft, fontWeight: 700 }}>
            {tab === 'active' ? 'Brak aktywnych wydarzeń' : 'Brak zakończonych wydarzeń'}
          </div>
        )}
        {filtered.map((ev, i) => {
          const meta = TAG_META[ev.category as Category] || TAG_META.party
          const isEnded = ev.status === 'ended'
          return (
            <button
              key={ev.id}
              onClick={() => onOpenEvent(ev)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, marginBottom: 10, borderRadius: 22,
                background: '#fff', boxShadow: '0 4px 16px rgba(78,50,30,0.08)',
                textAlign: 'left',
                opacity: isEnded ? 0.72 : 1,
                filter: isEnded ? 'saturate(0.7)' : 'none',
              }}
            >
              <OrganicBlob
                size={56}
                color={meta.color}
                idx={i}
                face={<BlobFace size={38} mood={isEnded ? 'sleepy' : 'happy'} />}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{ev.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  <StatusPill status={ev.status} size="sm" />
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
              {/* message count badge */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '6px 10px', borderRadius: 14, background: C.cream, flexShrink: 0,
              }}>
                <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 900, color: C.primary }}>
                  {ev.msgCount}
                </div>
                <div style={{ fontSize: 9, color: C.inkSoft, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  wiad.
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
