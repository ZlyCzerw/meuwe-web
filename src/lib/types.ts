import type { Category } from './tokens'

export type Lang = 'pl' | 'en' | 'es' | 'de' | 'sl'
export type EventStatus = 'live' | 'upcoming' | 'extended' | 'ended'

export interface Profile {
  id: string
  /** Nazwa od dostawcy logowania, ustawiana raz przy rejestracji. */
  display_name: string | null
  /** Nazwa wybrana przez użytkownika; null = zostaje ta od dostawcy. */
  nickname: string | null
  /** Nazwa do pokazania. Liczona w bazie: nickname, a w jego braku display_name. */
  name_shown: string | null
  avatar_color: string | null
  radius_km: number | null
  interests: string[] | null
  /**
   * Kiedy konto odpowiedziało na krok z zainteresowaniami; null = nigdy.
   * Osobno od `interests`, bo wyczyszczenie tagów też jest odpowiedzią —
   * patrz shouldAskInterests w lib/onboarding.
   */
  interests_onboarded_at: string | null
  last_lat: number | null
  last_lng: number | null
  last_seen_at: string | null
  created_at: string
  push_enabled: boolean | null
  language: string | null
}

// Push state lives in pushState.ts: one flag for the user's intent
// (Profile.push_enabled) plus a per-device state, never collapsed into one enum.
export type { PushPermission, DevicePushState, PushUiState } from './pushState'

export interface EventRow {
  id: string
  title: string
  description: string | null
  lat: number
  lng: number
  place_name: string | null
  category: Category
  start_time: string
  end_time: string
  creator_id: string | null
  status: EventStatus
  created_at: string
  photos: string[] | null
  is_private: boolean
}

export interface EventWithMeta extends EventRow {
  tags: string[]
  distKm: number
  distStr: string
  profiles?: { display_name: string | null; avatar_color: string | null } | null
  interactionCount?: number
}

export interface EventWithMsgCount extends EventWithMeta {
  msgCount: number
}

export interface Message {
  id: string
  event_id: string
  author_id: string | null
  author_name: string | null
  author_color: string | null
  text: string
  created_at: string
}
