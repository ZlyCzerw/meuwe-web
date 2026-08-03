// Nazwa użytkownika wybrana ręcznie w panelu konta.
//
// Granice muszą się zgadzać z ograniczeniem `profiles_nickname_len` w bazie
// (migracja 20260803_profile_nickname). Walidacja tutaj jest po to, żeby
// użytkownik dostał zrozumiały komunikat zamiast błędu z Postgresa — baza
// zostaje ostatnią linią obrony.

export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 30

export type NicknameCheck =
  | { ok: true; value: string }
  | { ok: false; reason: 'empty' | 'tooShort' | 'tooLong' }

export function validateNickname(raw: string): NicknameCheck {
  // Spacje w środku sprowadzamy do jednej, przy okazji znikają znaki nowej
  // linii wklejone ze schowka.
  const value = raw.replace(/\s+/g, ' ').trim()
  if (!value) return { ok: false, reason: 'empty' }
  if (value.length < NICKNAME_MIN) return { ok: false, reason: 'tooShort' }
  if (value.length > NICKNAME_MAX) return { ok: false, reason: 'tooLong' }
  return { ok: true, value }
}
