import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // strictPort: without it vite silently moves to 5174/5175 when 5173 is busy.
  // Each port is a separate origin, so an OAuth flow started on one port cannot
  // finish on another: the PKCE verifier lives in that origin's localStorage and
  // Supabase answers with bad_oauth_state. Failing to start is the lesser evil.
  server: { port: 5173, strictPort: true },
})
