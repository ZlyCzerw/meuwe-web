import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import '../landing.css'
import { MeuweLogo } from '../../MeuweLogo'
import { openCookieSettings } from '../../../lib/consent'

export function LandingFooter() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <footer className="lp-footer">
      <div className="lp-footer-top">
        <div className="lp-footer-brand">
          <MeuweLogo height={24} style={{ marginBottom: 10 }} />
        </div>

        <div className="lp-footer-cols">
          <div className="lp-footer-col">
            <h3>{t('landing.footer.product')}</h3>
            <ul>
              <li><a href="/#jak-dziala" onClick={e => { e.preventDefault(); document.getElementById('jak-dziala')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.howItWorks')}</a></li>
              <li><a href="/#wydarzenia" onClick={e => { e.preventDefault(); document.getElementById('wydarzenia')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.events')}</a></li>
              <li><a href="/#stworz" onClick={e => { e.preventDefault(); document.getElementById('stworz')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.create')}</a></li>
              <li><a href="/#pobierz" onClick={e => { e.preventDefault(); document.getElementById('pobierz')?.scrollIntoView({ behavior: 'smooth' }) }}>{t('landing.nav.download')}</a></li>
            </ul>
          </div>
          <div className="lp-footer-col">
            <h3>{t('landing.footer.company')}</h3>
            <ul>
              <li><a href="#">{t('landing.footer.about')}</a></li>
              <li><a href="/blog" onClick={e => { e.preventDefault(); navigate('/blog') }}>Blog</a></li>
              <li><a href="mailto:meuweteam@gmail.com">{t('landing.footer.contact')}</a></li>
            </ul>
          </div>
          <div className="lp-footer-col">
            <h3>{t('landing.footer.legal')}</h3>
            <ul>
              <li><a href="/terms.html">{t('landing.footer.terms')}</a></li>
              <li><a href="/privacy.html">{t('landing.footer.privacy')}</a></li>
              <li><button type="button" className="lp-footer-linkbtn" onClick={openCookieSettings}>{t('landing.footer.cookies')}</button></li>
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
