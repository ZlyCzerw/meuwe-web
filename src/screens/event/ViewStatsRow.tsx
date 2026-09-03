import { useTranslation } from 'react-i18next'
import { C, INK } from '../../lib/tokens'

/**
 * Wyświetlenia karty - widzi tylko twórca wydarzenia (EventSheet montuje
 * wiersz wyłącznie dla niego). views = wszystkie otwarcia razem z gośćmi,
 * viewers = ilu zalogowanych użytkowników otwierało kartę.
 */
export default function ViewStatsRow({ views, viewers }: { views: number; viewers: number }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      fontSize: 13, fontWeight: 700, color: C.inkSoft,
    }}>
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
        <path d="M1.8 10s3-5.4 8.2-5.4 8.2 5.4 8.2 5.4-3 5.4-8.2 5.4S1.8 10 1.8 10z" />
        <circle cx="10" cy="10" r="2.4" />
      </svg>
      <span>{t('event.viewCount', { count: views })} · {t('event.viewerCount', { count: viewers })}</span>
    </div>
  )
}
