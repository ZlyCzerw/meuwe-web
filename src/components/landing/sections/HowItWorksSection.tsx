import { useTranslation } from 'react-i18next'
import { C } from '../../../lib/tokens'
import { PhoneFrame } from '../PhoneFrame'
import '../landing.css'

export function HowItWorksSection() {
  const { t } = useTranslation()
  return (
    <section className="lp-section" id="wydarzenia" style={{ background: '#FFF6EC' }}>
      <div className="lp-bignum">02</div>
      <div className="lp-deco" style={{ width: 450, height: 450, background: C.primary, top: 100, right: -100, opacity: 0.11 }} />
      <div className="lp-deco" style={{ width: 250, height: 250, background: '#E91E63', bottom: 60, left: 100, opacity: 0.11 }} />

      <div className="lp-section-inner">
        <div className="lp-text-col">
          <span className="lp-eyebrow lp-anim lp-slide-left lp-delay-1">{t('landing.f2Eyebrow')}</span>
          <h2 className="lp-h2 lp-anim lp-slide-left lp-delay-2" style={{ whiteSpace: 'pre-line' }}>
            {t('landing.f2Title')}
          </h2>
          <p className="lp-body lp-anim lp-slide-left lp-delay-3">{t('landing.f2Body')}</p>
        </div>

        <div className="lp-phone-col lp-anim lp-slide-right lp-delay-2">
          <PhoneFrame variant="event" />
        </div>
      </div>
    </section>
  )
}
