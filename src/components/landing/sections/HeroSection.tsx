import Welcome from '../../../screens/Welcome'

interface Props {
  onSignIn: (mode: 'google' | 'skip') => void
}

export function HeroSection({ onSignIn }: Props) {
  return (
    <section id="hero" style={{ height: '100dvh' }}>
      <Welcome onSignIn={onSignIn} />
    </section>
  )
}
