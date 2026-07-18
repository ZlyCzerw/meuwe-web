import { useTranslation } from 'react-i18next'
import { C, F } from '../lib/tokens'
import type { EventWithMeta } from '../lib/types'
import { pinHTML } from './mapIcons'

const LOC_MAP: Record<string, string> = { pl: 'pl-PL', en: 'en-US', es: 'es-ES', de: 'de-DE' }

// "Choose an event" picker, styled after ConflictModal. Lists same-zone same-day
// events (already sorted by start_time by the caller); selecting one opens the
// normal event half-sheet via onSelect.
export default function EventPickerModal({ events, onSelect, onClose }: {
  events: EventWithMeta[]
  onSelect: (ev: EventWithMeta) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const loc = LOC_MAP[i18n.language] || 'en-US'
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, maxHeight: '70vh', background: '#fff', borderRadius: 32,
          padding: '24px 20px 20px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 16 }}>
          {t('picker.title')}
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, margin: '0 -4px', padding: '0 4px' }}>
          {events.map((ev, i) => (
            <button
              key={ev.id}
              onClick={() => onSelect(ev)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: 20, background: C.cream, border: '2px solid transparent',
              }}
            >
              <div
                style={{ width: 44, height: 56, flexShrink: 0, position: 'relative' }}
                dangerouslySetInnerHTML={{ __html: pinHTML(ev.category, i, ev.status, ev.start_time, ev.end_time, 1) }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft, marginTop: 2 }}>
                  {fmt(ev.start_time)}-{fmt(ev.end_time)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
