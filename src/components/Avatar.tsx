import { C, INK, F } from '../lib/tokens';
import NotificationDot from './NotificationDot';

export default function Avatar({
  size = 44,
  hasUnread = false,
  onClick,
  color = C.berry,
  initials = '?',
}: {
  size?: number;
  hasUnread?: boolean;
  onClick?: () => void;
  color?: string;
  initials?: string;
}) {
  return (
    <button onClick={onClick} style={{ position: 'relative', width: size, height: size }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          border: `2.5px solid ${INK}`,
          boxShadow: `0 3px 0 ${INK}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: INK,
          fontWeight: 900,
          fontSize: size * 0.38,
          fontFamily: F.display,
          letterSpacing: -0.4,
        }}
      >
        {initials}
      </div>
      {hasUnread && (
        <NotificationDot size={18} style={{ position: 'absolute', top: -5, right: -5 }} />
      )}
    </button>
  );
}
