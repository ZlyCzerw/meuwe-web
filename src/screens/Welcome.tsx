import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import { MeuweLogo } from '../components/MeuweLogo'
import { C, INK, F } from '../lib/tokens'
import { useBlobPhysics } from '../hooks/useBlobPhysics'
import { db } from '../lib/supabase'
import { isNativePlatform, mobileOS } from '../lib/platform'
import StoreBadge from '../components/StoreBadge'
import InAppBrowserModal from '../components/InAppBrowserModal'
import { isInAppBrowser } from '../lib/inAppBrowser'

// Raz zamknięta informacja o WebView nie wraca do końca sesji — kto już
// wie, że logowanie tu nie zadziała, nie musi tego słyszeć przy każdym powrocie
// na ekran powitalny. Nowa karta w Messengerze to nowa sesja, więc ktoś, kto
// przyszedł z innego linku, dostanie ją ponownie.
const NOTICE_KEY = 'meuwe_webview_notice_dismissed'

function noticeDismissed(): boolean {
  try { return sessionStorage.getItem(NOTICE_KEY) === '1' }
  catch { return false }
}

/**
 * Przyciski logowania równają do pary plakietek sklepowych pod nimi.
 *
 * Plakietka to 72px stałej konstrukcji (ramka, padding, ikona, odstęp) plus
 * szerszy z dwóch napisów w środku. Nazwy sklepów się nie tłumaczą, więc para
 * wychodzi 304px po polsku, niemiecku i słoweńsku; po angielsku i hiszpańsku
 * jest o ~12px szersza, bo dłuższy podpis („Download on the") przebija nazwę.
 * Trzymamy tę węższą wartość — różnica rozkłada się po 6px na stronę.
 */
const CTA_MAX_W = 304

export default function Welcome({ onSignIn }: { onSignIn: (mode: 'google' | 'apple' | 'skip') => void }) {
  const { t } = useTranslation()
  const blobs = useBlobPhysics(6)
  // Wbudowana przeglądarka Facebooka i spółki: sprawdzone raz, przy montowaniu,
  // bo user agent nie zmienia się w trakcie życia ekranu.
  const [webviewNotice, setWebviewNotice] = useState(() => isInAppBrowser() && !noticeDismissed())
  // On native the WebView is full-screen and body has safe-area padding, which would
  // leave cream bands above/below this screen. Break the gradient out to fill the whole
  // viewport (position:fixed) so it reaches under the notch and home indicator. On web
  // this component is a hero section inside the scrollable landing, so keep it in flow.
  const native = isNativePlatform()

  return (
    <div style={{
      ...(native ? { position: 'fixed', inset: 0 } : { width: '100%', height: '100%', position: 'relative' }),
      background: `linear-gradient(180deg,${C.cream} 0%,#FFF1E0 40%,#FFE8DC 75%,#FFE0E8 100%)`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Physics blobs — behind all UI (zIndex 0) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {blobs.map(b => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x - b.size / 2,
              top: b.y - b.size / 2,
            }}
          >
            <OrganicBlob
              size={b.size}
              color={b.color}
              idx={b.blobIdx}
              animated
              face={<BlobFace size={b.size * 0.55} />}
            />
          </div>
        ))}
      </div>

      {/* Logo + tagline */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', position: 'relative', zIndex: 1,
      }}>
        <MeuweLogo height={62} animated />
        <div style={{
          marginTop: 16, fontFamily: F.body, fontSize: 22, fontWeight: 600,
          color: C.ink, opacity: 0.7, textAlign: 'center', maxWidth: 280, lineHeight: 1.4,
          whiteSpace: 'pre-line',
        }}>
          {t('welcome.tagline')}
        </div>
      </div>

      {/* Buttons */}
      <div style={{
        // Native has no store badges below, so it keeps the roomier bottom inset.
        padding: `0 24px calc(${native ? 52 : 24}px + env(safe-area-inset-bottom))`,
        position: 'relative', zIndex: 1,
      }}>
        <button
          onClick={() => onSignIn('google')}
          style={{
            width: '100%', maxWidth: CTA_MAX_W, margin: '0 auto',
            padding: '16px 24px', borderRadius: 999,
            background: '#fff', border: `2.5px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 16, fontWeight: 700, color: C.ink,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4C13 4 4 13 4 24s9 20 20 20s20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.5 2.4c-5.2 0-9.6-3.3-11.3-8L6.1 32.8C9.4 39.5 16.1 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5c-.5.4 7.4-5.4 7.4-15.2c0-1.3-.1-2.6-.4-3.9z" />
          </svg>
          {t('welcome.google')}
        </button>
        <button
          onClick={() => onSignIn('apple')}
          style={{
            width: '100%', maxWidth: CTA_MAX_W, margin: '12px auto 0',
            padding: '16px 24px', borderRadius: 999,
            background: '#000', border: `2.5px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 16, fontWeight: 700, color: '#fff',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 384 512" fill="#fff" aria-hidden="true">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
          </svg>
          {t('welcome.apple')}
        </button>
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: C.inkSoft, fontWeight: 500 }}>
          {(() => {
            const full = t('welcome.terms')
            const word = t('welcome.termsLink')
            const [before, after] = full.split(word)
            // On native, "/terms.html" resolves to capacitor://localhost/... which the
            // system browser can't open (target=_blank → "Failed to open URL" Code=115).
            // Point at the absolute hosted page so Capacitor opens it in the system browser.
            const termsHref = native ? 'https://meuwe.eu/terms.html' : '/terms.html'
            return <>{before}<a href={termsHref} target="_blank" rel="noopener noreferrer" style={{ color: C.inkSoft, textDecoration: 'underline' }}>{word}</a>{after}</>
          })()}
        </div>
        <button
          onClick={() => { db.trackClick('browse_guest'); onSignIn('skip') }}
          style={{
            marginTop: 12, width: '100%', padding: '12px',
            fontSize: 14, color: C.inkSoft, fontWeight: 700, textAlign: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          {t('welcome.skip')}
        </button>
        {/* Store badges — landing hero only. Inside the app they would invite
            someone to install what they are already using. On a phone only that
            phone's store is shown; a desktop visitor sees both. */}
        {!native && (() => {
          const os = mobileOS()
          const shown = os ? [os] : (['ios', 'android'] as const)
          return (
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
              {shown.map(s => <StoreBadge key={s} os={s} />)}
            </div>
          )
        })()}
      </div>

      {webviewNotice && (
        <InAppBrowserModal onClose={() => {
          try { sessionStorage.setItem(NOTICE_KEY, '1') } catch { /* prywatne okno — trudno */ }
          setWebviewNotice(false)
        }} />
      )}
    </div>
  )
}
