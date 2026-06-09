import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'
import { setLanguage } from '../../../lib/i18n'
import type { Lang } from '../../../lib/types'

const LANGS: Lang[] = ['pl', 'en', 'de', 'es']

export function LandingFooter() {
  const { t, i18n } = useTranslation()
  return (
    <footer style={{ background: C.ink, padding: '40px 24px' }}>
      <div style={{
        maxWidth: 960, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: F.display, fontSize: 20, fontWeight: 900, color: C.cream }}>meuwe</span>
          <span style={{ fontFamily: F.body, fontSize: 13, color: `${C.cream}99` }}>© 2026 meuwe</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="/terms.html" style={{ fontFamily: F.body, fontSize: 13, color: `${C.cream}cc`, textDecoration: 'none' }}>
            {t('landing.footer.terms')}
          </a>
          <span style={{ display: 'flex', gap: 4 }}>
            {LANGS.map(l => (
              <button key={l} onClick={() => setLanguage(l)} style={{
                fontFamily: F.body, fontSize: 11, fontWeight: i18n.language === l ? 800 : 500,
                color: i18n.language === l ? C.cream : `${C.cream}66`,
                background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', padding: '2px 4px',
              }}>{l}</button>
            ))}
          </span>
        </div>
      </div>
    </footer>
  )
}
