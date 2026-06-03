export type PhotoSlot =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; preview: string }
  | null

/**
 * Turn the create/edit photo slots into the final ordered `photos` URL array.
 * Existing slots keep their URL; new slots are uploaded via `upload`. Nulls skipped.
 */
export async function resolvePhotoUrls(
  slots: PhotoSlot[],
  upload: (file: File) => Promise<string>,
): Promise<string[]> {
  const urls: string[] = []
  for (const slot of slots) {
    if (!slot) continue
    if (slot.kind === 'existing') urls.push(slot.url)
    else urls.push(await upload(slot.file))
  }
  return urls
}
