import type { Category } from './tokens'

export type Lang = 'pl' | 'en' | 'es'
export type EventStatus = 'live' | 'upcoming' | 'extended' | 'ended'

export interface Profile {
  id: string
  display_name: string | null
  avatar_color: string | null
  radius_km: number | null
  interests: string[] | null
  created_at: string
}

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
}

export interface EventWithMeta extends EventRow {
  tags: string[]
  distKm: number
  distStr: string
  profiles?: { display_name: string | null; avatar_color: string | null } | null
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
