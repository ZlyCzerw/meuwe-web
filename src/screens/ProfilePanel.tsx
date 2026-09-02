import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import TagChip from '../components/TagChip'
import TagPickerModal from '../components/TagPickerModal'
import RadiusSlider from '../components/RadiusSlider'
import { DEFAULT_RADIUS_KM } from '../lib/appConfig'
import { C, INK, F } from '../lib/tokens'
import NotificationDot from '../components/NotificationDot'
import { db } from '../lib/supabase'
import i18n, { setLanguage } from '../lib/i18n'
import { enablePushOnThisDevice, disablePushOnThisDevice, getDevicePushState } from '../lib/push'
import NotificationSetting from './NotificationSetting'
import { resolvePushState } from '../lib/pushState'
import type { DevicePushState } from '../lib/pushState'
import { isAndroid, isIOS } from '../lib/platform'
import type { Profile, Lang } from '../lib/types'
import { shownName, initial, avatarColor } from '../lib/profileDisplay'

function ProfilePanel({
  open,
  onClose,
  session,
  profile,
  onSignOut,
  reloadProfile,
  onOpenMyEvents,
  onOpenFollowedEvents,
  onOpenAccount,
  myEventsUnread = false,
  followedUnread = false,
}: {
  open: boolean
  onClose: () => void
  session: Session | null
  profile: Profile | null
  onSignOut: () => void
  reloadProfile: () => void
  onOpenMyEvents: () => void
  onOpenFollowedEvents: () => void
  onOpenAccount: () => void
  myEventsUnread?: boolean
  followedUnread?: boolean
}) {
  const { t } = useTranslation()

  const [radius, setRadius] = useState<number>(profile?.radius_km ?? DEFAULT_RADIUS_KM)
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])
  const [interestModalOpen, setInterestModalOpen] = useState(false)
  // What this device can do. null = not checked yet.
  const [pushDevice, setPushDevice] = useState<DevicePushState | null>(null)
  const [pushLoading, setPushLoading] = useState(false)
  // Set only when an explicit attempt failed, so the failure is stated instead
  // of leaving a toggle that silently did nothing.
  const [pushError, setPushError] = useState(false)

  // Sync local state when profile loads / changes
  useEffect(() => {
    setRadius(profile?.radius_km ?? DEFAULT_RADIUS_KM)
    setInterests(profile?.interests ?? [])
  }, [profile])

  // Sprawdź stan tego urządzenia przy otwarciu panelu
  useEffect(() => {
    if (!open || !session) return
    getDevicePushState(session.user.id).then(device => {
      setPushDevice(device)
      // A stale failure from a previous visit must not shout at a panel that
      // just re-checked the device.
      setPushError(false)
    })
  }, [open, session])

  // profile.push_enabled is the user's intent, one flag for the whole account.
  // Whether this particular device delivers is a separate question.
  const pushIntent = !!profile?.push_enabled
  const pushState = pushDevice ? resolvePushState(pushIntent, pushDevice) : null

  async function handleTogglePush() {
    if (!session) return
    setPushLoading(true)
    setPushError(false)
    if (pushIntent) {
      // Off means off everywhere (the flag is per account), and this device also
      // gives up its delivery target.
      await disablePushOnThisDevice()
      await db.updateProfile({ id: session.user.id, push_enabled: false })
      setPushDevice(await getDevicePushState(session.user.id))
      reloadProfile()
    } else {
      // The intent is recorded even when the device refuses, so the mismatch
      // stays visible instead of the toggle springing back with no explanation.
      const device = await enablePushOnThisDevice(session.user.id)
      setPushDevice(device)
      await db.updateProfile({ id: session.user.id, push_enabled: true })
      reloadProfile()
      if (!(device.permission === 'granted' && device.registered)) setPushError(true)
    }
    setPushLoading(false)
  }

  // Repair: the intent is already true, only this device is missing.
  async function handleRepairPush() {
    if (!session) return
    setPushLoading(true)
    setPushError(false)
    const device = await enablePushOnThisDevice(session.user.id)
    setPushDevice(device)
    if (!(device.permission === 'granted' && device.registered)) setPushError(true)
    setPushLoading(false)
  }

  const blockedHint = isIOS() ? t('profile.pushBlockedIos')
    : isAndroid() ? t('profile.pushBlockedAndroid')
    : t('profile.pushBlockedWeb')

  function handleRadiusChange(value: number) {
    setRadius(value)
  }

  function handleRadiusCommit(value: number) {
    if (session) {
      db.updateProfile({ id: session.user.id, radius_km: value })
    }
  }

  function handleToggleInterest(tag: string) {
    if (!session) return
    const newArr = interests.includes(tag)
      ? interests.filter(x => x !== tag)
      : [...interests, tag]
    setInterests(newArr)
    db.updateProfile({ id: session.user.id, interests: newArr }).then(() => reloadProfile())
  }

  const initials = session ? initial(profile, session.user.email) : '?'
  const displayName = session ? shownName(profile, session.user.email) : t('profile.guest')

  const currentLang = i18n.language as Lang

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          // fixed (not absolute) so the dim + panel cover the full viewport, including the
          // notch / home-indicator strips where the full-bleed map would otherwise show through.
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          background: 'rgba(45,43,42,0.4)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }}
      />

      {/* Sliding panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          width: '88%',
          maxWidth: 380,
          background: C.cream,
          borderTopRightRadius: 32,
          borderBottomRightRadius: 32,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 380ms cubic-bezier(0.32,1.4,0.4,1)',
          boxShadow: '8px 0 32px rgba(45,43,42,0.15)',
          zIndex: 31,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Decorative corner blob */}
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: C.primarySoft,
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'calc(52px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom))',
            position: 'relative',
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: avatarColor(profile),
              border: `3px solid ${INK}`,
              boxShadow: `0 4px 0 ${INK}33`,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: F.display,
              fontWeight: 900,
              fontSize: 38,
              color: INK,
              animation: 'breathe-sm 4s ease-in-out infinite',
            }}
          >
            {initials}
          </div>

          {/* Name */}
          <div
            style={{
              fontFamily: F.display,
              fontSize: 28,
              fontWeight: 800,
              color: C.ink,
            }}
          >
            {displayName}
          </div>
          {session && (
            <div
              style={{
                fontSize: 13,
                color: C.inkSoft,
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              {session.user.email}
            </div>
          )}

          {/* Content — always visible; grayed out for guests except language */}
          <div style={{ opacity: session ? 1 : 0.4, pointerEvents: session ? 'auto' : 'none' }}>
            {/* Interests */}
            <div style={{ marginTop: 28 }}>
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
                {t('profile.interests')}
              </div>
              <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, marginBottom: 12, fontWeight: 600 }}>
                {t('profile.interestsHint')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {interests.length === 0 && (
                  <div style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600, fontStyle: 'italic' }}>
                    {t('profile.noInterests')}
                  </div>
                )}
                {interests.map(tag => (
                  <TagChip key={tag} category={tag} selected removable onRemove={() => handleToggleInterest(tag)} />
                ))}
                <button
                  onClick={() => setInterestModalOpen(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 999,
                    background: '#fff', color: C.inkSoft,
                    fontSize: 13, fontWeight: 800,
                    border: `2px solid ${C.inkSoft}44`,
                  }}
                >
                  <span style={{ fontSize: 15 }}>＋</span> {t('tagPicker.addButton')}
                </button>
              </div>
            </div>

            {interestModalOpen && (
              <TagPickerModal
                selected={interests}
                onChange={newTags => {
                  setInterests(newTags)
                  if (session) db.updateProfile({ id: session.user.id, interests: newTags }).then(() => reloadProfile())
                }}
                onClose={() => setInterestModalOpen(false)}
              />
            )}

            {/* Moje wydarzenia */}
            <button
              onClick={onOpenMyEvents}
              style={{
                marginTop: 28,
                padding: '16px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderBottom: `1px solid ${C.inkSoft}33`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
                  {t('profile.myEvents')}
                </div>
                {myEventsUnread && <NotificationDot />}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>›</div>
            </button>

            {/* Obserwowane wydarzenia */}
            <button
              onClick={onOpenFollowedEvents}
              style={{
                padding: '16px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderBottom: `1px solid ${C.inkSoft}33`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>
                  {t('profile.followedEvents')}
                </div>
                {followedUnread && <NotificationDot />}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.ink }}>›</div>
            </button>

            {/* Radius */}
            <div style={{ marginTop: 28 }}>
              <RadiusSlider
                value={radius}
                onChange={handleRadiusChange}
                onCommit={handleRadiusCommit}
                label={t('profile.radius')}
              />
            </div>

            {/* Push notifications */}
            <NotificationSetting
              state={pushState}
              intent={pushIntent}
              loading={pushLoading}
              error={pushError}
              blockedHint={blockedHint}
              onToggle={handleTogglePush}
              onRepair={handleRepairPush}
            />
          </div>

          {/* Language switcher — always active */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink, marginBottom: 12 }}>
              {t('profile.language')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['pl', 'en', 'de', 'es', 'sl'] as Lang[]).map(code => {
                const active = currentLang === code
                return (
                  <button
                    key={code}
                    onClick={() => setLanguage(code)}
                    style={{
                      padding: '8px 16px', borderRadius: 999, border: `2px solid ${INK}`,
                      background: active ? C.primary : 'transparent',
                      color: active ? '#fff' : C.ink,
                      fontWeight: 800, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {code.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Account and data + sign out. Column, not two inline buttons, or they
              sit side by side on one line. Same weight for both; the deletion
              itself lives inside the account screen, not on this label. */}
          <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {session && (
              <button
                onClick={onOpenAccount}
                style={{ padding: '12px 0', fontSize: 14, fontWeight: 700, color: C.inkSoft, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('account.entry')}
              </button>
            )}
            <button
              onClick={() => { onSignOut(); onClose() }}
              style={{ padding: '12px 0', fontSize: 14, fontWeight: 700, color: C.inkSoft, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {session ? t('profile.signOut') : t('profile.backToLogin')}
            </button>
          </div>
        <a
          href="/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', textAlign: 'center',
            fontSize: 11, color: C.inkSoft, fontWeight: 500,
            textDecoration: 'underline', padding: '12px 0 4px',
          }}
        >
          {t('welcome.termsLink')}
        </a>
        </div>
      </div>
    </>
  )
}

export default ProfilePanel
