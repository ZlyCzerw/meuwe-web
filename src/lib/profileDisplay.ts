//
// Jedno miejsce dla reguły „co pokazać jako mnie”: nazwa, inicjał, kolor.
//
// Ta reguła była skopiowana w pięciu miejscach i w jednym (MapScreen) skopiowana
// źle - avatar na mapie liczył literę z display_name, a menu z name_shown, więc
// po zmianie nazwy użytkownik widział dwie różne litery w tej samej aplikacji.
// Dla cudzych profili (autor wydarzenia, wiadomości) obowiązuje authorLabel.ts,
// bo tam liczy się jeszcze „konto usunięte”.

import { DEFAULT_AVATAR_COLOR } from './profileFields'

export type NameSource = { name_shown?: string | null; display_name?: string | null } | null | undefined

/** name_shown (nickname albo nazwa od dostawcy) → display_name → przedrostek e-maila → ''. */
export function shownName(profile: NameSource, email?: string | null): string {
  return profile?.name_shown || profile?.display_name || email?.split('@')[0] || ''
}

/** Pierwsza litera shownName, wielka; '?' gdy nie ma z czego. */
export function initial(profile: NameSource, email?: string | null): string {
  return (shownName(profile, email).charAt(0) || '?').toUpperCase()
}

export function avatarColor(profile: { avatar_color?: string | null } | null | undefined): string {
  return profile?.avatar_color || DEFAULT_AVATAR_COLOR
}
