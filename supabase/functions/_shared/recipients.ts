import { pickLang, type Lang } from './notif-i18n.ts'

// Who actually gets a push.
//
// The rule was written out four times and agreed in two of them: push-new-event
// and push-event-start sent to anyone holding a delivery address, ignoring both
// profiles.push_enabled (DEFAULT false) and notification_mutes, while
// push-new-message and push-event-updated honoured both. So turning
// notifications off silenced chat but not new events, and muting an event still
// let its start notification through.
//
// One rule, one place: push_enabled = true AND not muted for this event. The
// query half is filterDeliverable; the decision half is deliverableFrom, which
// is where the behaviour is tested.

export interface DeliverableProfile { id: string; language: string | null }

export interface Deliverable { ids: string[]; langByUser: Map<string, Lang> }

/**
 * `enabledProfiles` are the rows that came back with push_enabled = true, so a
 * candidate with no row here has either never turned notifications on or has no
 * profile at all. `mutedIds` are the ones who silenced this particular event.
 */
export function deliverableFrom(
  enabledProfiles: DeliverableProfile[],
  mutedIds: Iterable<string>,
): Deliverable {
  const muted = new Set(mutedIds)
  const ids: string[] = []
  const langByUser = new Map<string, Lang>()
  for (const p of enabledProfiles) {
    if (muted.has(p.id)) continue
    ids.push(p.id)
    langByUser.set(p.id, pickLang(p.language))
  }
  return { ids, langByUser }
}

// The narrow slice of the supabase client this needs, so callers pass theirs as
// is. Writing the builder out structurally (a self-returning eq/in that is also
// a PromiseLike) type-checks here but makes the real client's generics recurse
// until tsc gives up with TS2589 at every call site, so this stays loose.
type AdminClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any
}

/**
 * Narrows a candidate list to the users a notification may actually reach.
 *
 * `eventId` is optional because a brand-new event cannot have been muted yet;
 * every other caller passes it. Run this on the FINAL recipient list, after the
 * audience has been selected — in push-event-start the followers of a private
 * event never appear in the bulk profiles query, so a filter attached to that
 * query would miss them entirely.
 */
export async function filterDeliverable(
  admin: AdminClient,
  userIds: string[],
  opts: { eventId?: string } = {},
): Promise<Deliverable> {
  if (userIds.length === 0) return { ids: [], langByUser: new Map() }

  let mutedIds: string[] = []
  if (opts.eventId) {
    const { data: mutes } = await admin
      .from('notification_mutes').select('user_id')
      .eq('event_id', opts.eventId).in('user_id', userIds)
    mutedIds = ((mutes ?? []) as { user_id: string }[]).map((m) => m.user_id)
  }

  const { data: profiles } = await admin
    .from('profiles').select('id, language')
    .in('id', userIds).eq('push_enabled', true)

  return deliverableFrom((profiles ?? []) as DeliverableProfile[], mutedIds)
}
