import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import TagChip from '../components/TagChip'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import i18n, { setLanguage } from '../lib/i18n'
import type { Profile, Lang } from '../lib/types'

const ALL_TAGS = ['party', 'outdoor', 'family', 'culture', 'sport', 'food']

function ProfilePanel({
  open,
  onClose,
  session,
  profile,
  onSignOut,
  onSignIn,
  reloadProfile,
  onOpenMyEvents,
}: {
  open: boolean
  onClose: () => void
  session: Session | null
  profile: Profile | null
  onSignOut: () => void
  onSignIn: () => void
  reloadProfile: () => void
  onOpenMyEvents: () => void
}) {
  const { t } = useTranslation()

  const [radius, setRadius] = useState<number>(profile?.radius_km ?? 10)
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? [])

  // Sync local state when profile loads / changes
  useEffect(() => {
    setRadius(profile?.radius_km ?? 10)
    setInterests(profile?.interests ?? [])
  }, [profile])

  function handleRadiusChange(value: number) {
    setRadius(value)
  }

  function handleRadiusCommit(value: number) {
    if (session) {
      db.upsertProfile({ id: session.user.id, radius_km: value })
    }
  }

  function handleToggleInterest(tag: string) {
    if (!session) return
    const newArr = interests.includes(tag)
      ? interests.filter(x => x !== tag)
      : [...interests, tag]
    setInterests(newArr)
    db.upsertProfile({ id: session.user.id, interests: newArr }).then(() => reloadProfile())
  }

  const initials = session
    ? (profile?.display_name || session.user.email || '?')[0].toUpperCase()
    : '?'

  const displayName = session
    ? profile?.display_name || session.user.email?.split('@')[0] || ''
    : t('profile.guest')

  const currentLang = i18n.language as Lang

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
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
          position: 'absolute',
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
          filter: 'url(#meuwe-wobble)',
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
            padding: '52px 24px 32px',
            position: 'relative',
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: profile?.avatar_color || C.berry,
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

          {/* Sign in button (guest) */}
          {!session && (
            <button
              onClick={onSignIn}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '14px 18px',
                borderRadius: 999,
                background: '#fff',
                border: `2.5px solid ${INK}`,
                boxShadow: `0 3px 0 ${INK}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                fontSize: 15,
                fontWeight: 700,
                color: C.ink,
                cursor: 'pointer',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4C13 4 4 13 4 24s9 20 20 20s20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34.5 6 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z"/>
                <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.5c-2 1.5-4.6 2.4-7.5 2.4c-5.2 0-9.6-3.3-11.3-8L6.1 32.8C9.4 39.5 16.1 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.5c-.5.4 7.4-5.4 7.4-15.2c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              {t('welcome.google')}
            </button>
          )}

          {/* Authenticated content */}
          {session && (
            <>
              {/* Interests */}
              <div style={{ marginTop: 28 }}>
                <div
                  style={{
                    fontFamily: F.display,
                    fontSize: 17,
                    fontWeight: 800,
                    color: C.ink,
                  }}
                >
                  {t('profile.interests')}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.inkSoft,
                    marginTop: 4,
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  {t('profile.interestsHint')}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_TAGS.map(tag => (
                    <TagChip
                      key={tag}
                      category={tag}
                      selected={interests.includes(tag)}
                      onClick={() => handleToggleInterest(tag)}
                    />
                  ))}
                </div>
              </div>

              {/* Radius */}
              <div style={{ marginTop: 28 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 17,
                      fontWeight: 800,
                      color: C.ink,
                    }}
                  >
                    {t('profile.radius')}
                  </div>
                  <div
                    style={{
                      fontFamily: F.display,
                      fontSize: 20,
                      fontWeight: 900,
                      color: C.primary,
                    }}
                  >
                    {radius} km
                  </div>
                </div>
                <div style={{ position: 'relative', marginTop: 16, height: 36 }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      left: 0,
                      right: 0,
                      height: 6,
                      borderRadius: 999,
                      background: '#EFE4D2',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 16,
                      left: 0,
                      height: 6,
                      borderRadius: 999,
                      background: C.primary,
                      width: `${(radius / 50) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={radius}
                    onChange={e => handleRadiusChange(Number(e.target.value))}
                    onPointerUp={e => handleRadiusCommit(Number((e.target as HTMLInputElement).value))}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: `calc(${(radius / 50) * 100}% - 13px)`,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#fff',
                      border: `3px solid ${C.primary}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: C.inkSoft,
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  <span>1 km</span>
                  <span>50 km</span>
                </div>
              </div>

              {/* Language switcher */}
              <div style={{ marginTop: 28 }}>
                <div
                  style={{
                    fontFamily: F.display,
                    fontSize: 17,
                    fontWeight: 800,
                    color: C.ink,
                    marginBottom: 12,
                  }}
                >
                  {t('profile.language')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['pl', 'en', 'es'] as Lang[]).map(code => {
                    const active = currentLang === code
                    return (
                      <button
                        key={code}
                        onClick={() => setLanguage(code)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 999,
                          border: `2px solid ${INK}`,
                          background: active ? C.primary : 'transparent',
                          color: active ? '#fff' : C.ink,
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                      >
                        {code.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              </div>

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
                <div
                  style={{
                    fontFamily: F.display,
                    fontSize: 17,
                    fontWeight: 800,
                    color: C.ink,
                  }}
                >
                  {t('profile.myEvents')}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 900,
                    color: C.ink,
                  }}
                >
                  ›
                </div>
              </button>

              {/* Sign out */}
              <button
                onClick={() => { onSignOut(); onClose() }}
                style={{
                  marginTop: 36,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 700,
                  color: C.inkSoft,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('profile.signOut')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default ProfilePanel
