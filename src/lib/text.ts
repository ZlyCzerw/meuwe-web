/** Ile opisu mieści się w karcie, zanim poprosi o rozwinięcie. */
export const DESCRIPTION_PREVIEW_CHARS = 350

/**
 * Ile podglądu wolno oddać, żeby dociąć do granicy słowa.
 *
 * Cofamy się do ostatniej spacji, dopóki nie kosztuje to więcej niż 40%
 * podglądu. Powyżej tego progu pojedynczy długi ciąg bez spacji (wklejony
 * link) zostawiłby kilka znaków zamiast akapitu — wtedy tniemy twardo.
 */
const WORD_BOUNDARY_MIN_RATIO = 0.6

/** Podgląd opisu do granicy słowa. */
export function truncateDescription(
  text: string | null | undefined,
  limit = DESCRIPTION_PREVIEW_CHARS,
): { preview: string; truncated: boolean } {
  const full = (text ?? '').trim()
  if (full.length <= limit) return { preview: full, truncated: false }

  const cut = full.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const preview = lastSpace >= limit * WORD_BOUNDARY_MIN_RATIO ? cut.slice(0, lastSpace) : cut
  return { preview: preview.trimEnd(), truncated: true }
}
