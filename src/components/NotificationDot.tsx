import { useTranslation } from 'react-i18next'
import { C, INK } from '../lib/tokens'

export default function NotificationDot({ size = 12, style }: { size?: number; style?: React.CSSProperties }) {
  const { t } = useTranslation()
  return (
    <span
      role="status"
      aria-label={t('notifications.unread')}
      style={{
        flexShrink: 0,
        width: size, height: size, borderRadius: '50%',
        background: C.sunshine, border: `2px solid ${INK}`,
        display: 'inline-block', boxSizing: 'border-box',
        ...style,
      }}
    />
  )
}
