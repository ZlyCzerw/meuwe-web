// src/screens/SearchBar.tsx
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../components/PlaceSearchInput'
import { db } from '../lib/supabase'
import { sanitizeSearchQuery, sortEventHits, type EventHit } from '../lib/searchResults'

// Wyszukiwarka na mapie. Sam wygląd i zachowanie mieszkają w PlaceSearchInput,
// bo to samo pole służy w Moich danych do wyboru miejscowości. Mapa dokłada do
// listy wydarzenia po tytule - gdy dostanie onSelectEvent. Bez niego (wybór
// lokalizacji przy tworzeniu) pole szuka samych miejsc.

interface Props {
  userPos: { lat: number; lng: number } | null
  onSelect: (p: { lat: number; lng: number; label: string }) => void
  onSelectEvent?: (e: EventHit) => void
  /** Każda ręczna zmiana tekstu, także wyczyszczenie. */
  onQueryChange?: (q: string) => void
  dropdownZIndex?: number
  /** Tekst w polu na start i przy każdej zmianie tej wartości. */
  initialQuery?: string
}

function SearchBar({ userPos, onSelect, onSelectEvent, onQueryChange, dropdownZIndex, initialQuery }: Props) {
  const { t } = useTranslation()
  const searchEvents = onSelectEvent
    ? async (q: string) => {
        const clean = sanitizeSearchQuery(q)
        if (!clean) return []
        return sortEventHits(await db.searchEvents(clean), userPos)
      }
    : undefined
  return (
    <PlaceSearchInput
      placeholder={t(onSelectEvent ? 'map.searchAll' : 'map.search')}
      near={userPos}
      onSelect={r => onSelect({ lat: r.lat, lng: r.lng, label: r.primary })}
      initialQuery={initialQuery}
      searchEvents={searchEvents}
      onSelectEvent={onSelectEvent}
      onQueryChange={onQueryChange}
      dropdownZIndex={dropdownZIndex}
    />
  )
}

export default SearchBar
