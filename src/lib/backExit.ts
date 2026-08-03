/**
 * Podwójne "wstecz" wychodzi z apki.
 *
 * Na mapie nie ma dokąd się cofnąć, więc pierwsze wstecz tylko uzbraja wyjście
 * (dzwoniący pokazuje podpowiedź), a drugie w ciągu okna minimalizuje apkę.
 * Po oknie licznik się zeruje — wstecz naciśnięte minutę później znów tylko
 * podpowiada, zamiast niespodziewanie zamknąć aplikację.
 */
export const BACK_EXIT_WINDOW_MS = 4000

export function createBackExitGate(now: () => number = Date.now) {
  let armedAt: number | null = null
  return {
    /** true — minimalizuj apkę; false — pokaż podpowiedź. */
    press(): boolean {
      const t = now()
      if (armedAt !== null && t - armedAt <= BACK_EXIT_WINDOW_MS) {
        armedAt = null
        return true
      }
      armedAt = t
      return false
    },
    reset() { armedAt = null },
  }
}
