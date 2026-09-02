//
// Pola panelu „Moje dane": paleta avatara, limity, listy wartości i walidacja.
//
// Granice muszą się zgadzać z constraintami w migracji
// 20260902_profile_fields. Walidacja tutaj jest po to, żeby użytkownik dostał
// zrozumiały komunikat zamiast błędu z Postgresa - baza zostaje ostatnią linią
// obrony. Ten sam podział co w nickname.ts.

import { C, TAG_META } from './tokens'

/** To, co handle_new_user wpisuje każdemu nowemu kontu. */
export const DEFAULT_AVATAR_COLOR: string = C.primary

/**
 * Osiem kolorów z palety aplikacji. Nie ma dowolnego pickera: każdy z tych
 * kolorów ma sprawdzony kontrast z czarnym inicjałem i pasuje do pinezek.
 */
export const AVATAR_COLORS: readonly string[] = [
  C.primary, C.sky, C.grass, C.sunshine, C.berry,
  TAG_META.music.color, TAG_META.festival.color, TAG_META.art.color,
]

export const BIO_MAX = 160
export const HOME_NAME_MAX = 80
export const LINK_URL_MAX = 200
export const UNIVERSITY_MAX = 80
export const FIELD_OF_STUDY_MAX = 80
export const BIRTH_YEAR_MIN = 1900
/** Próg wieku z regulaminu (RODO art. 8). */
export const MIN_AGE = 16

export const CREATOR_KINDS = ['person', 'organizer', 'venue', 'community'] as const
export const GENDERS = ['female', 'male', 'other'] as const
export const RESIDENCE_STATUSES = ['local', 'newcomer', 'visitor'] as const
export const OCCUPATIONS = ['student', 'working', 'other'] as const
export const FOUND_VIA = ['friend', 'poster', 'social', 'store', 'university', 'other'] as const

export type CreatorKind = typeof CREATOR_KINDS[number]
export type Gender = typeof GENDERS[number]
export type ResidenceStatus = typeof RESIDENCE_STATUSES[number]
export type Occupation = typeof OCCUPATIONS[number]
export type FoundVia = typeof FOUND_VIA[number]

/** Miejscowość wybrana z listy: nazwa do profiles, współrzędne do profiles_private. */
export interface HomePlace { name: string; lat: number; lng: number }

/** Stan formularza - teksty tak, jak wpisał je użytkownik. */
export interface ProfileForm {
  bio: string
  home: HomePlace | null
  creatorKind: CreatorKind | null
  linkUrl: string
  /** Tekst z inputu; '' = nie podano. */
  birthYear: string
  gender: Gender | null
  residenceStatus: ResidenceStatus | null
  occupation: Occupation | null
  university: string
  fieldOfStudy: string
  foundVia: FoundVia | null
}

/** Znormalizowany wynik walidacji - gotowy do zapisu, null zamiast pustych. */
export interface ProfileFormValue {
  bio: string | null
  home: HomePlace | null
  creatorKind: CreatorKind | null
  linkUrl: string | null
  birthYear: number | null
  gender: Gender | null
  residenceStatus: ResidenceStatus | null
  occupation: Occupation | null
  university: string | null
  fieldOfStudy: string | null
  foundVia: FoundVia | null
}

export type ProfileField = 'bio' | 'linkUrl' | 'birthYear' | 'university' | 'fieldOfStudy'
export type ProfileFieldReason = 'tooLong' | 'invalidUrl' | 'outOfRange'
export interface ProfileFieldError { field: ProfileField; reason: ProfileFieldReason }

export function emptyProfileForm(): ProfileForm {
  return {
    bio: '', home: null, creatorKind: null, linkUrl: '', birthYear: '',
    gender: null, residenceStatus: null, occupation: null,
    university: '', fieldOfStudy: '', foundVia: null,
  }
}

export function maxBirthYear(now: Date): number {
  return now.getFullYear() - MIN_AGE
}

/** Etykieta z wyniku Photon, przycięta do limitu kolumny. */
export function homeNameFromPlace(p: { primary: string; secondary: string }): string {
  return [p.primary, p.secondary].filter(Boolean).join(', ').slice(0, HOME_NAME_MAX)
}

/** Spacje w środku do jednej, znaki nowej linii ze schowka znikają; pusty → null. */
function tidy(raw: string): string | null {
  const v = raw.replace(/\s+/g, ' ').trim()
  return v === '' ? null : v
}

/** Adres strony: bez schematu dostaje https://, musi się parsować i mieć kropkę w hoście. */
function normalizeUrl(raw: string): { ok: true; value: string | null } | { ok: false; reason: ProfileFieldReason } {
  const t = tidy(raw)
  if (t === null) return { ok: true, value: null }
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  let parsed: URL
  try { parsed = new URL(withScheme) } catch { return { ok: false, reason: 'invalidUrl' } }
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.')) return { ok: false, reason: 'invalidUrl' }
  if (withScheme.length > LINK_URL_MAX) return { ok: false, reason: 'tooLong' }
  return { ok: true, value: withScheme }
}

export function validateProfileForm(
  form: ProfileForm,
  now: Date,
): { ok: true; value: ProfileFormValue } | { ok: false; errors: ProfileFieldError[] } {
  const errors: ProfileFieldError[] = []

  const bio = tidy(form.bio)
  if (bio !== null && bio.length > BIO_MAX) errors.push({ field: 'bio', reason: 'tooLong' })

  const link = normalizeUrl(form.linkUrl)
  if (!link.ok) errors.push({ field: 'linkUrl', reason: link.reason })

  let birthYear: number | null = null
  const yearText = form.birthYear.trim()
  if (yearText !== '') {
    const n = /^\d{4}$/.test(yearText) ? Number(yearText) : NaN
    if (!Number.isFinite(n) || n < BIRTH_YEAR_MIN || n > maxBirthYear(now)) {
      errors.push({ field: 'birthYear', reason: 'outOfRange' })
    } else {
      birthYear = n
    }
  }

  // Uczelnia i kierunek mają sens tylko dla studenta. Kto przełączył chip na
  // „pracuję", nie zostawia po sobie starych wartości w bazie.
  const isStudent = form.occupation === 'student'
  const university = isStudent ? tidy(form.university) : null
  const fieldOfStudy = isStudent ? tidy(form.fieldOfStudy) : null
  if (university !== null && university.length > UNIVERSITY_MAX) errors.push({ field: 'university', reason: 'tooLong' })
  if (fieldOfStudy !== null && fieldOfStudy.length > FIELD_OF_STUDY_MAX) errors.push({ field: 'fieldOfStudy', reason: 'tooLong' })

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      bio,
      home: form.home,
      creatorKind: form.creatorKind,
      linkUrl: link.ok ? link.value : null,
      birthYear,
      gender: form.gender,
      residenceStatus: form.residenceStatus,
      occupation: form.occupation,
      university,
      fieldOfStudy,
      foundVia: form.foundVia,
    },
  }
}
