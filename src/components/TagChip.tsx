import { useTranslation } from 'react-i18next';
import { C, INK, TAG_META } from '../lib/tokens';
import type { Category } from '../lib/tokens';

export default function TagChip({
  category,
  label,
  selected = false,
  onClick,
  removable = false,
  onRemove,
  outlined = false,
}: {
  category: string;
  label?: string;
  selected?: boolean;
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
  /** Obrys w kolorze ink — dla chipów kładzionych na zdjęciu. */
  outlined?: boolean;
}) {
  const { t } = useTranslation();
  const isKnown = category in TAG_META;
  const meta = TAG_META[category as Category] || { color: C.berry, glyph: '✦' };
  const text = label ?? (isKnown ? t('tags.' + category) : category);
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
        background: selected ? meta.color : `${meta.color}33`,
        color: selected ? '#fff' : C.ink,
        fontSize: 13,
        fontWeight: 700,
        border: outlined ? `2px solid ${INK}` : '2px solid transparent',
        boxShadow: outlined ? `0 2px 0 ${INK}33` : 'none',
        transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: meta.glyph }} />
      <span>{text}</span>
      {removable && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          style={{ marginLeft: 2, marginRight: -2, opacity: 0.75, fontSize: 15 }}
        >
          ×
        </span>
      )}
    </button>
  );
}
