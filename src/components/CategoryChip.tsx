import { useTranslation } from 'react-i18next'
import { C, INK, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'

// The category pill, as drawn in the picker behind the "+" on the filter bar.
// It lives here because the first-run interests step asks the same question with
// the same vocabulary, and two copies of this would drift the first time either
// is touched.

export default function CategoryChip({
  category,
  selected,
  onToggle,
  size = 'sm',
}: {
  category: Category
  selected: boolean
  onToggle: () => void
  /** 'md' is the full-screen first-run grid; 'sm' is the picker sheet. */
  size?: 'sm' | 'md'
}) {
  const { t } = useTranslation()
  const meta = TAG_META[category]
  const md = size === 'md'

  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: md ? '11px 18px' : '8px 14px',
        borderRadius: 999,
        background: selected ? meta.color : `${meta.color}33`,
        color: selected ? '#fff' : C.ink,
        fontSize: md ? 15 : 13, fontWeight: 700,
        border: selected ? `2px solid ${INK}` : '2px solid transparent',
        transition: 'all 180ms cubic-bezier(0.34,1.56,0.64,1)',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      <span
        style={{ fontSize: md ? 18 : 15, display: 'inline-flex', alignItems: 'center' }}
        dangerouslySetInnerHTML={{ __html: meta.glyph }}
      />
      <span>{t('tags.' + category)}</span>
    </button>
  )
}
