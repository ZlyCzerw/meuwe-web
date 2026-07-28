// Throwaway dev harness: renders the real NotificationSetting in every state so
// the broken ones can be looked at without owning four devices. Not part of the
// app bundle — reached only via /push-preview.html in `npm run dev`.
import { createRoot } from 'react-dom/client'
import '../index.css'
import i18n from '../lib/i18n'
import NotificationSetting from '../screens/NotificationSetting'
import { C, F } from '../lib/tokens'
import type { PushUiState } from '../lib/pushState'

const lang = new URLSearchParams(location.search).get('lang') || 'pl'
i18n.changeLanguage(lang)

const CASES: { state: PushUiState | null; intent: boolean; error: boolean; label: string }[] = [
  { state: 'on', intent: true, error: false, label: 'on — zgoda + zarejestrowane urządzenie' },
  { state: 'needsPermission', intent: true, error: false, label: 'needsPermission — web włączył, natyw nigdy nie pytał' },
  { state: 'needsRegistration', intent: true, error: false, label: 'needsRegistration — zgoda jest, tokenu brak' },
  { state: 'blocked', intent: true, error: false, label: 'blocked — system zablokował' },
  { state: 'needsPermission', intent: true, error: true, label: 'needsPermission + nieudana naprawa' },
  { state: 'off', intent: false, error: false, label: 'off' },
  { state: 'unsupported', intent: false, error: false, label: 'unsupported' },
  { state: null, intent: true, error: false, label: 'sprawdzanie urządzenia' },
]

createRoot(document.getElementById('root')!).render(
  <div style={{ background: '#fff', padding: 24, fontFamily: F.body, display: 'flex', flexWrap: 'wrap', gap: 20 }}>
    {CASES.map((c, i) => (
      <div key={i} style={{ width: 330 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, letterSpacing: 0.4 }}>{c.label}</div>
        <NotificationSetting
          state={c.state}
          intent={c.intent}
          loading={false}
          error={c.error}
          blockedHint={i18n.t('profile.pushBlockedIos')}
          onToggle={() => {}}
          onRepair={() => {}}
        />
      </div>
    ))}
  </div>
)
