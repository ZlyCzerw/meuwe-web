import { describe, it, expect, vi } from 'vitest'
import { resolvePhotoUrls, type PhotoSlot } from './photoSlots'

describe('resolvePhotoUrls', () => {
  it('keeps existing urls and uploads new files, preserving order, skipping null', async () => {
    const upload = vi.fn(async (f: File) => `uploaded://${f.name}`)
    const slots: PhotoSlot[] = [
      { kind: 'existing', url: 'https://old/1.jpg' },
      null,
      { kind: 'new', file: new File([''], 'fresh.png'), preview: 'blob:x' },
    ]
    const urls = await resolvePhotoUrls(slots, upload)
    expect(urls).toEqual(['https://old/1.jpg', 'uploaded://fresh.png'])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('returns empty array when all slots are null', async () => {
    const upload = vi.fn()
    expect(await resolvePhotoUrls([null, null, null], upload)).toEqual([])
    expect(upload).not.toHaveBeenCalled()
  })
})
