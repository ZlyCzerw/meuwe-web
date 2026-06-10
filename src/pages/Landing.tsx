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

  // Scroll to anchor when navigating from /blog
  useEffect(() => {
    const anchor = (location.state as any)?.scrollTo as string | undefined
    if (!anchor) return
    const id = anchor.replace('#', '')
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [location.state])

  // Scroll-triggered animations via IntersectionObserver
  useEffect(() => {
    // Hero elements animate immediately on mount
    const heroEls = document.querySelectorAll('#hero .lp-anim')
    heroEls.forEach((el, i) => {
      setTimeout(() => el.classList.add('lp-in'), 80 + i * 120)
    })

    // Rest animate on scroll
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('lp-in')
          obs.unobserve(e.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' })

    document.querySelectorAll('.lp-anim:not(#hero .lp-anim)').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div style={{ overflowX: 'hidden' }}>
      <LandingNav />
      <HeroSection onSignIn={onSignIn} />
      <ProblemSection />
      <HowItWorksSection />
      <FeaturesSection />
      <DownloadCTASection />
      <LandingFooter />
    </div>
  )
}
