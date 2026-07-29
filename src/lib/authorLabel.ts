// Who to show as the author of something.
//
// The two cases look alike and are not: a NULL id means the account was deleted
// and anonymised, while a present id with no name is a live user we simply have
// no name for (a fresh sign-in whose provider gave us nothing to display).
// Labelling the second one "deleted account" was a real bug: a brand new user's
// own event told them it had been posted by a deleted account.

export function authorLabel(
  id: string | null | undefined,
  name: string | null | undefined,
  labels: { deleted: string; unknown?: string },
): string {
  if (!id) return labels.deleted
  return name?.trim() || labels.unknown || '?'
}

/** First letter for an avatar circle, from the same rules. */
export function authorInitial(
  id: string | null | undefined,
  name: string | null | undefined,
  labels: { deleted: string; unknown?: string },
): string {
  return authorLabel(id, name, labels).charAt(0).toUpperCase()
}
