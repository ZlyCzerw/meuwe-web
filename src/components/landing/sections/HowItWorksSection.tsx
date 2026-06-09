import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

const STEPS = [
  { n: 1, titleKey: 'landing.how.s1.title' as const, descKey: 'landing.how.s1.desc' as const },
  { n: 2, titleKey: 'landing.how.s2.title' as const, descKey: 'landing.how.s2.desc' as const },
  { n: 3, titleKey: 'landing.how.s3.title' as const, descKey: 'landing.how.s3.desc' as const },
]

export function HowItWorksSection() {
  const { t } = useTranslation()
  return (
    <section id="how" style={{ background: '#fff', padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 48 }}>
          {t('landing.how.title')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
          {STEPS.map(({ n, titleKey, descKey }) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 999,
                background: C.primary, color: '#fff',
                fontFamily: F.display, fontWeight: 900, fontSize: 16,
                border: `2.5px solid ${C.ink}`, flexShrink: 0,
              }}>{n}</span>
              <h3 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 800, color: C.ink, margin: 0 }}>{t(titleKey)}</h3>
              <p style={{ fontFamily: F.body, fontSize: 16, fontWeight: 600, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
