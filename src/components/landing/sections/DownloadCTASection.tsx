import { useTranslation } from 'react-i18next'
import { C, F } from '../../../lib/tokens'

interface Props { onOpenApp: () => void }

export function DownloadCTASection({ onOpenApp }: Props) {
  const { t } = useTranslation()

  const activeBtn: React.CSSProperties = {
    fontFamily: F.body, fontSize: 16, fontWeight: 800, color: '#fff',
    background: C.primary, border: `2.5px solid ${C.ink}`, borderRadius: 999,
    padding: '14px 28px', cursor: 'pointer', boxShadow: `0 4px 0 ${C.ink}33`,
  }
  const disabledBtn: React.CSSProperties = {
    fontFamily: F.body, fontSize: 16, fontWeight: 800, color: C.inkSoft,
    background: '#e0dbd5', border: '2.5px solid #c0bbb5', borderRadius: 999,
    padding: '14px 28px', cursor: 'not-allowed', opacity: 0.4,
  }

  return (
    <section style={{ background: '#fff', padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <h2 style={{ fontFamily: F.display, fontSize: 48, fontWeight: 900, color: C.ink, marginBottom: 16, marginTop: 0 }}>
          {t('landing.cta.title')}
        </h2>
        <p style={{ fontFamily: F.body, fontSize: 18, color: C.inkSoft, marginBottom: 40 }}>
          {t('landing.cta.sub')}
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={activeBtn} onClick={onOpenApp}>{t('landing.cta.openApp')}</button>
          <button style={disabledBtn} disabled>{t('landing.cta.appStore')}</button>
          <button style={disabledBtn} disabled>{t('landing.cta.googlePlay')}</button>
        </div>
      </div>
    </section>
  )
}
