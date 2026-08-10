// Które zakończone wydarzenie zasługuje na pytanie "czy udało się dotrzeć".
//
// Pytamy nazajutrz, nie zaraz po końcu: wieczór jeszcze trwa, a pytanie w jego
// trakcie brzmiałoby jak zarzut. Po dwóch dobach pamięć przestaje być warta
// zapisu, więc temat cichnie sam.

/** Dwie doby to tyle, ile warta jest taka odpowiedź. */
export const ASK_MAX_AGE_MS = 48 * 60 * 60 * 1000

export interface AskCandidate {
  eventId: string
  title: string
  /** ISO 8601. */
  endTime: string
  /** Czy użytkownik już sam odpowiedział o tym wydarzeniu. */
  answered: boolean
}

function startOfToday(now: Date): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

export function pickAttendanceAsk(candidates: AskCandidate[], now: Date): AskCandidate | null {
  const dayStart = startOfToday(now).getTime()
  const oldest = now.getTime() - ASK_MAX_AGE_MS

  const eligible = candidates.filter(c => {
    if (c.answered) return false
    const end = new Date(c.endTime).getTime()
    if (!Number.isFinite(end)) return false
    return end < dayStart && end >= oldest
  })

  if (eligible.length === 0) return null
  return eligible.reduce((best, c) =>
    new Date(c.endTime).getTime() > new Date(best.endTime).getTime() ? c : best)
}
