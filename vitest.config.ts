/// <reference types="vitest" />
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    // fcm.test.ts is a Deno test (fcm.ts uses npm: specifiers + Deno.env, and the
    // test imports https: URLs the Node ESM loader can't resolve) — run it via
    // `deno test` instead. Other _shared tests (e.g. notif-i18n) are plain TS and
    // still run here under vitest.
    exclude: [...configDefaults.exclude, 'supabase/functions/_shared/fcm.test.ts'],
  },
})
