import type { ReactNode, MouseEvent } from 'react'
import { C, INK } from '../lib/tokens'

// Okrągły przycisk akcji w wierszu listy (menu „Moje wydarzenia”, „Obserwowane”,
// „Obserwowani użytkownicy”): ta sama geometria, co dzwonek wyciszenia obok.
// Wiersz sam jest klikalny, więc klik tutaj nie może przeciekać do rodzica.
//
// `active` to stan „pytam” (np. „Zakończyć?”): pigułka z podpisem zamiast ikony,
// żeby drugi tap był świadomy, a nie przypadkowy.

export default function ListActionButton({
  label,
  onClick,
  children,
  active = false,
  activeLabel,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  active?: boolean
  activeLabel?: string
}) {
  const handle = (e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); onClick() }
  if (active) {
    return (
      <button
        onClick={handle}
        aria-label={activeLabel ?? label}
        style={{
          height: 32, padding: '0 12px', borderRadius: 999,
          background: C.primary, color: '#fff', border: `1.5px solid ${INK}`,
          fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
          animation: 'bubble-up 180ms cubic-bezier(0.32,1.4,0.4,1)',
        }}
      >
        {activeLabel ?? label}
      </button>
    )
  }
  return (
    <button
      onClick={handle}
      aria-label={label}
      title={label}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'transparent', border: `1.5px solid ${INK}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.ink, cursor: 'pointer', flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

/** Kreska „−”: usuń z obserwowanych. */
export function MinusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

/** Ołówek: edycja wydarzenia. */
export function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

/** Kwadrat „stop”: zakończenie wydarzenia. */
export function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="3" />
    </svg>
  )
}
