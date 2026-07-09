import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import DragHandle from '../components/DragHandle'
import TagChip from '../components/TagChip'
import TagPickerModal from '../components/TagPickerModal'
import { C, F, INK } from '../lib/tokens'
import { db } from '../lib/supabase'
import { resolvePhotoUrls, type PhotoSlot } from '../lib/photoSlots'
import type { EventWithMeta } from '../lib/types'
import { isNativePlatform } from '../lib/platform'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

const QUICK_TAGS = ['party', 'outdoor', 'sport', 'food', 'music', 'art']

function toLocalDT(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const MS_3H = 3 * 3_600_000
const MS_48H = 48 * 3_600_000

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'pl' } }
    )
    const d = await r.json()
    const a = d.address || {}
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    const city = a.city || a.town || a.village || a.municipality || ''
    if (street && city) return `${street}, ${city}`
    if (street) return street
    if (city) return city
    return d.display_name?.split(',')[0] || null
  } catch {
    return null
  }
}

function CreateSheet({
  open,
  onClose,
  onSubmit,
  defaultPos,
  locationPicked,
  onPickLocation,
  editEvent,
  onUpdated,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: unknown) => void
  defaultPos: { lat: number; lng: number } | null
  locationPicked: boolean
  onPickLocation: () => void
  editEvent?: EventWithMeta | null
  onUpdated?: (updated: EventWithMeta) => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [photos, setPhotos] = useState<PhotoSlot[]>([null, null, null])

  async function takePhotoNative() {
    try {
      const result = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 85,
        allowEditing: false,
      })
      if (!result.dataUrl) return
      const res = await fetch(result.dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
      if (file.size > 6 * 1024 * 1024) { setErr(t('create.photoSizeError')); return }
      setErr('')
      const preview = URL.createObjectURL(file)
      setPhotos(prev => {
        const next = [...prev]
        const emptyIdx = next.findIndex(s => s === null)
        if (emptyIdx !== -1) next[emptyIdx] = { kind: 'new', file, preview }
        return next
      })
    } catch { /* user cancelled */ }
  }
  const prefilledIdRef = useRef<string | null>(null)
  const [startTime, setStartTime] = useState<string>(
    () => toLocalDT(new Date())
  )
  const [endTime, setEndTime] = useState<string>(
    () => toLocalDT(new Date(Date.now() + 3 * 3600000))
  )
  const [timeExpanded, setTimeExpanded] = useState(false)
  const [pickedAddress, setPickedAddress] = useState<string | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    if (!locationPicked || !defaultPos) { setPickedAddress(null); return }
    setAddressLoading(true)
    reverseGeocode(defaultPos.lat, defaultPos.lng).then(addr => {
      setPickedAddress(addr)
      setAddressLoading(false)
    })
  }, [locationPicked, defaultPos?.lat, defaultPos?.lng])

  // Normalize start/end to satisfy every rule (create + edit). Single source of
  // truth, shared by the blur handlers and submit:
  // - start never in the past: floored at now (create / upcoming) or at the event's
  //   original start (edit, already started) — can move forward, never backward;
  // - end must be after now AND after start (no event lives entirely in the past);
  // - duration capped at 48h; cleared fields fall back to sensible defaults.
  function normalizeTimes(startRaw: string, endRaw: string): { startMs: number; endMs: number } {
    const now = Date.now()
    const origStart = editEvent ? new Date(editEvent.start_time).getTime() : now
    const startFloor = editEvent ? Math.min(now, origStart) : now

    let startMs = startRaw ? new Date(startRaw).getTime() : (editEvent ? origStart : now)
    if (!Number.isFinite(startMs) || startMs < startFloor) startMs = startFloor

    const endLo = Math.max(startMs, now)       // after start and after now
    const endHi = startMs + MS_48H             // ≤ 48h duration
    const endDefault = Math.min(endHi, endLo + MS_3H)
    let endMs = endRaw ? new Date(endRaw).getTime() : endDefault
    if (!Number.isFinite(endMs) || endMs < endLo || endMs <= startMs) endMs = endDefault
    if (endMs > endHi) endMs = endHi
    return { startMs, endMs }
  }

  // On blur, commit the normalized pair back to both inputs (idempotent when the
  // values are already valid, so a valid user-chosen end is preserved).
  function commitStart(raw: string) {
    const { startMs, endMs } = normalizeTimes(raw, endTime)
    setStartTime(toLocalDT(new Date(startMs)))
    setEndTime(toLocalDT(new Date(endMs)))
  }
  function commitEnd(raw: string) {
    const { startMs, endMs } = normalizeTimes(startTime, raw)
    setStartTime(toLocalDT(new Date(startMs)))
    setEndTime(toLocalDT(new Date(endMs)))
  }

  // Picker bounds (create + edit). Start floored so it can't move into the past;
  // end must be after now and start, and within 48h of start.
  const nowMs = Date.now()
  const origStartMs = editEvent ? new Date(editEvent.start_time).getTime() : nowMs
  const startFloorMs = editEvent ? Math.min(nowMs, origStartMs) : nowMs
  const startMinLocal = toLocalDT(new Date(startFloorMs))
  const startBaseMs = startTime ? Math.max(new Date(startTime).getTime(), startFloorMs) : startFloorMs
  const endMinLocal = toLocalDT(new Date(Math.max(startBaseMs, nowMs)))
  const endMaxLocal = toLocalDT(new Date(startBaseMs + MS_48H))

  // Prefill when entering edit mode. Keyed on editEvent.id and guarded so it runs
  // once per event — it must NOT re-run after the location-picker round-trip (the
  // component stays mounted; re-prefilling would wipe the moderator's edits).
  useEffect(() => {
    if (editEvent) {
      if (prefilledIdRef.current === editEvent.id) return
      prefilledIdRef.current = editEvent.id
      setTitle(editEvent.title)
      setDesc(editEvent.description ?? '')
      setTags(editEvent.tags ?? [])
      setStartTime(toLocalDT(new Date(editEvent.start_time)))
      setEndTime(toLocalDT(new Date(editEvent.end_time)))
      const slots: PhotoSlot[] = [null, null, null]
      ;(editEvent.photos ?? []).slice(0, 3).forEach((url, i) => { slots[i] = { kind: 'existing', url } })
      setPhotos(slots)
      setTimeExpanded(true)
      setErr('')
    } else {
      // Leaving edit mode → reset to create defaults so the create form isn't
      // polluted with the previously-edited event's data.
      if (prefilledIdRef.current !== null) {
        prefilledIdRef.current = null
        setTitle('')
        setDesc('')
        setTags([])
        setPhotos([null, null, null])
        setStartTime(toLocalDT(new Date()))
        setEndTime(toLocalDT(new Date(Date.now() + 3 * 3_600_000)))
        setTimeExpanded(false)
        setErr('')
      }
    }
  }, [editEvent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setErr('')
    // Normalize times (start not in the past, end after now, ≤48h duration).
    const { startMs, endMs } = normalizeTimes(startTime, endTime)
    if (endMs <= Date.now()) {
      // Impossible to satisfy (e.g. an event that started >48h ago): the end can't
      // be both after now and within 48h of start. Ask the user to move start up.
      setErr(t('create.pastError'))
      setSubmitting(false)
      return
    }
    const startISO = new Date(startMs).toISOString()
    const endISO = new Date(endMs).toISOString()
    // Upload new photos, keep existing URLs, preserve slot order.
    let photoUrls: string[]
    try {
      photoUrls = await resolvePhotoUrls(photos, f => db.uploadEventPhoto(f))
    } catch {
      setErr(t('create.photoUploadError'))
      setSubmitting(false)
      return
    }
    const pos = defaultPos || { lat: 52.2297, lng: 21.0122 }

    if (editEvent) {
      const { data, error } = await db.updateEvent(editEvent.id, {
        title: title.trim(),
        description: desc,
        lat: pos.lat,
        lng: pos.lng,
        category: tags[0] || 'party',
        tags,
        start_time: startISO,
        end_time: endISO,
        photos: photoUrls,
      })
      setSubmitting(false)
      if (error || !data) { setErr(t('create.submitError')); return }
      // `data.event_tags` reflects the OLD tags — updateEvent re-selects the row
      // before it deletes+reinserts tags. Use the submitted `tags` state instead.
      const e = data as any
      const updated: EventWithMeta = { ...e, tags, distKm: 0, distStr: '' }
      onUpdated?.(updated)
      return
    }

    const { data, error } = await db.createEvent({
      title: title.trim(),
      description: desc,
      lat: pos.lat,
      lng: pos.lng,
      tags,
      category: tags[0] || 'party',
      start_time: startISO,
      end_time: endISO,
      photos: photoUrls,
      is_private: isPrivate,
    })
    setSubmitting(false)
    if (error) {
      setErr(t('create.submitError'))
      return
    }
    setTitle('')
    setTags([])
    setDesc('')
    setPhotos([null, null, null])
    setTimeExpanded(false)
    setIsPrivate(false)
    onSubmit(data)
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: open ? '93%' : 0,
        background: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        boxShadow: '0 -8px 32px rgba(45,43,42,0.12)',
        transition: 'height 420ms cubic-bezier(0.32,1.4,0.4,1)',
        overflow: 'hidden',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <DragHandle />

      {/* Header */}
      <div
        style={{
          padding: '0 20px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: F.display,
            fontSize: 24,
            fontWeight: 900,
            color: C.ink,
            letterSpacing: -0.5,
          }}
        >
          {editEvent ? t('edit.title') : t('create.title')}
        </div>
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: C.cream,
            fontSize: 18,
            color: C.ink,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 100px' }}>
        {/* Mini-map preview */}
        <button
          onClick={onPickLocation}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 20, background: C.cream, marginBottom: 18,
            width: '100%', textAlign: 'left', cursor: 'pointer',
            border: `2px solid transparent`,
            transition: 'border-color 180ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = `${C.primary}55`)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12, overflow: 'hidden',
            position: 'relative', flexShrink: 0, background: C.cream,
          }}>
            <svg width="44" height="44" viewBox="0 0 76 76" style={{ position: 'absolute', inset: 0 }}>
              <rect width="76" height="76" fill="#FFF6EC"/>
              <rect x="-4" y="18" width="84" height="10" rx="5" fill="#B8E3F2"/>
              <ellipse cx="58" cy="56" rx="14" ry="11" fill="#C8E6BD"/>
              <rect x="32" y="0" width="6" height="76" fill="#fff" opacity="0.8"/>
            </svg>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 11, height: 11, borderRadius: '50%',
              background: C.primary, border: `2px solid #2D2B2A`,
              boxShadow: '0 2px 0 rgba(45,43,42,0.3)',
              animation: 'meuwe-breathe-sm 2.5s ease-in-out infinite',
            }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: C.ink,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {addressLoading ? t('common.loading') : pickedAddress || t('create.myLocation')}
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
              {pickedAddress ? t('map.pickLocation') : t('create.gpsBased')}
            </div>
          </div>
          <div style={{ fontSize: 18, color: C.inkSoft, flexShrink: 0 }}>›</div>
        </button>

        {/* Title input */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('create.namePlaceholder')}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 24,
            background: C.cream,
            fontSize: 18,
            fontWeight: 700,
            color: C.ink,
            marginBottom: 14,
            display: 'block',
            border: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Tags section — under title */}
        <div style={{ background: C.cream, borderRadius: 20, padding: '14px 16px', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.inkSoft, letterSpacing: '0.08em', marginBottom: 10 }}>
            {t('create.tagsLabel').toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {QUICK_TAGS.filter(tag => !tags.includes(tag)).map(tag => (
              <TagChip key={tag} category={tag} onClick={() => setTags([...tags, tag])} />
            ))}
            {tags.map(tag => (
              <TagChip key={tag} category={tag} selected removable onRemove={() => setTags(tags.filter(x => x !== tag))} />
            ))}
            <button
              onClick={() => setTagModalOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 999,
                background: C.cream, color: C.inkSoft,
                fontSize: 13, fontWeight: 800,
                border: `2px solid ${C.inkSoft}44`,
              }}
            >
              <span style={{ fontSize: 15 }}>＋</span> {t('tagPicker.addButton')}
            </button>
          </div>
        </div>

        {/* Time section */}
        <button
          onClick={() => setTimeExpanded(te => !te)}
          style={{
            width: '100%', textAlign: 'left',
            padding: '14px 16px', borderRadius: 20,
            background: C.cream, marginBottom: 18, display: 'block',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 11, color: C.inkSoft, fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
              }}>{t('create.timeLabel')}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                {timeExpanded ? t('create.timePick') : (
                  <>{t('create.timeNow')} · <span style={{ color: C.primary }}>{t('create.timeIn3h')}</span></>
                )}
              </div>
            </div>
            <div style={{
              fontSize: 18, color: C.inkSoft, fontWeight: 800,
              transform: timeExpanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 220ms ease',
            }}>⌄</div>
          </div>
          {timeExpanded && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }} onClick={e => e.stopPropagation()}>
              <div style={{ flex: 1, padding: '10px 12px', background: '#fff', borderRadius: 14 }}>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>{t('create.timeFrom')}</div>
                <input
                  type="datetime-local"
                  value={startTime}
                  min={startMinLocal}
                  onChange={e => setStartTime(e.target.value)}
                  onBlur={() => commitStart(startTime)}
                  style={{ fontSize: 16, fontWeight: 700, color: C.ink, width: '100%' }}
                />
              </div>
              <div style={{ flex: 1, padding: '10px 12px', background: '#fff', borderRadius: 14 }}>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>{t('create.timeTo')}</div>
                <input
                  type="datetime-local"
                  value={endTime}
                  min={endMinLocal}
                  max={endMaxLocal}
                  onChange={e => setEndTime(e.target.value)}
                  onBlur={() => commitEnd(endTime)}
                  style={{ fontSize: 16, fontWeight: 700, color: C.ink, width: '100%' }}
                />
              </div>
            </div>
          )}
        </button>

        {/* Private event toggle — create mode only */}
        {!editEvent && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderRadius: 20, background: C.cream, marginBottom: 18,
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                {t('create.privateEvent')}
              </div>
              {isPrivate && (
                <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 3 }}>
                  🔒 {t('create.privateEventHint')}
                </div>
              )}
            </div>
            <label style={{
              position: 'relative', display: 'inline-block',
              width: 44, height: 26, cursor: 'pointer', flexShrink: 0,
            }}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={e => setIsPrivate(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
              />
              <span style={{
                position: 'absolute', inset: 0,
                background: isPrivate ? C.primary : `${C.inkSoft}44`,
                borderRadius: 13,
                border: `2px solid ${isPrivate ? INK : `${C.inkSoft}66`}`,
                transition: 'background 200ms, border-color 200ms',
                boxShadow: isPrivate ? `0 2px 0 ${INK}33` : 'none',
                display: 'block',
              }}>
                <span style={{
                  position: 'absolute',
                  top: 2, left: isPrivate ? 18 : 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: isPrivate ? '#fff' : C.inkSoft,
                  transition: 'left 200ms ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  display: 'block',
                }}/>
              </span>
            </label>
          </div>
        )}

        {/* Photos section */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 11, color: C.inkSoft, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
          }}>{t('create.photos')}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {[0, 1, 2].map(i => {
              const slot = photos[i]
              return (
                <label key={i} style={{ cursor: 'pointer', display: 'block' }}>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (!file.type.startsWith('image/')) {
                        setErr(t('create.photoError'))
                        e.target.value = ''
                        return
                      }
                      if (file.size > 6 * 1024 * 1024) {
                        setErr(t('create.photoSizeError'))
                        e.target.value = ''
                        return
                      }
                      setErr('')
                      const preview = URL.createObjectURL(file)
                      setPhotos(prev => {
                        const next = [...prev]
                        next[i] = { kind: 'new', file, preview }
                        return next
                      })
                      e.target.value = ''
                    }}
                  />
                  <div style={{
                    width: 80, height: 80, borderRadius: 22,
                    background: slot ? 'transparent' : '#fff',
                    border: slot ? 'none' : `2px dashed ${C.inkSoft}66`,
                    position: 'relative', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {slot ? (
                      <>
                        <img src={slot.kind === 'existing' ? slot.url : slot.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        <button
                          onClick={e => {
                            e.preventDefault()
                            if (slot.kind === 'new') URL.revokeObjectURL(slot.preview)
                            setPhotos(prev => {
                              const next = [...prev]
                              next[i] = null
                              return next
                            })
                          }}
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'rgba(45,43,42,0.6)', color: '#fff',
                            fontSize: 12, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >×</button>
                      </>
                    ) : (
                      <span style={{ fontWeight: 300, fontSize: 28, color: C.inkSoft }}>+</span>
                    )}
                  </div>
                </label>
              )
            })}

            {/* Camera button — hidden when all 3 slots filled */}
            {photos.filter(p => p !== null).length < 3 && (
              <label style={{ cursor: 'pointer', display: 'block', flexShrink: 0 }}
                onClick={isNativePlatform() ? (e) => { e.preventDefault(); takePhotoNative() } : undefined}
              >
                {!isNativePlatform() && (
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 6 * 1024 * 1024) { setErr(t('create.photoSizeError')); e.target.value = ''; return }
                      setErr('')
                      const preview = URL.createObjectURL(file)
                      setPhotos(prev => {
                        const next = [...prev]
                        const emptyIdx = next.findIndex(s => s === null)
                        if (emptyIdx !== -1) next[emptyIdx] = { kind: 'new', file, preview }
                        return next
                      })
                      e.target.value = ''
                    }}
                  />
                )}
                <div style={{
                  width: 48, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.inkSoft,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
              </label>
            )}
          </div>
        </div>

        {tagModalOpen && (
          <TagPickerModal
            selected={tags}
            onChange={setTags}
            onClose={() => setTagModalOpen(false)}
          />
        )}

        {/* Description */}
        <div
          style={{
            fontSize: 11,
            color: C.inkSoft,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 8,
          }}
        >
          {t('create.descLabel')}
        </div>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder={t('create.descPlaceholder')}
          rows={3}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 20,
            background: C.cream,
            fontSize: 16,
            fontWeight: 600,
            resize: 'none',
            lineHeight: 1.5,
            display: 'block',
            border: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Error box */}
        {err && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 16,
              background: '#FFE8E8',
              color: '#c0392b',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {err}
          </div>
        )}
      </div>

      {/* Submit button */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 20px 36px',
          background:
            'linear-gradient(180deg,rgba(255,255,255,0) 0%,#fff 28%)',
        }}
      >
        <button
          onClick={submit}
          disabled={!title.trim() || submitting}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: 999,
            background: title.trim() ? C.primary : '#E8DFD0',
            color: title.trim() ? '#fff' : C.inkSoft,
            fontSize: 16,
            fontWeight: 800,
            border: `2.5px solid ${title.trim() ? INK : 'transparent'}`,
            boxShadow: title.trim()
              ? '0 8px 20px rgba(255,122,69,0.35)'
              : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'all 220ms ease',
          }}
        >
          {submitting ? (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          ) : (
            editEvent ? t('edit.submit') : t('create.submit')
          )}
        </button>
      </div>
    </div>
  )
}

export default CreateSheet
