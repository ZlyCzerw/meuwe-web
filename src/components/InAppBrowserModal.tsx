import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'
import { cleanLink, browserEscapeUrl } from '../lib/inAppBrowser'
import StoreBadge from './StoreBadge'
import { deviceStoreOs } from '../lib/stores'

/**
 * Powiadomienie dla kogoś, kto wszedł na meuwe z Facebooka czy Instagrama i
 * siedzi w ich wbudowanej przeglądarce — Google nie pozwala się tam zalogować.
 *
 * To nakładka, nie ekran. Wcześniej ta treść zastępowała cały Welcome, więc
 * razem z logowaniem znikały plakietki sklepów i wejście jako gość; komunikat o
 * jednej zepsutej drodze kasował wszystkie pozostałe. Teraz Welcome zostaje pod
 * spodem, a stąd prowadzą trzy wyjścia: przeglądarka systemowa, skopiowany link
 * i sklep — który zresztą działa z WebView bez żadnej sztuczki.
 */
export default function InAppBrowserModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const url = cleanLink(window.location.href)
  const storeOs = deviceStoreOs()

  function copyLink() {
    navigator.clipboard.writeText(url).catch(() => {
      // clipboard unavailable — the address is on screen to retype either way
    }).finally(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(45,43,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 380,
          maxHeight: '90dvh', overflowY: 'auto',
          background: '#fff', border: `2.5px solid ${INK}`, borderRadius: 28,
          boxShadow: `0 6px 0 ${INK}22`, padding: '28px 24px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}
      >
        <button
          onClick={onClose}
          aria-label={t('webview.close')}
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 34, height: 34, borderRadius: '50%',
            background: C.cream, border: `2px solid ${INK}22`,
            fontSize: 18, fontWeight: 800, color: C.inkSoft,
            lineHeight: 1, cursor: 'pointer',
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 22, color: C.ink, textAlign: 'center' }}>
          {t('webview.title')}
        </div>
        <div style={{
          fontSize: 14, color: C.inkSoft, fontWeight: 600, lineHeight: 1.55,
          textAlign: 'center', whiteSpace: 'pre-line',
        }}>
          {t('webview.body')}
        </div>

        <a
          href={browserEscapeUrl(url)}
          style={{
            width: '100%', padding: '16px', borderRadius: 999,
            background: C.primary, border: `2.5px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
            fontSize: 16, fontWeight: 800, color: '#fff', textAlign: 'center',
            textDecoration: 'none', cursor: 'pointer',
          }}
        >
          {t('webview.openBrowser')}
        </a>

        {/* Druga droga na wypadek, gdyby aplikacja zignorowała x-safari-. */}
        <div style={{
          width: '100%', padding: '10px 14px', borderRadius: 12,
          background: C.cream, border: `1.5px solid ${INK}22`,
          fontSize: 12, color: C.ink, fontWeight: 700,
          wordBreak: 'break-all', textAlign: 'center', lineHeight: 1.5,
        }}>
          {url}
        </div>
        <button
          onClick={copyLink}
          style={{
            width: '100%', padding: '14px', borderRadius: 999,
            background: copied ? C.grass : '#fff',
            border: `2.5px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
            fontSize: 15, fontWeight: 800, color: copied ? '#fff' : C.ink,
            cursor: 'pointer', transition: 'background 200ms ease',
          }}
        >
          {copied ? t('webview.copied') : t('webview.copyLink')}
        </button>
        <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, textAlign: 'center' }}>
          {t('webview.hint')}
        </div>

        {/* Sklep otwiera się z WebView bez przeszkód, więc jest tu równorzędnym
            wyjściem, a nie nagrodą pocieszenia na dole ekranu. */}
        {storeOs && (
          <>
            <div style={{ width: '100%', height: 1, background: `${INK}18`, margin: '4px 0' }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft }}>{t('store.hint')}</div>
            <StoreBadge os={storeOs} />
          </>
        )}
      </div>
    </div>
  )
}
