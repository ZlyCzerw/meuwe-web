// Które pinezki mają wisieć na mapie: te w kadrze powiększonym o zapas. Czysta
// geometria na stopniach, bez Leafleta. Antypołudnika świadomie nie obsługujemy:
// mapa pokazuje najwyżej ~300 km, a wydarzenia są w Europie i na Kanarach.

export interface GeoBounds {
  south: number
  west: number
  north: number
  east: number
}

export function pinsToMount(
  points: Record<string, { lat: number; lng: number }>,
  b: GeoBounds,
): Set<string> {
  const out = new Set<string>()
  for (const id in points) {
    const p = points[id]
    if (p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east) out.add(id)
  }
  return out
}

/**
 * Co dołożyć i co zdjąć, żeby na mapie było dokładnie `want`. W trakcie ruchu
 * (`addOnly`) tylko dokładamy - zdejmowanie czeka na moveend, żeby nie mielić
 * DOM-u w każdej klatce przesuwania.
 */
export function planMount(
  pins: Record<string, { mounted: boolean }>,
  want: Set<string>,
  addOnly: boolean,
): { add: string[]; remove: string[] } {
  const add: string[] = []
  const remove: string[] = []
  for (const id in pins) {
    const wanted = want.has(id)
    if (wanted && !pins[id].mounted) add.push(id)
    else if (!wanted && pins[id].mounted && !addOnly) remove.push(id)
  }
  return { add, remove }
}
