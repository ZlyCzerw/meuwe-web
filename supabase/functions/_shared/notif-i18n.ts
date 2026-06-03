// Static notification strings only. Dynamic parts (event title, author name,
// message text) are never translated here.
export type Lang = 'pl' | 'en' | 'es' | 'de'
export type NotifType = 'new_event' | 'event_start' | 'update' | 'message'

const SUPPORTED: readonly Lang[] = ['pl', 'en', 'es', 'de']

export function pickLang(lang: string | null | undefined): Lang {
  const l = (lang ?? '').slice(0, 2).toLowerCase()
  return (SUPPORTED as readonly string[]).includes(l) ? (l as Lang) : 'pl'
}

export const NOTIF_TEXT: Record<NotifType, Partial<Record<'title' | 'body', Record<Lang, string>>>> = {
  new_event: {
    title: {
      pl: 'Nowe wydarzenie w pobliżu',
      en: 'New event nearby',
      es: 'Nuevo evento cerca de ti',
      de: 'Neues Event in der Nähe',
    },
  },
  event_start: {
    title: {
      pl: 'Wydarzenie zaraz się zaczyna',
      en: 'An event is about to start',
      es: 'Un evento está por comenzar',
      de: 'Ein Event beginnt gleich',
    },
  },
  update: {
    body: {
      pl: 'Wydarzenie zostało zaktualizowane',
      en: 'The event has been updated',
      es: 'El evento ha sido actualizado',
      de: 'Das Event wurde aktualisiert',
    },
  },
  message: {
    // anonymous-author fallback name
    body: {
      pl: 'Ktoś',
      en: 'Someone',
      es: 'Alguien',
      de: 'Jemand',
    },
  },
}

export function groupSubsByLang<T extends { user_id: string }>(
  subs: T[],
  langByUser: Map<string, Lang>,
): Map<Lang, T[]> {
  const groups = new Map<Lang, T[]>()
  for (const sub of subs) {
    const lang = langByUser.get(sub.user_id) ?? 'pl'
    const arr = groups.get(lang) ?? []
    arr.push(sub)
    groups.set(lang, arr)
  }
  return groups
}
