import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import { storeUrl, deviceStoreOs, type StoreOs } from '../lib/stores'

// Store badges. Both platforms require the "Download on the / Get it on" wording
// above the store name and the store's own mark, so the badge keeps that shape
// and only borrows meuwe's radius, border and shadow.
//
// An empty URL in appConfig means the listing does not exist yet. In the app it
// renders nothing at all — never a link that goes nowhere. On the landing page
// `disabled` shows the badge greyed out with a "soon" label instead.

function AppleMark({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 384 512" fill={color} aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
    </svg>
  )
}

function PlayMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.18 23.76c.36.2.78.22 1.16.06l11.5-6.62-2.5-2.5-10.16 9.06z" fill="#EA4335"/>
      <path d="M20.9 10.27L18.1 8.62 15.28 11.5l2.82 2.88 2.8-1.62c.8-.46.8-2.03 0-2.49z" fill="#FBBC04"/>
      <path d="M1.6 1.22C1.25 1.6 1 2.18 1 2.9v18.2c0 .72.25 1.3.6 1.68l.1.09 10.2-10.2v-.24L1.6 1.22z" fill="#4285F4"/>
      <path d="M13.84 13.34l2.62-2.62-10.16-9.06c-.4-.17-.84-.16-1.2.06l8.74 11.62z" fill="#34A853"/>
    </svg>
  )
}

export default function StoreBadge({
  os,
  disabled = false,
  onNavigate,
}: {
  os: StoreOs
  /** No listing yet: shown greyed out with a "soon" label, and not clickable. */
  disabled?: boolean
  onNavigate?: () => void
}) {
  const { t } = useTranslation()
  const href = storeUrl(os)
  const name = os === 'ios' ? 'App Store' : 'Google Play'
  const inactive = disabled || !href

  const content = (
    <>
      {os === 'ios' ? <AppleMark color={inactive ? C.inkSoft : '#fff'} /> : <PlayMark />}
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>
          {inactive ? t('store.soon') : t('landing.footer.storePre')}
        </span>
        <span style={{ fontFamily: F.display, fontSize: 15, fontWeight: 900 }}>{name}</span>
      </span>
    </>
  )

  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '10px 18px', borderRadius: 16,
    background: inactive ? '#E8E1D8' : INK,
    color: inactive ? C.inkSoft : '#fff',
    border: `2px solid ${inactive ? '#E8E1D8' : INK}`,
    boxShadow: inactive ? 'none' : `0 4px 0 ${INK}33`,
    textDecoration: 'none',
    cursor: inactive ? 'default' : 'pointer',
    transition: 'transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
  }

  if (inactive) return <span style={style} aria-disabled="true">{content}</span>

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => { db.trackClick(os === 'ios' ? 'store_ios' : 'store_android'); onNavigate?.() }}
      style={style}
    >
      {content}
    </a>
  )
}

/** Badge for the device the visitor is holding, or nothing. */
export function DeviceStoreBadge({ onNavigate }: { onNavigate?: () => void }) {
  const os = deviceStoreOs()
  if (!os) return null
  return <StoreBadge os={os} onNavigate={onNavigate} />
}

/** Captioned variant used under the sign-in buttons. */
export function StoreHint() {
  const { t } = useTranslation()
  const os = deviceStoreOs()
  if (!os) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>{t('store.hint')}</div>
      <StoreBadge os={os} />
    </div>
  )
}
