import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { C, INK, ALL_CATEGORIES, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'

export default function TagPickerModal({
  selected,
  onChange,
  onClose,
}: {
  selected: string[]
  onChange: (tags: string[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [custom, setCustom] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter(x => x !== tag) : [...selected, tag])
  }

  function addCustom() {
    const val = custom.trim().toLowerCase().replace(/\s+/g, '-')
    if (!val || selected.includes(val)) { setCustom(''); return }
    onChange([...selected, val])
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
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        boxShadow: '0 -8px 32px rgba(45,43,42,0.14)',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 260ms cubic-bezier(0.32,1.4,0.4,1)',
      }}>
        {/* Handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 999,
          background: '#DDD5C8', margin: '12px auto 4px',
          flexShrink: 0,
        }} />

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
                  <span style={{ fontSize: 15 }}>{meta.glyph}</span>
                  <span>{t('tags.' + cat)}</span>
                </button>
              )
            })}

            {/* Custom tags already added */}
            {selected
              .filter(t => !ALL_CATEGORIES.includes(t as Category))
              .map(tag => (
                <button
                  key={tag}
                  onClick={() => toggle(tag)}
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
                  <span>{tag}</span>
                </button>
              ))}
          </div>

          {/* Custom tag input */}
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Własny tag…"
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 999,
                background: C.cream, fontSize: 14, fontWeight: 600,
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
              }}
            >
              Dodaj
            </button>
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
            Gotowe · {selected.length > 0 ? `${selected.length} wybranych` : 'brak'}
          </button>
        </div>
      </div>
    </>
  )
}
