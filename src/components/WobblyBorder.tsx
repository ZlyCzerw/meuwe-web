import { INK } from '../lib/tokens'

/**
 * Absolute overlay that draws a thick, slightly irregular "comic" border
 * around its nearest position:relative parent.
 * Content inside the parent stays sharp — only the border is displaced.
 */
export default function WobblyBorder({
  radius = 16,
  width = 3,
  color = INK,
}: {
  radius?: number | string
  width?: number
  color?: string
}) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        border: `${width}px solid ${color}`,
        borderRadius: radius,
        filter: 'url(#meuwe-wobble)',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
