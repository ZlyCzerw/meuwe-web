import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, ALL_CATEGORIES, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'
import { db } from '../lib/supabase'

export default function TagPickerModal({
  selected,
  onChange,
  onClose,
  anchor = 'bottom',
}: {
  selected: string[]
  onChange: (tags: string[]) => void
  onClose: () => void
  anchor?: 'top' | 'bottom'
}) {
  const { t } = useTranslation()
  const top = anchor === 'top'
  const [custom, setCustom] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!top) inputRef.current?.focus() }, [top])
  useEffect(() => { db.getTags().then(setSuggestions) }, [])

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter(x => x !== tag) : [...selected, tag])
  }

  function addCustom() {
    const canonical = db.upsertTag(custom)
    if (!canonical || selected.includes(canonical)) { setCustom(''); return }
    onChange([...selected, canonical])
    setSuggestions(prev => prev.includes(canonical) ? prev : [...prev, canonical].sort())
    // Remember this custom tag for the current user (dedup catalogue + per-user
    // visibility). Fire-and-forget; a no-op when the user isn't logged in.
    db.addUserTag(canonical)
    setCustom('')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(45,43,42,0.45)',
          animation: 'fadeIn 180ms ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, zIndex: 201,
        background: '#fff',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        ...(top
          ? { top: 0, borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
              boxShadow: '0 8px 32px rgba(45,43,42,0.14)',
              animation: 'slideDown 260ms cubic-bezier(0.32,1.4,0.4,1)' }
          : { bottom: 0, borderTopLeftRadius: 32, borderTopRightRadius: 32,
              boxShadow: '0 -8px 32px rgba(45,43,42,0.14)',
              animation: 'slideUp 260ms cubic-bezier(0.32,1.4,0.4,1)' }),
      }}>
        {/* Handle — only for the bottom sheet (a top sheet's grab edge is its bottom) */}
        {!top && (
          <div style={{
            width: 40, height: 4, borderRadius: 999,
            background: '#DDD5C8', margin: '12px auto 4px',
            flexShrink: 0,
          }} />
        )}

        {/* Header */}
        <div style={{
          padding: '8px 20px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: '"Hanken Grotesk","Nunito",sans-serif', fontSize: 20, fontWeight: 900, color: C.ink }}>
            {t('create.tags')}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: C.cream, fontSize: 18, color: C.ink, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Scrollable tag grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_CATEGORIES.map(cat => {
              const meta = TAG_META[cat as Category]
              const isOn = selected.includes(cat)
              return (
                <button
                  key={cat}
                  onClick={() => toggle(cat)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 999,
                    background: isOn ? meta.color : `${meta.color}33`,
                    color: isOn ? '#fff' : C.ink,
                    fontSize: 13, fontWeight: 700,
                    border: isOn ? `2px solid ${INK}` : '2px solid transparent',
                    transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)',
                    transform: isOn ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  <span style={{ fontSize: 15, display: 'inline-flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: meta.glyph }} />
                  <span>{t('tags.' + cat)}</span>
                </button>
              )
            })}

            {/* Custom tags already added */}
            {selected
              .filter(tag2 => !ALL_CATEGORIES.includes(tag2 as Category))
              .map(tag2 => (
                <button
                  key={tag2}
                  onClick={() => toggle(tag2)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 999,
                    background: C.inkSoft, color: '#fff',
                    fontSize: 13, fontWeight: 700,
                    border: `2px solid ${INK}`,
                    transform: 'scale(1.05)',
                  }}
                >
                  <span style={{ fontSize: 15 }}>✏</span>
                  <span>{tag2}</span>
                </button>
              ))}
          </div>

          {/* Custom tag input */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={custom}
                onChange={e => setCustom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                placeholder={t('tagPicker.customPlaceholder')}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 999,
                  background: C.cream, fontSize: 16, fontWeight: 600,
                  border: `2px solid transparent`,
                  outline: 'none',
                }}
              />
              <button
                onClick={addCustom}
                disabled={!custom.trim()}
                style={{
                  padding: '10px 18px', borderRadius: 999,
                  background: custom.trim() ? C.primary : '#E8DFD0',
                  color: custom.trim() ? '#fff' : C.inkSoft,
                  fontSize: 14, fontWeight: 800,
                  border: `2px solid ${custom.trim() ? INK : 'transparent'}`,
                  transition: 'all 200ms ease',
                  minWidth: 72,
                }}
              >
                {t('tagPicker.addButton')}
              </button>
            </div>

            {/* Suggestions from DB */}
            {(() => {
              const filtered = suggestions.filter(s =>
                !ALL_CATEGORIES.includes(s as Category) &&
                !selected.includes(s) &&
                (custom.trim() === '' || s.includes(custom.trim().toLowerCase().replace(/\s+/g, '-')))
              )
              if (filtered.length === 0) return null
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {filtered.slice(0, 12).map(s => (
                    <button
                      key={s}
                      onClick={() => { onChange([...selected, s]); setCustom('') }}
                      style={{
                        padding: '5px 12px', borderRadius: 999,
                        background: C.cream, border: `1.5px solid ${INK}33`,
                        fontSize: 12, fontWeight: 700, color: C.inkSoft,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 10, opacity: 0.6 }}>✏</span>{s}
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>

        {/* Done button */}
        <div style={{ padding: '12px 20px 40px', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '14px', borderRadius: 999,
              background: C.primary, color: '#fff',
              fontSize: 16, fontWeight: 800,
              border: `2.5px solid ${INK}`,
              boxShadow: '0 6px 16px rgba(255,122,69,0.35)',
            }}
          >
            {t('tagPicker.done')} · {selected.length > 0 ? t('tagPicker.selectedCount', { count: selected.length }) : t('tagPicker.selectedNone')}
          </button>
        </div>
      </div>
    </>
  )
}
