import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { C } from '../../../lib/tokens'
import '../landing.css'

export function LandingFooter() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <footer className="lp-footer">
      <div className="lp-footer-top">
        <div className="lp-footer-brand">
          <div className="lp-footer-logo">
            <span style={{ color: C.primary }}>me</span>
            <span style={{ color: C.sky }}>u</span>
            <span style={{ color: C.grass }}>we</span>
          </div>
          <div className="lp-footer-tagline">{t('landing.footer.tagline')}</div>
        </div>

        <div className="lp-footer-cols">
          <div className="lp-footer-col">
            <h4>{t('landing.footer.product')}</h4>
            <ul>
              <li><a href="/#jak-dziala" onClick={e => { e.preventDefault(); document.getElementById('jak-dziala')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.howItWorks')}</a></li>
              <li><a href="/#wydarzenia" onClick={e => { e.preventDefault(); document.getElementById('wydarzenia')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.events')}</a></li>
              <li><a href="/#stworz" onClick={e => { e.preventDefault(); document.getElementById('stworz')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.create')}</a></li>
              <li><a href="/#pobierz" onClick={e => { e.preventDefault(); document.getElementById('pobierz')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.download')}</a></li>
            </ul>
          </div>
          <div className="lp-footer-col">
            <h4>{t('landing.footer.company')}</h4>
            <ul>
              <li><a href="#">{t('landing.footer.about')}</a></li>
              <li><a href="/blog" onClick={e => { e.preventDefault(); navigate('/blog') }}>Blog</a></li>
              <li><a href="#">{t('landing.footer.contact')}</a></li>
            </ul>
          </div>
          <div className="lp-footer-col">
            <h4>{t('landing.footer.legal')}</h4>
            <ul>
              <li><a href="/terms.html">{t('landing.footer.terms')}</a></li>
              <li><a href="#">{t('landing.footer.privacy')}</a></li>
              <li><a href="#">{t('landing.footer.cookies')}</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="lp-footer-bottom">
        <span>{t('landing.footer.copyright')}</span>
        <span>{t('landing.footer.madeIn')}</span>
      </div>
    </footer>
  )
}
