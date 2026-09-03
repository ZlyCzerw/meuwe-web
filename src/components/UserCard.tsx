import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import { C, INK, F, SHADOW_BUTTON } from '../lib/tokens'
import { db } from '../lib/supabase'
import { authorInitial } from '../lib/authorLabel'
import { cleanLink } from '../lib/inAppBrowser'
import Avatar from './Avatar'
import OrganicBlob from './OrganicBlob'
import type { PublicProfile } from '../lib/types'

// Karta cudzego profilu, otwierana z wiersza "Dodane przez" w karcie wydarzenia.
//
// Obserwowanie jest optymistyczne: etykieta i licznik zmieniają się od razu,
// a nieudany zapis cofa oba i mówi o tym pod przyciskiem - "Obserwujesz ✓"
// na ekranie musi znaczyć, że wiersz jest w bazie. Auto-obserwacja wydarzeń
// twórcy dzieje się w bazie (trigger), karta tylko o niej mówi.

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; profile: PublicProfile }

/** Host bez schematu i "www." - tyle, ile mieści się w jednej linii karty. */
function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

export default function UserCard({
  userId,
  session,
  onAuthNeeded,
  onClose,
}: {
  userId: string
  session: Session | null
  onAuthNeeded: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [following, setFollowing] = useState(false)
  const [followers, setFollowers] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading when userId changes, intentional
    setLoad({ state: 'loading' })
    db.getPublicProfile(userId).then(p => {
      if (!alive) return
      if (!p) { setLoad({ state: 'failed' }); return }
      setFollowing(p.is_following)
      setFollowers(p.followers_count)
      setLoad({ state: 'ready', profile: p })
    })
    return () => { alive = false }
  }, [userId])

  const isMe = !!session && session.user.id === userId
  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }

  async function toggleFollow() {
    if (!session) { onAuthNeeded(); return }
    if (busy) return
    const next = !following
    setBusy(true)
    setFailed(false)
    setFollowing(next)
    setFollowers(n => n + (next ? 1 : -1))
    db.trackClick(next ? 'follow_user' : 'unfollow_user')
    const res = next ? await db.followUser(userId) : await db.unfollowUser(userId)
    setBusy(false)
    if (!res || res.error) {
      setFollowing(!next)
      setFollowers(n => n - (next ? 1 : -1))
      setFailed(true)
    }
  }

  const profile = load.state === 'ready' ? load.profile : null
  const color = profile?.avatar_color || C.sky
  const link = profile?.link_url ? cleanLink(profile.link_url) : null

  return (
    <div
      data-testid="user-card-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 320,
        background: 'rgba(45,43,42,0.45)', animation: 'fadeIn 180ms ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 360, background: '#fff', borderRadius: 32,
          padding: '32px 24px 24px', boxShadow: '0 16px 48px rgba(45,43,42,0.22)',
          animation: 'bubble-up 260ms cubic-bezier(0.32,1.4,0.4,1)', textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Koło z menu bocznego: ten sam gest, ta sama przezroczystość. */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 180, height: 180,
          borderRadius: '50%', background: C.primarySoft, opacity: 0.5, pointerEvents: 'none',
        }} />
        {/* Drugi akcent w kolorze osoby, żeby karta nie była dla każdego taka sama. */}
        <div style={{ position: 'absolute', bottom: -18, left: -18, opacity: 0.35, pointerEvents: 'none' }}>
          <OrganicBlob size={72} color={color} idx={1} />
        </div>

        <button
          onClick={onClose}
          aria-label={t('common.close')}
          style={{
            position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%',
            background: '#fff', border: `2px solid ${INK}22`, color: C.ink,
            fontSize: 18, fontWeight: 800, cursor: 'pointer', lineHeight: 1,
          }}
        >
          ×
        </button>

        {load.state === 'loading' && (
          <div style={{ position: 'relative', animation: 'breathe-sm 1.6s ease-in-out infinite' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', margin: '0 auto 14px', background: C.cream, border: `2.5px solid ${INK}22` }} />
            <div style={{ width: 140, height: 18, borderRadius: 999, margin: '0 auto 10px', background: C.cream }} />
            <div style={{ width: 200, height: 12, borderRadius: 999, margin: '0 auto', background: C.cream }} />
          </div>
        )}

        {load.state === 'failed' && (
          <div style={{ position: 'relative', fontSize: 15, fontWeight: 700, color: C.inkSoft, padding: '16px 0' }}>
            {t('userCard.loadFailed')}
          </div>
        )}

        {profile && (
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Avatar size={72} color={color} initials={authorInitial(profile.id, profile.display_name, deletedLabels)} />
            </div>

            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 900, color: C.ink, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
              {profile.display_name?.trim() || '?'}
            </div>

            {(profile.creator_kind || profile.home_name) && (
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {profile.creator_kind && (
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: C.cream, border: `2px solid ${INK}22`, fontSize: 12, fontWeight: 800, color: C.ink }}>
                    {t(`myData.creatorKind_${profile.creator_kind}`)}
                  </span>
                )}
                {profile.home_name && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: C.cream, border: `2px solid ${INK}22`, fontSize: 12, fontWeight: 800, color: C.ink }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {profile.home_name}
                  </span>
                )}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: C.inkSoft }}>
              {t('userCard.eventsCount', { count: profile.events_count })} · {t('userCard.followersCount', { count: followers })}
            </div>

            {profile.bio && (
              <div style={{ marginTop: 14, fontSize: 15, fontWeight: 600, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {profile.bio}
              </div>
            )}

            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 10, fontSize: 14, fontWeight: 800, color: C.primary, textDecoration: 'none', overflowWrap: 'anywhere' }}
              >
                {linkLabel(link)}
              </a>
            )}

            {isMe ? (
              <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: C.inkSoft }}>{t('userCard.thisIsYou')}</div>
            ) : (
              <>
                <button
                  onClick={toggleFollow}
                  disabled={busy}
                  style={{
                    marginTop: 20, width: '100%', padding: '14px', borderRadius: 999,
                    background: following ? '#fff' : C.primary,
                    color: following ? C.ink : '#fff',
                    fontSize: 16, fontWeight: 800,
                    border: `2.5px solid ${INK}`, boxShadow: SHADOW_BUTTON,
                    cursor: busy ? 'default' : 'pointer',
                  }}
                >
                  {following ? t('userCard.following') : t('userCard.follow')}
                </button>
                {failed && (
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: C.primaryPress, lineHeight: 1.5 }}>
                    {t('userCard.followFailed')}
                  </div>
                )}
                {following && !failed && (
                  <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: C.inkSoft, lineHeight: 1.5 }}>
                    {t('userCard.followingHint')}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
