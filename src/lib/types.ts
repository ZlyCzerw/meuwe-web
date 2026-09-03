import type { Category } from './tokens'
import type { CreatorKind, Gender, ResidenceStatus, Occupation, FoundVia } from './profileFields'
import type { SignupPlatform, SignupProvider, SignupSource } from './signupContext'

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
  /** Jedno zdanie o sobie, ≤ 160 znaków. Publiczne. */
  bio: string | null
  /** Miejscowość wybrana z listy; współrzędne leżą w profiles_private. Publiczne. */
  home_name: string | null
  /** Osoba prywatna / organizator / lokal / społeczność. Publiczne. */
  creator_kind: CreatorKind | null
  /** Jedna strona lub profil w social mediach. Publiczne. */
  link_url: string | null
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

/**
 * Cudzy profil na karcie użytkownika - wynik RPC get_public_profile.
 * display_name to profiles.name_shown pod tym samym aliasem, co PROFILE_PUBLIC
 * w supabase.ts, żeby każdy ekran czytał jedno pole.
 */
export interface PublicProfile {
  id: string
  display_name: string | null
  avatar_color: string | null
  bio: string | null
  home_name: string | null
  creator_kind: CreatorKind | null
  link_url: string | null
  /** Publiczne wydarzenia twórcy, łącznie z zakończonymi - to jego dorobek. */
  events_count: number
  followers_count: number
  /** Czy zalogowany użytkownik obserwuje ten profil; dla gościa zawsze false. */
  is_following: boolean
}

/**
 * Dane, które widzi tylko właściciel (RLS auth.uid() = id) - to, co podał w
 * „O Tobie”, i to, co aplikacja zapisała sama przy rejestracji. Wiersz powstaje
 * leniwie, przy pierwszym zapisie, więc może go nie być.
 */
export interface ProfilePrivate {
  id: string
  birth_year: number | null
  gender: Gender | null
  residence_status: ResidenceStatus | null
  occupation: Occupation | null
  university: string | null
  field_of_study: string | null
  found_via: FoundVia | null
  home_lat: number | null
  home_lng: number | null
  signup_ip_lat: number | null
  signup_ip_lng: number | null
  signup_country: string | null
  signup_gps_lat: number | null
  signup_gps_lng: number | null
  signup_platform: SignupPlatform | null
  signup_app_version: string | null
  signup_provider: SignupProvider | null
  signup_source: SignupSource | null
  signup_recorded_at: string | null
  updated_at: string
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
