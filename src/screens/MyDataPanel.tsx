import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Session } from '@supabase/supabase-js'
import { C, INK, F } from '../lib/tokens'
import { db } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { validateNickname, NICKNAME_MAX } from '../lib/nickname'
import {
  AVATAR_COLORS, BIO_MAX, LINK_URL_MAX, UNIVERSITY_MAX, FIELD_OF_STUDY_MAX,
  CREATOR_KINDS, GENDERS, RESIDENCE_STATUSES, OCCUPATIONS, FOUND_VIA,
  emptyProfileForm, validateProfileForm, homeNameFromPlace,
  type ProfileForm, type ProfileField, type ProfileFieldError,
} from '../lib/profileFields'
import { initial, avatarColor } from '../lib/profileDisplay'
import PlaceSearchInput from '../components/PlaceSearchInput'

// „Moje dane”: jedno miejsce na nazwę, kolor avatara i wszystko, co użytkownik
// zechce o sobie powiedzieć. Wsuwa się nad ProfilePanel i AccountPanel tą samą
// geometrią, warstwę wyżej, bo wchodzi się tu z obu.
//
// Żadne pole nie jest wymagane: puste = placeholder, nie ostrzeżenie. Chipy
// nie mają wartości domyślnej, a tap na wybrany odznacza. Zapis jest jeden, na
// dole - pól jest kilkanaście i człowiek chce raz przejrzeć, raz potwierdzić.

interface Props {
  open: boolean
  onClose: () => void
  session: Session | null
  profile: Profile | null
  onSaved: () => void
}

export default function MyDataPanel({ open, onClose, session, profile, onSaved }: Props) {
  const { t } = useTranslation()
  const [nickname, setNickname] = useState('')
  const [color, setColor] = useState<string>(avatarColor(profile))
  const [form, setForm] = useState<ProfileForm>(emptyProfileForm())
  // Tekst startowy pola miejscowości: ustawiany tylko przy otwarciu, nigdy z
  // form.home - inaczej wyczyszczenie wyboru (onQueryChange) zmieniłoby
  // initialQuery w tym samym renderze, a PlaceSearchInput nadpisałby nim to,
  // co użytkownik właśnie wpisuje, zjadając pierwszy znak.
  const [homeInitial, setHomeInitial] = useState('')
  // Najnowszy profile z propsów, czytany wewnątrz efektu otwarcia - patrz niżej
  // (jak userPosRef w App.tsx: odświeżany po każdym renderze, żeby efekt nie
  // musiał zależeć od `profile` i nie resetował edycji przy jego zmianie).
  const profileRef = useRef(profile)
  useEffect(() => { profileRef.current = profile }, [profile])
  // Ile razy panel był otwierany - klucz na PlaceSearchInput (patrz JSX pola
  // "Miejscowość"), żeby porzucona (nie zapisana) treść pola nie przeżyła
  // zamknięcia panelu: bez tego panel zostaje na stałe zamontowany i
  // wewnętrzny stan pola przetrwałby do następnego otwarcia.
  const [openCount, setOpenCount] = useState(0)
  // Czy wiersz w profiles_private już istnieje: wtedy zapis idzie zawsze, bo
  // wyczyszczenie pola też jest zmianą do zapisania.
  const [privateExists, setPrivateExists] = useState(false)
  const [busy, setBusy] = useState(false)
  const [nickError, setNickError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ProfileFieldError[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  const uid = session?.user.id

  // Stan formularza odświeża się przy każdym otwarciu, nie przy montowaniu:
  // panel jest zamontowany na stałe, jak AccountPanel. Zależy tylko od [open,
  // uid] - prymitywu, nie obiektu session: useSession stawia nowy obiekt
  // Session przy każdym onAuthChange (także TOKEN_REFRESHED), a od obiektu
  // efekt odpalałby się i kasował to, co użytkownik właśnie pisze w otwartym
  // panelu. Gdyby zależał też od profile, to samo zrobiłoby odświeżenie
  // profilu przez rodzica. Aktualny profil czytamy z profileRef.
  useEffect(() => {
    if (!open || !uid) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset formularza tylko na otwarciu, celowo
    setOpenCount(c => c + 1)
    const p = profileRef.current
    setNickname(p?.nickname ?? '')
    setColor(avatarColor(p))
    setHomeInitial(p?.home_name ?? '')
    setNickError(null); setErrors([]); setSaveError(null)
    const base: ProfileForm = {
      ...emptyProfileForm(),
      bio: p?.bio ?? '',
      creatorKind: p?.creator_kind ?? null,
      linkUrl: p?.link_url ?? '',
    }
    setForm(base)
    setPrivateExists(false)
    let cancelled = false
    db.getProfilePrivate(uid).then(priv => {
      if (cancelled) return
      setPrivateExists(!!priv)
      setForm(f => ({
        ...f,
        home: p?.home_name && priv?.home_lat != null && priv?.home_lng != null
          ? { name: p.home_name, lat: priv.home_lat, lng: priv.home_lng }
          : p?.home_name ? { name: p.home_name, lat: NaN, lng: NaN } : null,
        birthYear: priv?.birth_year != null ? String(priv.birth_year) : '',
        gender: priv?.gender ?? null,
        residenceStatus: priv?.residence_status ?? null,
        occupation: priv?.occupation ?? null,
        university: priv?.university ?? '',
        fieldOfStudy: priv?.field_of_study ?? '',
        foundVia: priv?.found_via ?? null,
      }))
    })
    return () => { cancelled = true }
  }, [open, uid])

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    if (errors.length) setErrors(es => es.filter(e => e.field !== key))
  }
  const toggle = <K extends 'creatorKind' | 'gender' | 'residenceStatus' | 'occupation' | 'foundVia'>(key: K, value: ProfileForm[K]) =>
    set(key, (form[key] === value ? null : value) as ProfileForm[K])

  const errorFor = (field: ProfileField) => {
    const e = errors.find(x => x.field === field)
    return e ? t(`myData.error_${e.reason}`) : null
  }

  async function handleSave() {
    if (!session || busy) return
    // Pusta nazwa = „pokazuj tę od dostawcy”, nie błąd. Reszta jak w validateNickname.
    const nickCheck = nickname.trim() === '' ? { ok: true as const, value: null } : validateNickname(nickname)
    if (!nickCheck.ok) { setNickError(t(`account.nickname_${nickCheck.reason}`)); return }
    const check = validateProfileForm(form, new Date())
    if (!check.ok) { setErrors(check.errors); return }
    const v = check.value
    // Miejscowość bez współrzędnych (wiersz prywatny nie istniał, gdy ją zapisano)
    // zostaje nazwą; nie wymyślamy punktu.
    const homeCoords = v.home && Number.isFinite(v.home.lat) ? { lat: v.home.lat, lng: v.home.lng } : null

    setBusy(true); setSaveError(null); setNickError(null)
    const uid = session.user.id
    const pub = await db.updateProfile({
      id: uid, nickname: nickCheck.value, avatar_color: color,
      bio: v.bio, home_name: v.home?.name ?? null, creator_kind: v.creatorKind, link_url: v.linkUrl,
    })
    if (pub.error) {
      console.error('[myData] zapis profiles nieudany:', pub.error)
      setBusy(false); setSaveError(t('myData.saveFailed')); return
    }
    const priv = {
      birth_year: v.birthYear, gender: v.gender, residence_status: v.residenceStatus,
      occupation: v.occupation, university: v.university, field_of_study: v.fieldOfStudy,
      found_via: v.foundVia, home_lat: homeCoords?.lat ?? null, home_lng: homeCoords?.lng ?? null,
    }
    // Kto nic z „O Tobie” nie wypełnił, nie dostaje pustego wiersza.
    const worthWriting = privateExists || Object.values(priv).some(x => x !== null)
    if (worthWriting) {
      const res = await db.upsertProfilePrivate({ id: uid, ...priv })
      if (res.error) {
        console.error('[myData] zapis profiles_private nieudany:', res.error)
        setBusy(false); setSaveError(t('myData.saveFailed')); return
      }
    }
    db.trackClick('profile_save')
    setBusy(false)
    onSaved()
  }

  const initialLetter = initial({ name_shown: nickname.trim() || profile?.display_name, display_name: profile?.display_name }, session?.user.email)

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 34,
          background: 'rgba(45,43,42,0.4)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 0, bottom: 0, left: 0,
          width: '88%', maxWidth: 380,
          background: C.cream,
          borderTopRightRadius: 32, borderBottomRightRadius: 32,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 380ms cubic-bezier(0.32,1.4,0.4,1)',
          boxShadow: '8px 0 32px rgba(45,43,42,0.15)',
          zIndex: 35, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: 'calc(24px + env(safe-area-inset-top)) 24px 24px', overflowY: 'auto', flex: 1 }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
              padding: 0, marginBottom: 20, color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 900 }}>‹</span>
            {t('myData.back')}
          </button>

          <div style={{ fontFamily: F.display, fontSize: 26, fontWeight: 900, color: C.ink, marginBottom: 20 }}>
            {t('myData.title')}
          </div>

          {/* Avatar + paleta */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div
              data-testid="avatar-preview"
              style={{
                width: 96, height: 96, borderRadius: '50%', background: color,
                border: `3px solid ${INK}`, boxShadow: `0 4px 0 ${INK}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.display, fontWeight: 900, fontSize: 38, color: INK,
                animation: 'breathe-sm 4s ease-in-out infinite',
              }}
            >
              {initialLetter}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft }}>
              {t('myData.avatarColor')}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {AVATAR_COLORS.map(c => {
                const active = c === color
                return (
                  <button
                    key={c}
                    aria-label={`${t('myData.avatarColor')} ${c}`}
                    aria-pressed={active}
                    onClick={() => setColor(c)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', background: c, padding: 0, cursor: 'pointer',
                      border: `${active ? 3 : 2.5}px solid ${INK}`,
                      boxShadow: active ? `0 4px 0 ${INK}33` : 'none',
                      transform: active ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                    }}
                  />
                )
              })}
            </div>
          </div>

          {/* Nazwa */}
          <Field id="md-name" label={t('myData.name')} hint={nickError ?? t('account.nicknameHint')} error={!!nickError}>
            <TextInput
              id="md-name" value={nickname} maxLength={NICKNAME_MAX} placeholder={t('myData.namePlaceholder')}
              error={!!nickError} disabled={busy}
              onChange={v => { setNickname(v); if (nickError) setNickError(null) }}
            />
          </Field>

          {/* O mnie */}
          <SectionTitle title={t('myData.aboutMe')} hint={t('myData.aboutMeHint')} />

          <Field id="md-bio" label={t('myData.bio')} hint={errorFor('bio') ?? `${form.bio.length}/${BIO_MAX}`} error={!!errorFor('bio')}>
            <textarea
              id="md-bio" value={form.bio} maxLength={BIO_MAX} rows={3} disabled={busy}
              placeholder={t('myData.bioPlaceholder')}
              onChange={e => set('bio', e.target.value)}
              style={{ ...inputStyle(!!errorFor('bio')), borderRadius: 20, resize: 'none', lineHeight: 1.4 }}
            />
          </Field>

          <Field id="md-home" label={t('myData.home')}>
            <PlaceSearchInput
              key={openCount}
              id="md-home"
              placeholder={t('myData.homePlaceholder')}
              near={null}
              settlementsOnly
              initialQuery={homeInitial}
              labelFor={homeNameFromPlace}
              onSelect={r => set('home', { name: homeNameFromPlace(r), lat: r.lat, lng: r.lng })}
              // Ręczna zmiana tekstu unieważnia wybór: wartość istnieje tylko po wyborze z listy.
              onQueryChange={() => set('home', null)}
              dropdownZIndex={36}
            />
          </Field>

          <ChipRow label={t('myData.creatorKind')} options={CREATOR_KINDS} value={form.creatorKind}
            labelOf={k => t(`myData.creatorKind_${k}`)} onToggle={k => toggle('creatorKind', k)} disabled={busy} />

          <Field id="md-link" label={t('myData.link')} hint={errorFor('linkUrl')} error={!!errorFor('linkUrl')}>
            <TextInput id="md-link" value={form.linkUrl} maxLength={LINK_URL_MAX} placeholder={t('myData.linkPlaceholder')}
              inputMode="url" error={!!errorFor('linkUrl')} disabled={busy} onChange={v => set('linkUrl', v)} />
          </Field>

          {/* O Tobie */}
          <SectionTitle title={t('myData.aboutYou')} hint={t('myData.aboutYouHint')} />

          <Field id="md-year" label={t('myData.birthYear')} hint={errorFor('birthYear')} error={!!errorFor('birthYear')}>
            <TextInput id="md-year" value={form.birthYear} maxLength={4} placeholder={t('myData.birthYearPlaceholder')}
              inputMode="numeric" error={!!errorFor('birthYear')} disabled={busy} onChange={v => set('birthYear', v)} />
          </Field>

          <ChipRow label={t('myData.gender')} options={GENDERS} value={form.gender}
            labelOf={g => t(`myData.gender_${g}`)} onToggle={g => toggle('gender', g)} disabled={busy} />

          <ChipRow label={t('myData.residence')} options={RESIDENCE_STATUSES} value={form.residenceStatus}
            labelOf={r => t(`myData.residence_${r}`)} onToggle={r => toggle('residenceStatus', r)} disabled={busy} />

          <ChipRow label={t('myData.occupation')} options={OCCUPATIONS} value={form.occupation}
            labelOf={o => t(`myData.occupation_${o}`)} onToggle={o => toggle('occupation', o)} disabled={busy} />

          {form.occupation === 'student' && (
            <div style={{ animation: 'fadeIn 180ms ease' }}>
              <Field id="md-uni" label={t('myData.university')} hint={errorFor('university')} error={!!errorFor('university')}>
                <TextInput id="md-uni" value={form.university} maxLength={UNIVERSITY_MAX} error={!!errorFor('university')}
                  disabled={busy} onChange={v => set('university', v)} />
              </Field>
              <Field id="md-field" label={t('myData.fieldOfStudy')} hint={errorFor('fieldOfStudy')} error={!!errorFor('fieldOfStudy')}>
                <TextInput id="md-field" value={form.fieldOfStudy} maxLength={FIELD_OF_STUDY_MAX} error={!!errorFor('fieldOfStudy')}
                  disabled={busy} onChange={v => set('fieldOfStudy', v)} />
              </Field>
            </div>
          )}

          <ChipRow label={t('myData.foundVia')} options={FOUND_VIA} value={form.foundVia}
            labelOf={f => t(`myData.foundVia_${f}`)} onToggle={f => toggle('foundVia', f)} disabled={busy} />
        </div>

        {/* Sticky dół */}
        <div style={{
          padding: '12px 24px calc(16px + env(safe-area-inset-bottom))',
          background: C.cream, borderTop: `1px solid ${INK}18`,
        }}>
          <div style={{ minHeight: 18, marginBottom: 6, fontSize: 12, fontWeight: 700, color: C.primaryPress, textAlign: 'center' }}>
            {saveError ?? ''}
          </div>
          <button
            onClick={handleSave}
            disabled={busy}
            style={{
              width: '100%', padding: '14px', borderRadius: 999,
              background: C.primary, color: '#fff', fontSize: 16, fontWeight: 800,
              border: `2.5px solid ${INK}`, boxShadow: '0 6px 16px rgba(232,90,42,0.28)',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            {busy ? t('common.loading') : t('myData.save')}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              marginTop: 8, width: '100%', padding: '10px', background: 'none', border: 'none',
              color: C.inkSoft, fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Klocki w stylu NicknameModal / przełącznika języka ────────────────────────

function inputStyle(error: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '13px 16px', borderRadius: 999,
    border: `2.5px solid ${error ? C.primaryPress : INK}`,
    background: '#fff', color: C.ink,
    fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  }
}

function TextInput({ id, value, onChange, maxLength, placeholder, inputMode, error, disabled }: {
  id: string; value: string; onChange: (v: string) => void; maxLength: number
  placeholder?: string; inputMode?: 'url' | 'numeric'; error: boolean; disabled: boolean
}) {
  return (
    <input
      id={id} value={value} maxLength={maxLength} placeholder={placeholder} inputMode={inputMode}
      autoComplete="off" disabled={disabled}
      onChange={e => onChange(e.target.value)}
      style={inputStyle(error)}
    />
  )
}

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string | null; error?: boolean; children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 6 }}>
        {label}
      </label>
      {children}
      <div style={{ minHeight: 18, marginTop: 6, fontSize: 12, fontWeight: 700, lineHeight: 1.4, color: error ? C.primaryPress : C.inkSoft }}>
        {hint ?? ''}
      </div>
    </div>
  )
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 800, color: C.ink }}>{title}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, fontWeight: 600 }}>{hint}</div>
    </div>
  )
}

function ChipRow<T extends string>({ label, options, value, labelOf, onToggle, disabled }: {
  label: string; options: readonly T[]; value: T | null
  labelOf: (v: T) => string; onToggle: (v: T) => void; disabled: boolean
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.inkSoft, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(opt => {
          const active = value === opt
          return (
            <button
              key={opt}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onToggle(opt)}
              style={{
                padding: '8px 14px', borderRadius: 999, border: `2px solid ${INK}`,
                background: active ? C.primary : 'transparent',
                color: active ? '#fff' : C.ink,
                fontWeight: 800, fontSize: 13, cursor: 'pointer',
              }}
            >
              {labelOf(opt)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
