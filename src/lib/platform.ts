export const isNativePlatform = (): boolean => {
  try { return (window as any)?.Capacitor?.isNativePlatform?.() ?? false }
  catch { return false }
}

const getPlatform = (): string => {
  try { return (window as any)?.Capacitor?.getPlatform?.() ?? 'web' }
  catch { return 'web' }
}

export const isAndroid = (): boolean => getPlatform() === 'android'
export const isIOS = (): boolean => getPlatform() === 'ios'
