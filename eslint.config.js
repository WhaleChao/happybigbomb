import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-relative', 'playwright-report', 'test-results', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    files: ['vite.config.ts', 'playwright.config.ts', 'config/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['public/sw.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
])
