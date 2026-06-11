import { useTranslation } from 'react-i18next'
import { C } from '../../../lib/tokens'
import { PhoneFrame } from '../PhoneFrame'
import '../landing.css'

const NEW_SCREENSHOTS: Record<string, string> = {
  pl: '/screenshots/new-pl.png',
  en: '/screenshots/new-en.png',
  de: '/screenshots/new-de.png',
  es: '/screenshots/new-es.png',
}

export function FeaturesSection() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.slice(0, 2) ?? 'en'
  const screenshot = NEW_SCREENSHOTS[lang] ?? NEW_SCREENSHOTS['en']
  const steps = [
    t('landing.step1'),
    t('landing.step2'),
    t('landing.step3'),
  ]
  return (
    <section className="lp-section" id="stworz" style={{ background: '#FFF0DF' }}>
      <div className="lp-deco" style={{ width: 400, height: 400, background: '#FFD54F', top: 0, right: 0, opacity: 0.18 }} />
      <div className="lp-deco" style={{ width: 280, height: 280, background: C.grass, bottom: 0, left: '30%', opacity: 0.13 }} />

      <div className="lp-section-inner rev">
        <div className="lp-text-col">
          <span className="lp-eyebrow lp-anim lp-slide-right lp-delay-1">{t('landing.f3Eyebrow')}</span>
          <h2 className="lp-h2 lp-anim lp-slide-right lp-delay-2" style={{ whiteSpace: 'pre-line' }}>
            {t('landing.f3Title')}
          </h2>
          <p className="lp-body lp-anim lp-slide-right lp-delay-3">{t('landing.f3Body')}</p>

          <div className="lp-anim lp-slide-right lp-delay-4" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: C.primary, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
                  fontWeight: 900, fontSize: 15, flexShrink: 0,
                  border: '2px solid #2D2B2A',
                }}>{i + 1}</div>
                <span style={{
                  fontFamily: '"Nunito", system-ui, sans-serif',
                  fontWeight: 700, fontSize: 16, color: '#5C564E',
                }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lp-phone-col lp-anim lp-slide-left lp-delay-2">
          <PhoneFrame variant="create" screenshot={screenshot} />
        </div>
      </div>
    </section>
  )
}
