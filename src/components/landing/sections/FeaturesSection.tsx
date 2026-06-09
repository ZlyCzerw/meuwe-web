import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

const FEATURES = [
  { icon: '📍', titleKey: 'landing.features.f1.title' as const, descKey: 'landing.features.f1.desc' as const },
  { icon: '🔒', titleKey: 'landing.features.f2.title' as const, descKey: 'landing.features.f2.desc' as const },
  { icon: '🔔', titleKey: 'landing.features.f3.title' as const, descKey: 'landing.features.f3.desc' as const },
  { icon: '👤', titleKey: 'landing.features.f4.title' as const, descKey: 'landing.features.f4.desc' as const },
]

export function FeaturesSection() {
  const { t } = useTranslation()
  return (
    <section id="features" style={{ background: C.cream, padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 48 }}>
          {t('landing.features.title')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
          {FEATURES.map(({ icon, titleKey, descKey }) => (
            <div key={titleKey} style={{
              background: '#fff', border: `2.5px solid ${C.ink}`, borderRadius: 24,
              boxShadow: `4px 4px 0 ${C.ink}`, padding: 24,
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: 36 }}>{icon}</div>
              <h3 style={{ fontFamily: F.display, fontSize: 20, fontWeight: 800, color: C.ink, margin: 0 }}>{t(titleKey)}</h3>
              <p style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.inkSoft, lineHeight: 1.6, margin: 0 }}>{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
