export interface UnreadState {
  [eventId: string]: { isOwner: boolean }
}

export interface MessageCtx {
  me: string
  followedIds: Set<string>
  ownedIds: Set<string>
  openEventId: string | null
}

/**
 * Add a dot for an incoming message when it qualifies:
 * from someone else, in a followed event, not the currently open event.
 * Returns the same state reference when nothing changes.
 */
export function applyIncomingMessage(
  state: UnreadState,
  msg: { event_id: string; author_id: string | null },
  ctx: MessageCtx,
): UnreadState {
  const { event_id, author_id } = msg
  if (!author_id || author_id === ctx.me) return state
  if (!ctx.followedIds.has(event_id)) return state
  if (event_id === ctx.openEventId) return state
  if (state[event_id]) return state
  return { ...state, [event_id]: { isOwner: ctx.ownedIds.has(event_id) } }
}
