/** Ile opisu mieści się w karcie, zanim poprosi o rozwinięcie. */
export const DESCRIPTION_PREVIEW_CHARS = 350

/**
 * Podgląd opisu do granicy słowa.
 *
 * Cofamy się do ostatniej spacji tylko wtedy, gdy nie zjada to więcej niż 40%
 * podglądu. Inaczej pojedynczy długi ciąg bez spacji (wklejony link) zostawiłby
 * kilka znaków zamiast akapitu.
 */
export function truncateDescription(
  text: string | null | undefined,
  limit = DESCRIPTION_PREVIEW_CHARS,
): { preview: string; truncated: boolean } {
  const full = (text ?? '').trim()
  if (full.length <= limit) return { preview: full, truncated: false }

  const cut = full.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  const preview = lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut
  return { preview: preview.trimEnd(), truncated: true }
}
