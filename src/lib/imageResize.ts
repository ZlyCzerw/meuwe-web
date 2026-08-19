/**
 * Zbijanie zdjęcia przed wysłaniem do bucketa.
 *
 * Powód jest jeden i konkretny: pierwsze zdjęcie wydarzenia trafia teraz do
 * `og:image` udostępnianego linku, a WhatsApp odpuszcza podgląd przy obrazkach
 * grubszych niż mniej więcej 300 kB. Zdjęcia z aparatu szły dotąd surowe, do
 * 6 MB.
 */

/** Dłuższy bok po przeskalowaniu. Z zapasem starcza na podgląd 1200x630. */
export const MAX_EDGE = 1600

/** Próg, powyżej którego WhatsApp przestaje pokazywać obrazek. */
export const TARGET_BYTES = 300 * 1024

/** Wymiary zmieszczone w kwadracie `maxEdge`, z zachowaniem proporcji. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
