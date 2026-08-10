// Static notification strings only. Dynamic parts (event title, author name,
// message text) are never translated here.
export type Lang = 'pl' | 'en' | 'es' | 'de' | 'sl'
export type NotifType = 'new_event' | 'event_start' | 'update' | 'message' | 'interest'

const SUPPORTED: readonly Lang[] = ['pl', 'en', 'es', 'de', 'sl']

export function pickLang(lang: string | null | undefined): Lang {
  const l = (lang ?? '').slice(0, 2).toLowerCase()
  return (SUPPORTED as readonly string[]).includes(l) ? (l as Lang) : 'en'
}

export const NOTIF_TEXT: Record<NotifType, Partial<Record<'title' | 'body', Record<Lang, string>>>> = {
  new_event: {
    title: {
      pl: 'Nowe wydarzenie w pobliżu',
      en: 'New event nearby',
      es: 'Nuevo evento cerca de ti',
      de: 'Neues Event in der Nähe',
      sl: 'Nov dogodek v bližini',
    },
  },
  event_start: {
    title: {
      pl: 'Wydarzenie zaraz się zaczyna',
      en: 'An event is about to start',
      es: 'Un evento está por comenzar',
      de: 'Ein Event beginnt gleich',
      sl: 'Dogodek se kmalu začne',
    },
  },
  update: {
    body: {
      pl: 'Wydarzenie zostało zaktualizowane',
      en: 'The event has been updated',
      es: 'El evento ha sido actualizado',
      de: 'Das Event wurde aktualisiert',
      sl: 'Dogodek je bil posodobljen',
    },
  },
  message: {
    // anonymous-author fallback name
    body: {
      pl: 'Ktoś',
      en: 'Someone',
      es: 'Alguien',
      de: 'Jemand',
      sl: 'Nekdo',
    },
  },
  interest: {
    title: {
      pl: 'Ktoś wybiera się na Twoje wydarzenie',
      en: 'Someone is coming to your event',
      es: 'Alguien va a tu evento',
      de: 'Jemand kommt zu deinem Event',
      sl: 'Nekdo pride na tvoj dogodek',
    },
  },
}

export function groupSubsByLang<T extends { user_id: string }>(
  subs: T[],
  langByUser: Map<string, Lang>,
): Map<Lang, T[]> {
  const groups = new Map<Lang, T[]>()
  for (const sub of subs) {
    const lang = langByUser.get(sub.user_id) ?? 'en'
    const arr = groups.get(lang) ?? []
    arr.push(sub)
    groups.set(lang, arr)
  }
  return groups
}

// Treść zawiera liczbę, więc nie mieści się w NOTIF_TEXT — ta tablica z
// założenia trzyma wyłącznie napisy bez części zmiennych. Odmiana idzie per
// język, bo kategorie liczby mnogiej się nie pokrywają: polski ma trzy formy,
// słoweński cztery z liczbą podwójną, angielski dwie.

function plPeople(n: number): string {
  if (n === 1) return '1 osoba chce wziąć udział'
  const mod10 = n % 10
  const mod100 = n % 100
  const few = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)
  return few ? `${n} osoby chcą wziąć udział` : `${n} osób chce wziąć udział`
}

function slPeople(n: number): string {
  const mod100 = n % 100
  if (mod100 === 1) return `${n} oseba se odpravlja`
  if (mod100 === 2) return `${n} osebi se odpravljata`
  if (mod100 === 3 || mod100 === 4) return `${n} osebe se odpravljajo`
  return `${n} oseb se odpravlja`
}

export function interestBody(count: number, lang: Lang): string {
  switch (lang) {
    case 'pl': return plPeople(count)
    case 'sl': return slPeople(count)
    case 'de': return count === 1 ? '1 Person kommt' : `${count} Personen kommen`
    case 'es': return count === 1 ? '1 persona va a asistir' : `${count} personas van a asistir`
    default:  return count === 1 ? '1 person is coming' : `${count} people are coming`
  }
}
