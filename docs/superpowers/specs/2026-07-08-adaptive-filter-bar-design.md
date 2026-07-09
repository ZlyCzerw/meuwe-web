# Adaptive category filter bar (map) — Design

**Date:** 2026-07-08
**Branch:** `feat/adaptive-filter-bar` (off `staging`)
**Status:** zatwierdzony, gotowy do rozpisania planu

## Cel

Pasek filtrowania kategorii na mapie ([MapScreen.tsx](src/screens/MapScreen.tsx)) jest dziś sztywny: `Wszystkie` + stałe 3 kategorie (`party/music/culture`) + `+`. Źle wygląda na różnych szerokościach ekranu. Ma **dopasowywać liczbę widocznych chipów do dostępnej szerokości**. Dotyczy web + Android (i w przyszłości iOS — wspólny kod).

## Stan obecny

- Kontener paska: `position:absolute, top:76, left:0,right:0, display:flex, justifyContent:'space-between', gap:8, padding:'0 16px'` (linie ~310–318).
- `Wszystkie` (czyści filtry) → `POPULAR_FILTERS = ['party','music','culture']` (stałe 3 chipy) → `+` (34px, otwiera `TagPickerModal` = wszystkie 21 kategorii + własne tagi; badge z liczbą aktywnych ukrytych filtrów).
- Filtrowanie: `selectedFilters: string[]`, event pasuje gdy `e.category===f || e.tags?.includes(f)`. Kategorie: `ALL_CATEGORIES` (21) w [tokens.ts](src/lib/tokens.ts), meta w `TAG_META`.

## Zachowanie docelowe

- **`Wszystkie`** zawsze pierwszy (czyści filtry) — bez zmian.
- Następnie chipy kategorii w kolejności **priorytetu**, tyle ile się zmieści; **gwarantowane minimum: `impreza` (party) + `muzyka` (music)** (pokazywane zawsze, o ile w ogóle się mieszczą — realnie 2 chipy mieszczą się na najwęższym telefonie).
- **`+`** zawsze na końcu (dostęp do pełnego pickera + własnych tagów) — bez zmian względem dziś.
- Priorytet kategorii (stała `PRIORITY_FILTERS`): `party, music, culture, sport, food, outdoor, family, art, film, gaming, tech, nature, travel, yoga, dance, comedy, kids, pets, volunteering, workshop, alert`. (party+music na przodzie zgodnie z wymaganiem; resztę można łatwo przestawić.)
- Przykłady: wąski → `Wszystkie · impreza · muzyka · +`; szerszy → `Wszystkie · impreza · muzyka · kultura · sport · jedzenie · +`.
- **Zaznaczona kategoria w przepełnieniu:** zostaje badge z licznikiem na `+` (jak dziś). Bez wysuwania na przód (świadomie — utrzymuje prostotę; poza zakresem).

## Podejście: dynamiczny pomiar

- `ResizeObserver` na kontenerze paska → aktualna dostępna szerokość.
- Szerokości chipów mierzone realnie (różnią się długością etykiety i językiem pl/en/es/de) — pomiar renderowanych elementów (ref na każdy chip) w `useLayoutEffect`, przeliczany przy zmianie szerokości kontenera i języka.
- **Czysta funkcja `computeVisibleCount(containerWidth, chipWidths[], allWidth, plusWidth, gap)`** → ile chipów priorytetu zmieścić po zarezerwowaniu miejsca na `Wszystkie` i `+`. To jądro logiki i **jedyna część pokryta testem jednostkowym** (DOM/pomiar nie jest testowany).
- Odrzucone: progi szerokości (breakpointy) — przybliżone przy zmiennych długościach etykiet (przelewa się / zostawia luki). Odrzucone: poziomy scroll — user od niego odszedł wcześniej.

## Struktura

- Wydzielić komponent **`AdaptiveFilterBar`** (`src/components/AdaptiveFilterBar.tsx`) z całą logiką pomiaru i renderem paska. `MapScreen` przekazuje `selectedFilters`, `onToggle`, `onClear`, `onOpenPicker`. MapScreen jest duży — to go odchudza i daje jasną granicę (pomiar + render paska = jedna odpowiedzialność).
- Filtrowanie, `TagPickerModal`, badge — bez zmian semantycznych; przenosimy tylko render paska do nowego komponentu.

## Platformy

Wspólny kod web (`MapScreen`/nowy komponent) → działa na **web + Android** od razu; **iOS** w przyszłości automatycznie. Brak kodu specyficznego dla platformy.

## Testowanie

- Test jednostkowy `computeVisibleCount` (vitest): różne szerokości kontenera + zestawy szerokości chipów → oczekiwana liczba widocznych (w tym: minimum 2 gdy tylko party+music się mieszczą; wszystkie gdy szeroko; rezerwacja miejsca na `Wszystkie`+`+`).
- Weryfikacja wizualna w preview przy kilku szerokościach (mobile/tablet/desktop) — pasek nie przelewa się ani nie zostawia dużych luk; `+` zawsze widoczny.

## Poza zakresem

- Zmiana semantyki filtrowania / `TagPickerModal`.
- Wysuwanie zaznaczonych kategorii na przód (badge zostaje).
- Zmiana kolejności/zestawu kategorii poza zaproponowaną `PRIORITY_FILTERS` (łatwa do korekty później).
