import { INK } from '../lib/tokens'

/**
 * Sam daszek, bez nóżki — obok karty, nie na niej, więc nie może wyglądać jak
 * przycisk. Rysunek 12x20 w polu dotyku 44x44: oko widzi cienką kreskę, palec
 * trafia w cel.
 */
export default function ChainArrow({ dir, disabled, label, onClick }: {
  dir: 'left' | 'right'
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 44, height: 44,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', padding: 0,
        opacity: disabled ? 0.25 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'opacity 180ms ease',
      }}
    >
      <svg
        width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden
        style={{ transform: dir === 'left' ? 'none' : 'scaleX(-1)' }}
      >
        <path d="M10 1L2 10l8 9" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
