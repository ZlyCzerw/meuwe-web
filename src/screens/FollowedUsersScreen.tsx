import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useTranslation } from 'react-i18next'
import Avatar from '../components/Avatar'
import OrganicBlob from '../components/OrganicBlob'
import BlobFace from '../components/BlobFace'
import { C, F, INK } from '../lib/tokens'
import { db } from '../lib/supabase'
import { authorInitial } from '../lib/authorLabel'
import { avatarColor } from '../lib/profileDisplay'
import type { FollowedUser } from '../lib/types'
import ListActionButton, { MinusIcon } from '../components/ListActionButton'

// Lista obserwowanych twórców, wejście z menu bocznego pod „Obserwowane”.
// Tap w wiersz otwiera tę samą kartę użytkownika, co organizator w karcie
// wydarzenia - odobserwować można tylko stamtąd, więc lista wczytuje się na
// nowo, gdy karta się zamyka (userCardOpen z true na false).

export default function FollowedUsersScreen({
  session,
  onBack,
  onOpenUser,
  userCardOpen = false,
}: {
  session: Session | null
  onBack: () => void
  onOpenUser: (userId: string) => void
  /** Karta użytkownika leży nad tym ekranem; jej zamknięcie odświeża listę. */
  userCardOpen?: boolean
}) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<FollowedUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session || userCardOpen) return
    let alive = true
    db.getFollowedUsers(session.user.id).then(list => {
      if (!alive) return
      setUsers(list)
      setLoading(false)
    })
    return () => { alive = false }
  }, [session, userCardOpen])

  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }

  // Wiersz znika od razu; nieudany zapis (albo brak sesji) przywraca go.
  async function handleUnfollow(u: FollowedUser) {
    const before = users
    setUsers(prev => prev.filter(x => x.id !== u.id))
    const res = await db.unfollowUser(u.id)
    if (!res || res.error) {
      console.error('[unfollowUser]', res?.error)
      setUsers(before)
    }
  }

  const pill = {
    padding: '2px 8px', borderRadius: 999, background: C.cream,
    border: `1.5px solid ${INK}22`, fontSize: 11, fontWeight: 800, color: C.ink,
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.cream }}>
      <div style={{ padding: '16px 16px 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#fff',
            border: `2px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
            fontSize: 20, fontWeight: 800, color: C.ink,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >‹</button>
        <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 900, color: C.ink, letterSpacing: -0.5 }}>
          {t('profile.followedUsers')}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 24px' }}>
        {loading && (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, fontWeight: 700, color: C.inkSoft }}>
            {t('common.loading')}
          </div>
        )}

        {!loading && users.length === 0 && (
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <OrganicBlob size={72} color={C.primarySoft} idx={1} face={<BlobFace size={48} mood="sleepy" />} />
            <div style={{ fontSize: 15, fontWeight: 700, color: C.inkSoft, lineHeight: 1.5 }}>
              {t('followedUsers.empty')}
            </div>
          </div>
        )}

        {users.map(u => (
          <button
            key={u.id}
            onClick={() => onOpenUser(u.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: 12, marginBottom: 10, borderRadius: 22,
              background: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(78,50,30,0.08)',
              textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box',
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <Avatar size={56} color={avatarColor(u)} initials={authorInitial(u.id, u.display_name, deletedLabels)} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: F.display, fontSize: 16, fontWeight: 800, color: C.ink,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {u.display_name?.trim() || '?'}
              </div>
              {(u.creator_kind || u.home_name) && (
                <div style={{ display: 'flex', gap: 6, marginTop: 4, overflow: 'hidden' }}>
                  {u.creator_kind && <span style={pill}>{t(`myData.creatorKind_${u.creator_kind}`)}</span>}
                  {u.home_name && (
                    <span style={{ ...pill, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.home_name}</span>
                  )}
                </div>
              )}
              {u.bio && (
                <div style={{
                  fontSize: 12, color: C.inkSoft, fontWeight: 600, marginTop: 4,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {u.bio}
                </div>
              )}
            </div>
            <ListActionButton label={t('follow.unfollow')} onClick={() => handleUnfollow(u)}>
              <MinusIcon />
            </ListActionButton>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, flexShrink: 0 }}>›</div>
          </button>
        ))}
      </div>
    </div>
  )
}
