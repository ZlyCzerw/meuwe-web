import { Children, Fragment, type ReactNode } from 'react';
import { C, INK, F } from '../lib/tokens';

/**
 * Trzykolumnowy pasek głównych akcji karty.
 *
 * Przegrody rysuje sam, na podstawie liczby dzieci — wywołujący podaje same
 * przyciski i nie musi pamiętać o kreskach między nimi.
 */
export default function ActionRow({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <div style={{ display: 'flex', borderRadius: 20, background: C.cream, overflow: 'hidden' }}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <div style={{ width: 1, background: '#EDE0CC', margin: '9px 0' }} />}
          {child}
        </Fragment>
      ))}
    </div>
  );
}

export function ActionBtn({
  icon,
  label,
  ariaLabel,
  active,
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  /** Może być wielowierszowa, dlatego ReactNode — opis dla czytnika idzie osobno. */
  label: ReactNode;
  ariaLabel: string;
  /**
   * Tylko dla przełączników. Pominięty zostawia przycisk bez aria-pressed —
   * "Udostępnij" nie jest wyłączonym przełącznikiem, tylko zwykłą akcją.
   */
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        padding: '10px 6px 9px',
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          flexShrink: 0,
          background: active ? C.primary : 'transparent',
          border: `2px solid ${INK}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? '#fff' : INK,
          transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontFamily: F.body,
          fontSize: 10.5,
          fontWeight: 800,
          color: INK,
          textAlign: 'center',
          lineHeight: 1.15,
          minHeight: 24,
        }}
      >
        {label}
      </span>
    </button>
  );
}
