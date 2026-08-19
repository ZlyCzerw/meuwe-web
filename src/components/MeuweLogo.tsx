/**
 * Wordmark „meuwe" — naklejka: białe litery w pomarańczowym rancie.
 *
 * SVG siedzi inline, a nie w <img>, bo animacja na powitaniu rusza osobno
 * członami „me", „u" i „we", a to wymaga dostępu do samych ścieżek.
 *
 * Kolejność malowania jest istotna: najpierw wszystkie ranty, dopiero na nie
 * białe wypełnienia. Ranty sąsiednich liter zachodzą na siebie, więc kiedy
 * jeden człon rośnie, a sąsiedni stoi, sylwetka naklejki tylko się
 * przemodelowuje — nie rozpada się na kawałki.
 *
 * Sama geometria mieszka w ./meuweLogoPaths — sięga po nią też generator ramek
 * do sklepów, który komponentu Reactowego nie zaimportuje.
 */

import type { CSSProperties } from 'react'
import {
  ORANGE, VIEW_BOX, RIM_WIDTH, PARTS, RIM, FILL, meuweLogoWidth,
} from './meuweLogoPaths'

export function MeuweLogo({ height, animated = false, style }: {
  /** Wysokość logo w px — szerokość dolicza się z proporcji. */
  height: number
  /** Oddychanie człon po członie, używane na powitaniu. */
  animated?: boolean
  style?: CSSProperties
}) {
  // Szerokość podana wprost: w kontenerach flex SVG z „auto" potrafi się zapaść.
  const width = meuweLogoWidth(height)

  const partStyle = (origin: string, delay: string): CSSProperties =>
    animated
      ? { transformOrigin: origin, animation: `breathe-sm 3.2s ${delay} ease-in-out infinite` }
      : { transformOrigin: origin }

  return (
    <svg
      viewBox={VIEW_BOX}
      width={width}
      height={height}
      role="img"
      aria-label="meuwe"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {/* Ranty — cała warstwa pod spodem, żeby sąsiednie człony się zlewały. */}
      {PARTS.map(p => (
        <g key={`rim-${p.key}`} style={partStyle(p.origin, p.delay)}>
          {RIM[p.key].map((d, i) => (
            <path
              key={i}
              d={d}
              fill={ORANGE}
              stroke={ORANGE}
              strokeWidth={RIM_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      ))}

      {/* Białe litery — zawsze na wierzchu rantów. */}
      {PARTS.map(p => (
        <g key={`fill-${p.key}`} style={partStyle(p.origin, p.delay)}>
          {FILL[p.key].map((d, i) => <path key={i} d={d} fill="#fff" />)}
        </g>
      ))}
    </svg>
  )
}
