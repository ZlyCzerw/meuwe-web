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

const FIRST_QUALITY = 0.82
const RETRY_QUALITY = 0.65

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

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Zdjęcie zmniejszone na tyle, żeby przeszło przez podgląd linku.
 *
 * Nigdy nie rzuca i nigdy nie zwraca czegoś gorszego od wejścia: każda porażka
 * — brak `createImageBitmap`, nieobsługiwany format, pusty canvas, wynik
 * cięższy od oryginału — kończy się oddaniem pliku bez zmian. Wysyłka zdjęcia
 * jest ważniejsza niż jego rozmiar.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= TARGET_BYTES) return file
  if (typeof createImageBitmap !== 'function') return file

  try {
    // `imageOrientation` musi tu być: bez odczytu EXIF-a zdjęcia z telefonu
    // wgrywałyby się obrócone.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = fitWithin(bitmap.width, bitmap.height)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    let blob = await encode(canvas, FIRST_QUALITY)
    if (blob && blob.size > TARGET_BYTES) blob = (await encode(canvas, RETRY_QUALITY)) ?? blob
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
