import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './lib/i18n'
import App from './App'
import Blog from './pages/Blog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SplashScreen } from '@capacitor/splash-screen'

const rootEl = document.getElementById('root')!

const app = (
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/blog" element={<Blog />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)

if (rootEl.innerHTML.trim().length > 0) {
  hydrateRoot(rootEl, app)
} else {
  createRoot(rootEl).render(app)
}

// Hide the native splash only after the first frames have painted, so the branded
// splash covers the WebView boot instead of a black flash. No-op on web.
requestAnimationFrame(() => requestAnimationFrame(() => {
  SplashScreen.hide().catch(() => {})
}))
