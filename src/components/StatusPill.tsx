import { useTranslation } from 'react-i18next';
import { C } from '../lib/tokens';

export default function StatusPill({
  status = 'live',
  size = 'md',
}: {
  status?: 'live' | 'upcoming' | 'extended' | 'ended';
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const map = {
    live:     { bg: C.grass,    fg: '#0E4A0E', pulse: true },
    upcoming: { bg: C.sunshine, fg: '#5B4500', pulse: false },
    extended: { bg: C.primary,  fg: '#fff',    pulse: false },
    ended:    { bg: '#D8D2C7',  fg: '#5C564E', pulse: false },
  };
  const s = map[status] || map.live;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontSize: size === 'sm' ? 11 : 12,
        fontWeight: 800,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.fg,
          animation: s.pulse ? 'breathe-sm 1.2s ease-in-out infinite' : 'none',
        }}
      />
      {t('status.' + status)}
    </span>
  );
}
