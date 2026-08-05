import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { isNativePlatform } from '../lib/platform'
import { openCalendarTarget, type CalendarResult } from '../lib/calendar'
import type { CalendarTarget } from '../lib/calendarRoute'
import type { IcsEvent } from '../lib/ics'

// Asked only where there is genuinely nothing to go on — an iPhone in Safari, a
// desktop, a guest. Everywhere else the route is already known and this card
// never opens; see lib/calendarRoute.
//
// The file sits last and is named for what it is. It is the only option that
// ends in a download, and inside the app it is not offered at all: there the
// system screen is the route, and this card only appears when that failed.

const TARGETS: { target: CalendarTarget; key: string; webOnly?: true }[] = [
  { target: 'google', key: 'calendar.google' },
  { target: 'outlook', key: 'calendar.outlook' },
  { target: 'file', key: 'calendar.file', webOnly: true },
]

export default function CalendarChooserModal({
  event,
  onPicked,
  onClose,
}: {
  event: IcsEvent
  onPicked: (result: CalendarResult) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const options = TARGETS.filter(o => !o.webOnly || !isNativePlatform())

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 350,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, background: '#fff', borderRadius: 32,
          padding: '26px 22px 20px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)',
        }}
      >
        <div style={{
          fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.ink,
          textAlign: 'center', marginBottom: 18,
        }}>
          {t('calendar.chooseTitle')}
        </div>

        {options.map(({ target, key }) => (
          <button
            key={target}
            onClick={() => onPicked(openCalendarTarget(event, target))}
            style={{
              display: 'block', width: '100%', marginBottom: 10, padding: '13px 16px',
              borderRadius: 999, background: C.cream, border: `2px solid ${INK}33`,
              color: C.ink, fontSize: 15, fontWeight: 800, textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {t(key)}
          </button>
        ))}

        <button
          onClick={onClose}
          style={{
            marginTop: 4, width: '100%', padding: '10px',
            background: 'none', border: 'none',
            color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
