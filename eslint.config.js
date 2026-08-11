import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .claude bywa gospodarzem worktree'ów — pełnych kopii repo z własnym
  // tsconfig. Bez tego typescript-eslint widzi dwa kandydujące katalogi główne,
  // nie umie wybrać i przestaje parsować KAŻDY plik w projekcie.
  // .claude bywa gospodarzem worktree'ów — pełnych kopii repo z własnym
  // tsconfig. Bez tego typescript-eslint widzi dwa kandydujące katalogi główne,
  // nie umie wybrać i przestaje parsować KAŻDY plik w projekcie.
  //
  // Reszta to wyniki budowania: zbundlowany JS, którego nie piszemy ręcznie i
  // którego uwagi lintera nikogo nie dotyczą.
  globalIgnores([
    'dist',
    '.claude',
    'build',
    'build-ios-*',
    'build-android-*',
    'android',
    'ios',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
