import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import i18n from 'i18next'
import '../../lib/i18n'
import { CookieConsent } from './CookieConsent'
import { readConsent, saveConsent, openCookieSettings } from '../../lib/consent'

const t = (key: string) => i18n.t(`landing.cookies.${key}`)

beforeEach(() => localStorage.clear())

describe('CookieConsent', () => {
  it('asks the visitor who has not decided yet', () => {
    render(<CookieConsent />)
    expect(screen.getByRole('dialog', { name: t('title') })).toBeInTheDocument()
  })

  it('stays out of the way once a decision is stored', () => {
    saveConsent({ analytics: false })
    render(<CookieConsent />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"accept all" turns analytics on and closes', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: t('acceptAll') }))
    expect(readConsent()).toEqual({ analytics: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"only necessary" records a refusal so the banner does not nag again', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: t('necessaryOnly') }))
    expect(readConsent()).toEqual({ analytics: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lets the visitor pick analytics by hand', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: t('customize') }))
    // Niezbędne zawsze włączone i nie do ruszenia; analityczne startują wyłączone.
    const necessary = screen.getByRole('switch', { name: t('necessary') })
    expect(necessary).toBeChecked()
    expect(necessary).toBeDisabled()
    const analytics = screen.getByRole('switch', { name: t('analytics') })
    expect(analytics).not.toBeChecked()
    fireEvent.click(analytics)
    fireEvent.click(screen.getByRole('button', { name: t('save') }))
    expect(readConsent()).toEqual({ analytics: true })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reopens from the footer with the stored choice preselected', () => {
    saveConsent({ analytics: true })
    render(<CookieConsent />)
    act(() => openCookieSettings())
    const analytics = screen.getByRole('switch', { name: t('analytics') })
    expect(analytics).toBeChecked()
    fireEvent.click(analytics)
    fireEvent.click(screen.getByRole('button', { name: t('save') }))
    expect(readConsent()).toEqual({ analytics: false })
  })

  it('links the privacy policy', () => {
    render(<CookieConsent />)
    expect(screen.getByRole('link', { name: t('privacy') })).toHaveAttribute('href', '/privacy.html')
  })
})
