import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

const PROBLEMS = [
  { emoji: '📱', key: 'landing.problem_p1' as const },
  { emoji: '📌', key: 'landing.problem_p2' as const },
  { emoji: '🗺️', key: 'landing.problem_p3' as const },
]

export function ProblemSection() {
  const { t } = useTranslation()
  return (
    <section style={{ background: C.cream, padding: '80px 24px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 36, fontWeight: 900, color: C.ink, textAlign: 'center', marginBottom: 48 }}>
          {t('landing.problem.title')}
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
          {PROBLEMS.map(({ emoji, key }) => (
            <div key={key} style={{
              background: '#fff', border: `2.5px solid ${C.ink}`, borderRadius: 24,
              boxShadow: `4px 4px 0 ${C.ink}`, padding: 24,
            }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{emoji}</div>
              <p style={{ fontFamily: F.body, fontSize: 16, fontWeight: 600, color: C.ink, lineHeight: 1.5, margin: 0 }}>
                {t(key)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
