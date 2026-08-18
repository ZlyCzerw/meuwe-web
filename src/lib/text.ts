import { findLinks } from './links'

/**
 * Ile opisu mieści się w karcie, zanim poprosi o rozwinięcie.
 *
 * Granica jest miękka w jednym przypadku: adres, który ją przecina,
 * przedłuża podgląd do swojego końca. Patrz `truncateDescription`.
 */
export const DESCRIPTION_PREVIEW_CHARS = 350

/**
 * Ile podglądu wolno oddać, żeby dociąć do granicy słowa.
 *
 * Cofamy się do ostatniej spacji, dopóki nie kosztuje to więcej niż 40%
 * podglądu. Powyżej tego progu pojedynczy długi ciąg bez spacji zostawiłby
 * kilka znaków zamiast akapitu — wtedy tniemy twardo.
 */
const WORD_BOUNDARY_MIN_RATIO = 0.6

/** Podgląd opisu do granicy słowa — albo do końca adresu, który tę granicę przecina. */
export function truncateDescription(
  text: string | null | undefined,
  limit = DESCRIPTION_PREVIEW_CHARS,
): { preview: string; truncated: boolean } {
  const full = (text ?? '').trim()
  if (full.length <= limit) return { preview: full, truncated: false }

  /**
   * Adres przecięty granicą wygrywa z limitem. Ucięta połowa URL-a to link
   * prowadzący donikąd, a tego nie naprawi żadne „czytaj więcej” — więc
   * podgląd sięga końca adresu, choćby przekroczył limit.
   */
  const straddling = findLinks(full).find(link => link.start < limit && link.end > limit)
  if (straddling) {
    return { preview: full.slice(0, straddling.end), truncated: straddling.end < full.length }
  }

  const cut = full.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const preview = lastSpace >= limit * WORD_BOUNDARY_MIN_RATIO ? cut.slice(0, lastSpace) : cut
  return { preview: preview.trimEnd(), truncated: true }
}
