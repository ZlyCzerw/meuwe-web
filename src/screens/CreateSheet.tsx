import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import DragHandle from '../components/DragHandle'
import TagChip from '../components/TagChip'
import { C, F, INK } from '../lib/tokens'
import { db } from '../lib/supabase'

const suggested = ['outdoor', 'culture', 'party', 'family', 'sport', 'food']

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
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: unknown) => void
  defaultPos: { lat: number; lng: number } | null
  locationPicked: boolean
  onPickLocation: () => void
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string } | null>>([null, null, null])
  const [startTime, setStartTime] = useState<string>(
    () => new Date().toISOString().slice(0, 16)
  )
  const [endTime, setEndTime] = useState<string>(
    () => new Date(Date.now() + 86400000).toISOString().slice(0, 16)
  )
  const [timeExpanded, setTimeExpanded] = useState(false)
  const [pickedAddress, setPickedAddress] = useState<string | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)

  useEffect(() => {
    if (!locationPicked || !defaultPos) { setPickedAddress(null); return }
    setAddressLoading(true)
    reverseGeocode(defaultPos.lat, defaultPos.lng).then(addr => {
      setPickedAddress(addr)
      setAddressLoading(false)
    })
  }, [locationPicked, defaultPos?.lat, defaultPos?.lng])

  async function submit() {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setErr('')
    const start = new Date(startTime)
    const end = new Date(endTime)
    if (end <= start) {
      setErr('Czas zakończenia musi być po czasie rozpoczęcia')
      setSubmitting(false)
      return
    }
    // Upload photos
    const files = photos.filter((p): p is { file: File; preview: string } => p !== null)
    let photoUrls: string[] = []
    if (files.length > 0) {
      try {
        photoUrls = await Promise.all(files.map(p => db.uploadEventPhoto(p.file)))
      } catch (e) {
        setErr('Błąd przesyłania zdjęcia: ' + (e instanceof Error ? e.message : String(e)))
        setSubmitting(false)
        return
      }
    }
    const pos = defaultPos || { lat: 52.2297, lng: 21.0122 }
    const { data, error } = await db.createEvent({
      title: title.trim(),
      description: desc,
      lat: pos.lat,
      lng: pos.lng,
      tags,
      category: tags[0] || 'party',
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      photos: photoUrls,
    })
    setSubmitting(false)
    if (error) {
      setErr((error as { message?: string }).message || JSON.stringify(error))
      return
    }
    setTitle('')
    setTags([])
    setDesc('')
    setPhotos([null, null, null])
    setTimeExpanded(false)
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
          {t('create.title')}
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
            padding: 10, borderRadius: 20, background: C.cream, marginBottom: 18,
            width: '100%', textAlign: 'left', cursor: 'pointer',
            border: `2px solid transparent`,
            transition: 'border-color 180ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = `${C.primary}55`)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
        >
          <div style={{
            width: 76, height: 76, borderRadius: 16, overflow: 'hidden',
            position: 'relative', flexShrink: 0, background: C.cream,
          }}>
            <svg width="76" height="76" viewBox="0 0 76 76" style={{ position: 'absolute', inset: 0 }}>
              <rect width="76" height="76" fill="#FFF6EC"/>
              <rect x="-4" y="18" width="84" height="10" rx="5" fill="#B8E3F2"/>
              <ellipse cx="58" cy="56" rx="14" ry="11" fill="#C8E6BD"/>
              <rect x="32" y="0" width="6" height="76" fill="#fff" opacity="0.8"/>
            </svg>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 16, height: 16, borderRadius: '50%',
              background: C.primary, border: `2.5px solid #2D2B2A`,
              boxShadow: '0 2px 0 rgba(45,43,42,0.3)',
              animation: 'meuwe-breathe-sm 2.5s ease-in-out infinite',
            }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: C.ink,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {addressLoading ? 'Szukam adresu…' : pickedAddress || t('create.myLocation')}
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>
              {pickedAddress ? 'Wybrana lokalizacja' : t('create.gpsBased')}
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
            marginBottom: 20,
            display: 'block',
            border: 'none',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {/* Photos section */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 11, color: C.inkSoft, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
          }}>Zdjęcia</div>
          <div style={{ display: 'flex', gap: 10 }}>
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
                      const preview = URL.createObjectURL(file)
                      setPhotos(prev => {
                        const next = [...prev] as typeof prev
                        next[i] = { file, preview }
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
                        <img src={slot.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                        <button
                          onClick={e => {
                            e.preventDefault()
                            URL.revokeObjectURL(slot.preview)
                            setPhotos(prev => {
                              const next = [...prev] as typeof prev
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
          </div>
        </div>

        {/* Tags section */}
        <div style={{ marginBottom: 22 }}>
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
            {t('create.tags')}
          </div>
          {tags.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              {tags.map(tag => (
                <TagChip
                  key={tag}
                  category={tag}
                  selected
                  removable
                  onRemove={() => setTags(tags.filter(x => x !== tag))}
                />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggested
              .filter(tag => !tags.includes(tag))
              .map(tag => (
                <TagChip
                  key={tag}
                  category={tag}
                  onClick={() => setTags([...tags, tag])}
                />
              ))}
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
              }}>Czas</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                {timeExpanded ? 'Wybierz godziny' : (
                  <>Teraz · <span style={{ color: C.primary }}>za 24h</span></>
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
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }} onClick={e => e.stopPropagation()}>
              <div style={{ flex: 1, padding: '10px 12px', background: '#fff', borderRadius: 14 }}>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>OD</div>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
                />
              </div>
              <div style={{ flex: 1, padding: '10px 12px', background: '#fff', borderRadius: 14 }}>
                <div style={{ fontSize: 10, color: C.inkSoft, fontWeight: 700, marginBottom: 4 }}>DO</div>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  style={{ fontSize: 13, fontWeight: 700, color: C.ink, width: '100%' }}
                />
              </div>
            </div>
          )}
        </button>

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
            fontSize: 14,
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
            t('create.submit')
          )}
        </button>
      </div>
    </div>
  )
}

export default CreateSheet
