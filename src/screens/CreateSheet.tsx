import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DragHandle from '../components/DragHandle'
import TagChip from '../components/TagChip'
import { C, F, INK } from '../lib/tokens'
import { db } from '../lib/supabase'

const suggested = ['outdoor', 'culture', 'party', 'family', 'sport', 'food']

function CreateSheet({
  open,
  onClose,
  onSubmit,
  defaultPos,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: unknown) => void
  defaultPos: { lat: number; lng: number } | null
}) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [desc, setDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    setErr('')
    const pos = defaultPos || { lat: 52.2297, lng: 21.0122 }
    const { data, error } = await db.createEvent({
      title: title.trim(),
      description: desc,
      lat: pos.lat,
      lng: pos.lng,
      tags,
      category: tags[0] || 'party',
    })
    setSubmitting(false)
    if (error) {
      setErr((error as { message?: string }).message || JSON.stringify(error))
      return
    }
    setTitle('')
    setTags([])
    setDesc('')
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
        {/* Location card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 20,
            background: C.cream,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: `${C.primary}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            📍
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>
              {t('create.myLocation')}
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.inkSoft,
                fontWeight: 600,
                marginTop: 2,
              }}
            >
              {t('create.gpsBased')}
            </div>
          </div>
        </div>

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
