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

// Drabinka jakości JPEG. Zmierzone na libjpeg przy 1600x1200: zwykłe zdjęcie
// z eventu schodzi 317 kB -> 179 kB już na drugim kroku, ale wieczorne ujęcie
// tłumu czy liści (szum matrycy) potrafi zejść tylko 539 kB -> 305 kB po
// jednym docięciu — wciąż nad progiem WhatsAppa. Stąd trzy kroki, nie jeden.
const QUALITY_STEPS = [0.82, 0.65, 0.5] as const

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
    // wgrywałyby się obrócone. Dwa milczące przypadki brzegowe, na wszelki
    // wypadek zapisane: animowany GIF spłaszcza się do pierwszej klatki, a
    // HEIC dekoduje się tylko w Safari — gdzie indziej `createImageBitmap`
    // odrzuca obietnicę i leci `catch` niżej, więc oryginał wychodzi
    // nieskompresowany.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    try {
      const { width, height } = fitWithin(bitmap.width, bitmap.height)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return file

      // JPEG nie ma kanału alfa. Bez białego tła przezroczyste piksele
      // (plakat czy ulotka wgrywana jako PNG z przezroczystością) wychodzą
      // z canvasu jako czarne — sprawdzone w prawdziwej przeglądarce.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)

      let best: Blob | null = null
      for (const quality of QUALITY_STEPS) {
        const blob = await encode(canvas, quality)
        if (!blob) continue
        if (!best || blob.size < best.size) best = blob
        if (blob.size <= TARGET_BYTES) break
      }
      if (!best || best.size >= file.size) return file

      const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
      return new File([best], `${name}.jpg`, { type: 'image/jpeg' })
    } finally {
      bitmap.close()
    }
  } catch {
    return file
  }
}
