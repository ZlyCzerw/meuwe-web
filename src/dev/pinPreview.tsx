// Podgląd całego zestawu tagów naraz: pin mapy, chip zaznaczony i niezaznaczony.
// Ikony i kolory żyją w jednej tabeli (TAG_META), więc po każdej podmiance to
// jest jedyne miejsce, gdzie widać wszystkie 22 kategorie obok siebie i można
// wyłapać ikonę, która rozpada się w 14 px albo znika na swoim kolorze.
// Wzorowane na push-preview: /pin-preview.html na dev serwerze.
import { createRoot } from 'react-dom/client'
import { ALL_CATEGORIES, TAG_META, C, INK, F } from '../lib/tokens'
import { pinHTML } from '../components/mapIcons'
import '../index.css'

createRoot(document.getElementById('root')!).render(
  <div style={{ background: C.cream, minHeight: '100%', padding: 20, fontFamily: F.body, color: INK, overflow: 'auto' }}>
    <h2 style={{ fontFamily: F.display, fontSize: 15, marginBottom: 10 }}>Piny na mapie (44×56)</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 26 }}>
      {ALL_CATEGORIES.map((cat, i) => (
        <div key={cat} style={{ width: 78, textAlign: 'center' }}>
          <div
            style={{ height: 60, display: 'flex', justifyContent: 'center' }}
            dangerouslySetInnerHTML={{ __html: pinHTML(cat, i) }}
          />
          <div style={{ fontSize: 9, opacity: 0.55 }}>{cat}</div>
        </div>
      ))}
    </div>

    <h2 style={{ fontFamily: F.display, fontSize: 15, marginBottom: 10 }}>Chipy — zaznaczony / niezaznaczony</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {ALL_CATEGORIES.flatMap(cat =>
        [true, false].map(sel => (
          <span
            key={cat + String(sel)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 999,
              background: sel ? TAG_META[cat].color : `${TAG_META[cat].color}33`,
              color: sel ? '#fff' : C.ink,
              fontSize: 13, fontWeight: 700,
              border: sel ? `2px solid ${INK}` : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 14, display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: TAG_META[cat].glyph }} />
            {cat}
          </span>
        )),
      )}
    </div>
  </div>,
)
