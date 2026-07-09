import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'eu.meuwe',
  appName: 'meuwe',
  webDir: 'dist',
  // WebView background — shown for the brief moment between the splash hiding and the
  // first web paint. Cream (top of the Welcome gradient) instead of the default black.
  backgroundColor: '#FFF6EC',
  plugins: {
    SplashScreen: {
      // Keep the branded splash up until the app calls SplashScreen.hide() (from main.tsx
      // after first paint), so there is no black WebView flash while React boots.
      launchAutoHide: false,
      backgroundColor: '#FFF6EC',
      showSpinner: false,
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com', 'apple.com'],
    },
  },
}

export default config
