/**
 * Głosiki blobów z ekranu powitalnego, syntezowane w Web Audio — bez plików.
 *
 * Trzy odgłosy: „blee" gdy blob ląduje pod palcem, „łiiii" gdy wylatuje z rzutu,
 * „pop" gdy duży zielony pęka. Każdy to jeden-dwa oscylatory z obwiednią i filtrem,
 * więc całość waży kilka linii, a nie kilkaset KB nagrań. Gdyby kiedyś miały być
 * nagrania, wystarczy podmienić ciała tych trzech funkcji.
 *
 * Kontekst audio powstaje przy pierwszym dźwięku, czyli już po geście użytkownika,
 * więc przeglądarki go nie blokują. Brak Web Audio (stare WebView) = cisza, nie błąd.
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

const MASTER = 0.5

function envelope(ac: AudioContext, at: number, peak: number, attack: number, end: number): GainNode {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak * MASTER, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + end)
  g.connect(ac.destination)
  return g
}

/** Wysoki, piskliwy „blee": ton lekko opada, a formant przesuwa się z „b" w „ee". */
export function playBlee(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  const dur = 0.26

  const osc = ac.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(560, t)
  osc.frequency.exponentialRampToValueAtTime(400, t + dur)

  const formant = ac.createBiquadFilter()
  formant.type = 'bandpass'
  formant.Q.value = 4
  formant.frequency.setValueAtTime(900, t)
  formant.frequency.exponentialRampToValueAtTime(2600, t + 0.12)

  const soften = ac.createBiquadFilter()
  soften.type = 'lowpass'
  soften.frequency.value = 3800

  const g = envelope(ac, t, 0.5, 0.015, dur)
  osc.connect(formant).connect(soften).connect(g)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** „Łiiiii": ton wznoszący się przez pół sekundy z drobnym wibrato. */
export function playWii(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime
  const dur = 0.65

  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(600, t)
  osc.frequency.exponentialRampToValueAtTime(1900, t + 0.55)

  const lfo = ac.createOscillator()
  lfo.frequency.value = 9
  const lfoGain = ac.createGain()
  lfoGain.gain.value = 30
  lfo.connect(lfoGain).connect(osc.frequency)

  const g = envelope(ac, t, 0.35, 0.02, dur)
  osc.connect(g)
  osc.start(t)
  lfo.start(t)
  osc.stop(t + dur + 0.05)
  lfo.stop(t + dur + 0.05)
}

/** Pęknięcie: niski impuls z szumem, a po nim rozsypane „pyk-pyk" odlatujących odłamków. */
export function playPop(): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime

  // Szum przez opadający filtr dolnoprzepustowy — samo „pop".
  const noiseLen = Math.floor(ac.sampleRate * 0.09)
  const buffer = ac.createBuffer(1, noiseLen, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(1400, t)
  lp.frequency.exponentialRampToValueAtTime(200, t + 0.09)
  noise.connect(lp).connect(envelope(ac, t, 0.7, 0.005, 0.09))
  noise.start(t)

  // Tąpnięcie pod spodem.
  const thump = ac.createOscillator()
  thump.type = 'sine'
  thump.frequency.setValueAtTime(170, t)
  thump.frequency.exponentialRampToValueAtTime(50, t + 0.1)
  thump.connect(envelope(ac, t, 0.6, 0.005, 0.11))
  thump.start(t)
  thump.stop(t + 0.15)

  // Konfetti: kilka krótkich pyknięć w losowych odstępach.
  for (let i = 0; i < 8; i++) {
    const at = t + 0.06 + Math.random() * 0.32
    const pyk = ac.createOscillator()
    pyk.type = 'sine'
    pyk.frequency.value = 900 + Math.random() * 800
    pyk.connect(envelope(ac, at, 0.2, 0.004, 0.03))
    pyk.start(at)
    pyk.stop(at + 0.04)
  }
}
