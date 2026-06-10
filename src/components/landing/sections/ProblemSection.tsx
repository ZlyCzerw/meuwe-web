import { useTranslation } from 'react-i18next'
import { C } from '../../../lib/tokens'
import { PhoneFrame } from '../PhoneFrame'
import '../landing.css'

export function ProblemSection() {
  const { t } = useTranslation()
  return (
    <section className="lp-section" id="jak-dziala" style={{ background: '#FFF0DF' }}>
      <div className="lp-bignum">01</div>
      <div className="lp-deco" style={{ width: 420, height: 420, background: C.grass, top: 60, left: -100, opacity: 0.13 }} />
      <div className="lp-deco" style={{ width: 280, height: 280, background: C.sky, bottom: 0, right: 200, opacity: 0.14 }} />

      <div className="lp-section-inner rev">
        <div className="lp-text-col">
          <span className="lp-eyebrow lp-anim lp-slide-right lp-delay-1">{t('landing.f1Eyebrow')}</span>
          <h2 className="lp-h2 lp-anim lp-slide-right lp-delay-2" style={{ whiteSpace: 'pre-line' }}>
            {t('landing.f1Title')}
          </h2>
          <p className="lp-body lp-anim lp-slide-right lp-delay-3">{t('landing.f1Body')}</p>
          <div className="lp-chips lp-anim lp-slide-right lp-delay-4">
            {[
              { label: 'impreza',  bg: '#E91E6328' },
              { label: 'piknik',   bg: `${C.grass}28` },
              { label: 'koncert',  bg: `${C.sky}28` },
              { label: 'sport',    bg: `${C.primary}28` },
              { label: 'rodzinne', bg: '#FFD54F28' },
            ].map(ch => (
              <span key={ch.label} className="lp-chip" style={{ background: ch.bg }}>{ch.label}</span>
            ))}
          </div>
        </div>

        <div className="lp-phone-col lp-anim lp-slide-left lp-delay-2">
          <PhoneFrame variant="map" />
        </div>
      </div>
    </section>
  )
}
