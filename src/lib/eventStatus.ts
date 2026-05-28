export type ComputedStatus = 'upcoming' | 'live' | 'extended' | 'ended'

const HOUR = 60 * 60 * 1000

/**
 * Computes the effective end time for an event.
 * Base: end_time + 1h buffer.
 * Each comment written within 1h before end_time extends the window
 * by 1h from the comment's creation time.
 */
export function computeEffectiveEnd(
  endTime: string,
  messages: { created_at: string }[] = [],
): Date {
  const end = new Date(endTime)
  let effectiveEnd = new Date(end.getTime() + HOUR)
  const windowStart = new Date(end.getTime() - HOUR)

  for (const msg of messages) {
    const msgTime = new Date(msg.created_at)
    if (msgTime >= windowStart && msgTime <= end) {
      const candidate = new Date(msgTime.getTime() + HOUR)
      if (candidate > effectiveEnd) effectiveEnd = candidate
    }
  }

  return effectiveEnd
}

/**
 * Computes real-time status from actual timestamps.
 * Does NOT rely on the stale `status` field from the DB.
 */
export function computeStatus(
  event: { start_time: string; end_time: string },
  messages: { created_at: string }[] = [],
  now = new Date(),
): ComputedStatus {
  const start = new Date(event.start_time)
  if (now < start) return 'upcoming'

  const effectiveEnd = computeEffectiveEnd(event.end_time, messages)
  if (now > effectiveEnd) return 'ended'
  if (now > new Date(event.end_time)) return 'extended'
  return 'live'
}

/** True if the event is within its scheduled window (halo should pulse). */
export function isCurrentlyLive(
  event: { start_time: string; end_time: string },
  messages: { created_at: string }[] = [],
  now = new Date(),
): boolean {
  return computeStatus(event, messages, now) === 'live'
}
