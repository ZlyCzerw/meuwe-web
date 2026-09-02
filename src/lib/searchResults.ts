// src/lib/searchResults.ts
//
// Wyszukiwarka na mapie pokazuje w jednej liście miejsca (Photon) i wydarzenia
// (nasza baza, po tytule). Tu mieszka to, co da się policzyć bez sieci: jak
// obie grupy dzielą miejsce na liście, jak sortować trafienia i co wolno
// wysłać do PostgREST w treści zapytania.

import { haversineKm } from './geo'
import type { PlaceResult } from './placeSearch'
import type { Category } from './tokens'

/** Lekki wiersz z bazy - tyle, ile trzeba, żeby narysować pozycję na liście. */
export interface EventHit {
  id: string
  title: string
  category: Category
  place_name: string | null
  start_time: string
  lat: number
  lng: number
}

export type SearchResult =
  | { kind: 'place'; place: PlaceResult }
  | { kind: 'event'; event: EventHit }

/** Po tyle z każdej grupy, gdy obie mają co pokazać. */
export const MIXED_LIMIT = 3
/** Tyle dostaje grupa, gdy druga jest pusta - jak sama wyszukiwarka miejsc. */
export const SOLO_LIMIT = 5

export function mergeSearchResults(places: PlaceResult[], events: EventHit[]): SearchResult[] {
  const placeLimit = events.length === 0 ? SOLO_LIMIT : MIXED_LIMIT
  const eventLimit = places.length === 0 ? SOLO_LIMIT : MIXED_LIMIT
  return [
    ...places.slice(0, placeLimit).map(place => ({ kind: 'place' as const, place })),
    ...events.slice(0, eventLimit).map(event => ({ kind: 'event' as const, event })),
  ]
}

export function sortEventHits(hits: EventHit[], near: { lat: number; lng: number } | null): EventHit[] {
  if (!near) return hits
  return [...hits].sort((a, b) =>
    haversineKm(near.lat, near.lng, a.lat, a.lng) - haversineKm(near.lat, near.lng, b.lat, b.lng))
}

/** `%` i `_` to wzorce ilike, przecinek i nawiasy to składnia filtrów PostgREST. */
export function sanitizeSearchQuery(q: string): string {
  return q.replace(/[%_,()]/g, '').trim()
}
