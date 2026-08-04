import { useTranslation } from 'react-i18next'
import { C, INK, TAG_META } from '../lib/tokens'
import type { Category } from '../lib/tokens'

// The category pill, as drawn in the picker behind the "+" on the filter bar.
// It lives here because the first-run interests step asks the same question with
// the same vocabulary, and two copies of this would drift the first time either
// is touched.
//
// Two sizes, and they differ by more than scale:
//
//   'sm'  the picker sheet — pills sit in a wrapping row and size to their text.
//   'md'  the first-run grid — pills fill their grid column, so text is left
//         aligned behind the glyph and the row edges line up.
//
// 'md' also does NOT grow when selected. A 5% scale on a full-width pill is
// several pixels of overhang, which lands straight on top of the neighbouring
// column: the selected pill looked like it was sitting on the one next to it.
// It gets a tick and the ink border instead, neither of which moves anything.

export default function CategoryChip({
  category,
  selected,
  onToggle,
  size = 'sm',
}: {
  category: Category
  selected: boolean
  onToggle: () => void
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
        display: md ? 'flex' : 'inline-flex',
        alignItems: 'center',
        gap: md ? 9 : 6,
        width: md ? '100%' : undefined,
        minHeight: md ? 46 : undefined,
        padding: md ? '10px 14px' : '8px 14px',
        borderRadius: 999,
        background: selected ? meta.color : `${meta.color}33`,
        color: selected ? '#fff' : C.ink,
        fontSize: md ? 14 : 13,
        fontWeight: 700,
        textAlign: 'left',
        // The picker leaves an unselected pill borderless, which works on the
        // white sheet. On the first-run card the same pill sits on cream and
        // reads as a soft patch of colour rather than a shape — it needs the
        // outline to be a pill the way the primary button is one. Selected still
        // takes the full ink border, so the difference stays obvious.
        border: selected
          ? `2px solid ${INK}`
          : md ? `2px solid ${INK}33` : '2px solid transparent',
        transition: 'background 180ms ease, border-color 180ms ease, transform 180ms cubic-bezier(0.34,1.56,0.64,1)',
        transform: !md && selected ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      <span
        style={{ fontSize: md ? 17 : 15, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: meta.glyph }}
      />
      <span style={md ? { flex: 1, minWidth: 0, lineHeight: 1.2 } : undefined}>{t('tags.' + category)}</span>
      {/* Reserved whether or not it is filled, so picking one does not shift the
          label. The tick itself is only mounted when it is actually shown —
          twenty-one always-mounted invisible icons is a lot of nothing. */}
      {md && (
        <span style={{
          width: 16, height: 16, flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      )}
    </button>
  )
}
