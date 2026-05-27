import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to error reporting service here
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#FFF6EC', gap: 16, padding: 24,
          fontFamily: '"Nunito",ui-rounded,system-ui,sans-serif',
        }}>
          <div style={{
            fontSize: 48, fontWeight: 900,
            fontFamily: '"Hanken Grotesk","Nunito",ui-rounded,system-ui,sans-serif',
            letterSpacing: -2, display: 'flex',
          }}>
            <span style={{ color: '#FF7A45' }}>me</span>
            <span style={{ color: '#4FC3F7' }}>u</span>
            <span style={{ color: '#7DD87A' }}>we</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#2D2B2A', textAlign: 'center' }}>
            Coś poszło nie tak
          </div>
          <div style={{ fontSize: 12, color: '#8A8580', fontWeight: 600, textAlign: 'center', maxWidth: 280 }}>
            {this.state.error?.message || 'Nieznany błąd'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '12px 24px', borderRadius: 999,
              background: '#FF7A45', color: '#fff', fontSize: 14, fontWeight: 800,
              border: '2.5px solid #2D2B2A',
            }}
          >
            Odśwież aplikację
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
