// TYMCZASOWE: porównanie starych pinezek (legacyMapIcons) z nowymi (obrazki).
// Kolumna „różnica” kładzie nową na starą z mix-blend-mode:difference - to, co
// identyczne, wychodzi czarne, każda różnica świeci. „Miganie” przełącza obie
// co 0,6 s, co łapie przesunięcie o piksel lepiej niż oko przy zestawieniu.
// Usuwane razem z legacyMapIcons.ts po zatwierdzeniu wyglądu.
/* eslint-disable react-refresh/only-export-components -- tymczasowa strona dev, punkt wejścia bez eksportów */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ALL_CATEGORIES, C, INK, F } from '../lib/tokens'
import * as next from '../components/mapIcons'
import * as legacy from './legacyMapIcons'
import '../index.css'

type Icons = Pick<typeof next, 'pinHTML' | 'privateHTML' | 'clusterHTML'>
const now = Date.now()
const LS = new Date(now - 3600e3).toISOString()
const LE = new Date(now + 3600e3).toISOString()
const PS = '2020-01-01T10:00:00Z'
const PE = '2020-01-01T12:00:00Z'

const CASES: { name: string; html: (m: Icons) => string }[] = [
  ...ALL_CATEGORIES.map((cat, i) => ({ name: cat, html: (m: Icons) => m.pinHTML(cat, i, 'upcoming', PS, PE) })),
  ...[0, 1, 2].map(b => ({ name: `blob ${b}`, html: (m: Icons) => m.pinHTML('party', b, 'upcoming', PS, PE) })),
  { name: 'skala 1.5', html: m => m.pinHTML('music', 0, 'upcoming', PS, PE, 1.5) },
  { name: 'trwające', html: m => m.pinHTML('sport', 1, 'live', LS, LE) },
  { name: 'prywatne', html: m => m.privateHTML(false) },
  { name: 'prywatne trwające', html: m => m.privateHTML(true) },
  { name: 'klaster 3', html: m => m.clusterHTML('food', 1, 'upcoming', PS, PE, 3) },
  { name: 'klaster >9', html: m => m.clusterHTML('art', 2, 'upcoming', PS, PE, 12) },
]

const cell: React.CSSProperties = { position: 'relative', width: 60, height: 64, zoom: 4, background: C.cream }
const pinAt: React.CSSProperties = { position: 'absolute', left: 8, top: 8 }

function Blink({ a, b }: { a: string; b: string }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = setInterval(() => setOn(x => !x), 600); return () => clearInterval(id) }, [])
  return <div style={cell}><div style={pinAt} dangerouslySetInnerHTML={{ __html: on ? b : a }} /></div>
}

function App() {
  return (
    <div style={{ background: C.cream, minHeight: '100%', padding: 20, fontFamily: F.body, color: INK, overflow: 'auto' }}>
      {/* Halo animuje się - zatrzymane na tej samej klatce w obu wersjach. */}
      <style>{`.cmp *{animation-play-state:paused!important;animation-delay:-1s!important}`}</style>
      <h2 style={{ fontFamily: F.display, fontSize: 15, marginBottom: 10 }}>stare | nowe | różnica | miganie (4×)</h2>
      {CASES.map(c => {
        const a = c.html(legacy)
        const b = c.html(next)
        return (
          <div key={c.name} className="cmp" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ width: 110, fontSize: 11 }}>{c.name}</div>
            <div style={cell}><div style={pinAt} dangerouslySetInnerHTML={{ __html: a }} /></div>
            <div style={cell}><div style={pinAt} dangerouslySetInnerHTML={{ __html: b }} /></div>
            <div style={{ ...cell, isolation: 'isolate' }}>
              <div style={pinAt} dangerouslySetInnerHTML={{ __html: a }} />
              <div style={{ ...pinAt, mixBlendMode: 'difference' }} dangerouslySetInnerHTML={{ __html: b }} />
            </div>
            <Blink a={a} b={b} />
          </div>
        )
      })}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
