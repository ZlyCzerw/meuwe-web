import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import { authorInitial } from '../lib/authorLabel'
import Avatar from './Avatar'

// Lista osób, które wezmą udział, otwierana z paska awatarów w karcie
// wydarzenia. Wiersz otwiera kartę profilu, która leży nad tym modalem (280),
// więc po jej zamknięciu wraca się do listy, a nie do wydarzenia.

type Attendee = { user_id: string; display_name: string | null; avatar_color: string | null }
type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; list: Attendee[] }

export default function AttendeesModal({
  eventId,
  onOpenUser,
  onClose,
}: {
  eventId: string
  onOpenUser: (userId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [load, setLoad] = useState<Load>({ state: 'loading' })

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading when eventId changes, intentional
    setLoad({ state: 'loading' })
    db.getEventAttendees(eventId).then(list => {
      if (!alive) return
      setLoad(list ? { state: 'ready', list } : { state: 'failed' })
    })
    return () => { alive = false }
  }, [eventId])

  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }

  return (
    <div
      data-testid="attendees-backdrop"
      onClick={onClose}
      style={{
        // 270: nad EventSheet (40), czatem i AppPromoSheet (240), ale pod kartą
        // profilu (280), którą ten modal otwiera.
        position: 'fixed', inset: 0, zIndex: 270,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-label={t('attendees.title')}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 360, maxHeight: '80vh',
          background: '#fff', borderRadius: 32, boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Koło z karty profilu: ten sam gest, ta sama przezroczystość. */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 180, height: 180,
          borderRadius: '50%', background: C.primarySoft, opacity: 0.5, pointerEvents: 'none',
        }} />

        <button
          onClick={onClose}
          aria-label={t('common.close')}
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 1, width: 36, height: 36, borderRadius: '50%',
            background: '#fff', border: `2px solid ${INK}22`, color: C.ink,
            fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1,
          }}
        >
          ×
        </button>

        <div style={{ position: 'relative', padding: '28px 24px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>
            {t('attendees.title')}
          </div>
          {load.state === 'ready' && load.list.length > 0 && (
            <span style={{
              padding: '2px 10px', borderRadius: 999, background: C.cream, border: `2px solid ${INK}22`,
              fontSize: 13, fontWeight: 800, color: C.ink,
            }}>
              {load.list.length}
            </span>
          )}
        </div>

        <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '0 12px 16px', overscrollBehavior: 'contain' }}>
          {load.state === 'loading' && (
            <div style={{ animation: 'breathe-sm 1.6s ease-in-out infinite' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.cream, border: `2.5px solid ${INK}22` }} />
                  <div style={{ width: 120 + i * 20, height: 14, borderRadius: 999, background: C.cream }} />
                </div>
              ))}
            </div>
          )}

          {load.state === 'failed' && (
            <div style={{ padding: '12px', fontSize: 15, fontWeight: 700, color: C.inkSoft, lineHeight: 1.5 }}>
              {t('attendees.loadFailed')}
            </div>
          )}

          {load.state === 'ready' && load.list.length === 0 && (
            <div style={{ padding: '12px', fontSize: 15, fontWeight: 700, color: C.inkSoft }}>
              {t('attendees.empty')}
            </div>
          )}

          {load.state === 'ready' && load.list.map(a => (
            <button
              key={a.user_id}
              data-testid="attendee-row"
              onClick={() => onOpenUser(a.user_id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 20, background: 'transparent', border: 'none',
                textAlign: 'left', cursor: 'pointer',
              }}
            >
              <Avatar size={40} color={a.avatar_color || C.sky} initials={authorInitial(a.user_id, a.display_name, deletedLabels)} />
              <span style={{
                flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, color: C.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {a.display_name?.trim() || '?'}
              </span>
              <span aria-hidden="true" style={{ fontSize: 22, fontWeight: 800, color: C.inkSoft, lineHeight: 1 }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
