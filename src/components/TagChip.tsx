import { useTranslation } from 'react-i18next';
import { C, TAG_META } from '../lib/tokens';
import type { Category } from '../lib/tokens';

export default function TagChip({
  category,
  label,
  selected = false,
  onClick,
  removable = false,
  onRemove,
}: {
  category: string;
  label?: string;
  selected?: boolean;
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const meta = TAG_META[category as Category] || { color: C.berry, glyph: '✦' };
  const text = label || t('tags.' + category);
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
        transition: 'all 200ms cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>{meta.glyph}</span>
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
