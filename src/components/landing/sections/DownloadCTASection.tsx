import { useTranslation } from 'react-i18next'
import '../landing.css'

function AppleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3.18 23.76c.36.2.78.22 1.16.06l11.5-6.62-2.5-2.5-10.16 9.06z" fill="#EA4335"/>
      <path d="M20.9 10.27L18.1 8.62 15.28 11.5l2.82 2.88 2.8-1.62c.8-.46.8-2.03 0-2.49z" fill="#FBBC04"/>
      <path d="M1.6 1.22C1.25 1.6 1 2.18 1 2.9v18.2c0 .72.25 1.3.6 1.68l.1.09 10.2-10.2v-.24L1.6 1.22z" fill="#4285F4"/>
      <path d="M13.84 13.34l2.62-2.62-10.16-9.06c-.4-.17-.84-.16-1.2.06l8.74 11.62z" fill="#34A853"/>
    </svg>
  )
}

export function DownloadCTASection() {
  const { t } = useTranslation()
  return (
    <section className="lp-cta-section" id="pobierz">
      <div className="lp-deco" style={{ width: 500, height: 500, background: '#fff', top: -160, left: -100, opacity: 0.07 }} />
      <div className="lp-deco" style={{ width: 360, height: 360, background: '#fff', bottom: -80, right: -60, opacity: 0.06 }} />
      <div className="lp-deco" style={{ width: 200, height: 200, background: '#FFD54F', top: '30%', right: '15%', opacity: 0.22 }} />

      <h2 className="lp-h2 lp-anim lp-slide-up" style={{ color: '#fff', textAlign: 'center', maxWidth: 640, margin: '0 auto 24px' }}>
        {t('landing.downloadTitle')}
      </h2>
      <p className="lp-body lp-anim lp-slide-up lp-delay-1" style={{ color: 'rgba(255,246,236,0.75)', maxWidth: 400, margin: '0 auto 52px', textAlign: 'center' }}>
        {t('landing.downloadBody')}
      </p>
      <div className="lp-stores lp-anim lp-slide-up lp-delay-2">
        <a href="#" className="lp-store-btn">
          <AppleIcon />
          <div>
            <span className="lp-store-label-top">{t('landing.footer.storePre')}</span>
            <span className="lp-store-label-main">App Store</span>
          </div>
        </a>
        <a href="#" className="lp-store-btn lp-disabled">
          <GoogleIcon />
          <div>
            <span className="lp-store-label-top">{t('landing.footer.storePre')}</span>
            <span className="lp-store-label-main">Google Play</span>
          </div>
        </a>
      </div>
    </section>
  )
}
