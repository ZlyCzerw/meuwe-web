import { useTranslation } from 'react-i18next'
import { C, INK, F } from '../lib/tokens'

export default function TagFilterSheet({
  tags,
  counts,
  selected,
  onChange,
  onClose,
}: {
  tags: string[]
  counts: Record<string, number>
  selected: string[]
  onChange: (tags: string[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()

  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }

  const sorted = [...tags].sort((a, b) => {
    const asel = selected.includes(a) ? 1 : 0
    const bsel = selected.includes(b) ? 1 : 0
    if (bsel !== asel) return bsel - asel
    return (counts[b] ?? 0) - (counts[a] ?? 0)
  })

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(45,43,42,0.35)',
          transition: 'opacity 200ms ease',
        }}
      />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201,
        background: C.cream,
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        border: `2.5px solid ${INK}`,
        borderBottom: 'none',
        boxShadow: `0 -4px 32px rgba(45,43,42,0.12)`,
        padding: '20px 20px 40px',
        maxHeight: '70vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 999, background: `${INK}33`, margin: '0 auto 16px' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 900, color: C.ink }}>
            {t('map.filterByTag')}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                style={{
                  fontSize: 12, fontWeight: 800, color: C.primary,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                }}
              >
                {t('map.clearFilters')}
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `${INK}11`, border: 'none',
                fontSize: 18, fontWeight: 700, color: C.ink,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >×</button>
          </div>
        </div>

        {/* Tags */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sorted.map(tag => {
              const active = selected.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggle(tag)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 999,
                    background: active ? C.ink : '#fff',
                    color: active ? '#fff' : C.ink,
                    fontSize: 13, fontWeight: 800,
                    border: `2px solid ${active ? C.ink : INK + '22'}`,
                    boxShadow: active ? `0 2px 0 ${C.primary}` : 'none',
                    transition: 'all 150ms ease',
                    cursor: 'pointer',
                  }}
                >
                  {tag}
                  <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>
                    {counts[tag]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
