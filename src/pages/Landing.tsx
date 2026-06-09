import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LandingNav } from '../components/landing/LandingNav'
import { HeroSection } from '../components/landing/sections/HeroSection'
import { ProblemSection } from '../components/landing/sections/ProblemSection'
import { HowItWorksSection } from '../components/landing/sections/HowItWorksSection'
import { FeaturesSection } from '../components/landing/sections/FeaturesSection'
import { DownloadCTASection } from '../components/landing/sections/DownloadCTASection'
import { LandingFooter } from '../components/landing/sections/LandingFooter'

interface Props {
  onSignIn: (mode: 'google' | 'skip') => void
}

export function Landing({ onSignIn }: Props) {
  const location = useLocation()

  useEffect(() => {
    const anchor = (location.state as any)?.scrollTo as string | undefined
    if (!anchor) return
    const id = anchor.replace('#', '')
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [location.state])

  function openApp() {
    document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ overflowX: 'hidden' }}>
      <LandingNav />
      <HeroSection onSignIn={onSignIn} />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <DownloadCTASection onOpenApp={openApp} />
      <LandingFooter />
    </div>
  )
}
