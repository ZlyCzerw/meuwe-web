// Throwaway dev harness: renders the real notification UI in every state so the
// broken ones can be looked at without owning four devices. Not part of the app
// bundle — reached only via /push-preview.html in `npm run dev`.
//
//   /push-preview.html                  → every toggle state
//   /push-preview.html?modal=ask        → the follow notification card
//   /push-preview.html?modal=blocked    → ...after a system block
//   /push-preview.html?promo=android    → the mobile web "get the app" sheet
//   /push-preview.html?step=location    → native first-run location card
//   /push-preview.html?step=invite      → invite friends card
//   /push-preview.html?step=account     → the account and data sub-screen
//   /push-preview.html?step=delete      → the delete confirmation
//   /push-preview.html?lang=en          → any of the five languages
import { createRoot } from 'react-dom/client'
import '../index.css'
import i18n from '../lib/i18n'
import NotificationSetting from '../screens/NotificationSetting'
import FollowNotifyModal from '../components/FollowNotifyModal'
import AppPromoSheet from '../components/AppPromoSheet'
import LocationOnboardingModal from '../components/LocationOnboardingModal'
import InviteFriendsModal from '../components/InviteFriendsModal'
import AccountPanel from '../screens/AccountPanel'
import DeleteAccountModal from '../components/DeleteAccountModal'
import { C, F } from '../lib/tokens'
import type { PushUiState } from '../lib/pushState'

const params = new URLSearchParams(location.search)
i18n.changeLanguage(params.get('lang') || 'pl')

const DEMO_EVENT = {
  id: 'demo-1',
  title: 'Koncert w knajpie',
  description: 'Gramy od 21:00',
  place_name: 'Bar Rynek 4',
  lat: 50.0413,
  lng: 21.999,
  start_time: '2026-08-01T19:00:00+02:00',
  end_time: '2026-08-01T23:30:00+02:00',
}

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

const modal = params.get('modal') as 'ask' | 'blocked' | 'unsupported' | null
const promo = params.get('promo') as 'ios' | 'android' | null
const step = params.get('step') as 'location' | 'invite' | 'account' | 'delete' | null

const root = createRoot(document.getElementById('root')!)

root.render(
  step === 'account' ? (
    <AccountPanel open onClose={() => {}} onDeleted={() => {}} />
  ) : step === 'delete' ? (
    <DeleteAccountModal onDeleted={() => {}} onClose={() => {}} />
  ) : step === 'location' ? (
    <LocationOnboardingModal onAllow={async () => {}} onSkip={() => {}} />
  ) : step === 'invite' ? (
    <InviteFriendsModal onClose={() => {}} />
  ) : promo ? (
    <AppPromoSheet os={promo} onClose={() => {}} />
  ) : modal ? (
    <FollowNotifyModal
      event={DEMO_EVENT}
      userId="demo-user"
      reason={modal}
      onEnabled={() => {}}
      onClose={() => {}}
    />
  ) : (
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
)
