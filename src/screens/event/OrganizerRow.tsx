import { useTranslation } from 'react-i18next'
import Avatar from '../../components/Avatar'
import { C, INK, F } from '../../lib/tokens'
import { authorLabel, authorInitial } from '../../lib/authorLabel'

// Wiersz "Dodane przez X" pod opisem wydarzenia.
//
// Avatar jest już przyciskiem, więc drugi przycisk obejmuje tylko tekst -
// zagnieżdżony <button> w <button> jest nieprawidłowym HTML-em i czytniki
// ekranu gubią wtedy jeden z nich. Oba prowadzą w to samo miejsce.
//
// creator_id = null znaczy "konto usunięte, wydarzenie zostało": nie ma
// profilu do otwarcia, więc wiersz zostaje zwykłym tekstem.

export default function OrganizerRow({
  creatorId,
  name,
  color,
  isModerator,
  onOpen,
}: {
  creatorId: string | null | undefined
  name: string | null | undefined
  color: string | null | undefined
  isModerator: boolean
  onOpen: (userId: string) => void
}) {
  const { t } = useTranslation()
  const deletedLabels = { deleted: t('account.deletedUser'), unknown: '?' }
  const label = authorLabel(creatorId, name, deletedLabels)
  const initial = authorInitial(creatorId, name, deletedLabels)
  const open = creatorId ? () => onOpen(creatorId) : undefined

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      {open ? (
        <Avatar size={28} initials={initial} color={color || C.sky} onClick={open} />
      ) : (
        // Konto usunięte: Avatar zawsze renderuje <button>, a tu nie ma dokąd
        // kliknąć - powtarzamy jego wygląd zwykłym <div>, żeby nie zostawić
        // martwego przycisku w DOM-ie.
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%', background: color || C.sky,
            border: `2.5px solid ${INK}`, boxShadow: `0 3px 0 ${INK}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: INK, fontWeight: 900, fontSize: 28 * 0.38, fontFamily: F.display, letterSpacing: -0.4,
          }}
        >
          {initial}
        </div>
      )}
      <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 500 }}>
        {t('event.organizer')}{' '}
        {open ? (
          <button
            onClick={open}
            aria-label={t('userCard.openProfile', { name: label })}
            style={{ padding: 0, background: 'none', border: 'none', font: 'inherit', fontWeight: 800, color: C.ink, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: `${C.ink}44`, textUnderlineOffset: 3 }}
          >
            {label}
          </button>
        ) : (
          <strong style={{ color: C.ink }}>{label}</strong>
        )}
      </span>
      {isModerator && (
        <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 999, background: C.primarySoft, color: C.primaryPress, fontSize: 11, fontWeight: 800 }}>{t('event.moderator')}</span>
      )}
    </div>
  )
}
