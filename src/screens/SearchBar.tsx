// src/screens/SearchBar.tsx
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../components/PlaceSearchInput'

// Wyszukiwarka na mapie. Sam wygląd i zachowanie mieszkają w PlaceSearchInput,
// bo to samo pole służy w Moich danych do wyboru miejscowości.

interface Props {
  userPos: { lat: number; lng: number } | null
  onSelect: (p: { lat: number; lng: number }) => void
}

function SearchBar({ userPos, onSelect }: Props) {
  const { t } = useTranslation()
  return (
    <PlaceSearchInput
      placeholder={t('map.search')}
      near={userPos}
      onSelect={r => onSelect({ lat: r.lat, lng: r.lng })}
    />
  )
}

export default SearchBar
