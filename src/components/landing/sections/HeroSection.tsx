import { useTranslation } from 'react-i18next'
import Welcome from '../../../screens/Welcome'

interface Props {
  onSignIn: (mode: 'google' | 'skip') => void
}

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1,
  padding: 0, margin: -1, overflow: 'hidden',
  clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
}

export function HeroSection({ onSignIn }: Props) {
  const { t } = useTranslation()
  return (
    <section id="hero" style={{ height: '85dvh' }}>
      <h1 style={srOnly}>{t('welcome.tagline').replace('\n', ' ')}</h1>
      <Welcome onSignIn={onSignIn} />
    </section>
  )
}
