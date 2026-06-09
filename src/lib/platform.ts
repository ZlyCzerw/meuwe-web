export const isNativePlatform = (): boolean => {
  try { return (window as any)?.Capacitor?.isNativePlatform?.() ?? false }
  catch { return false }
}
