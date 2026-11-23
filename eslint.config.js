import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig(
  { ignores: ['dist', 'dist-inline', 'src/scene/sources/*.generated.js', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      // `cond && call()` and `cond ? a() : b()` as statements are used deliberately
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // The classic hook rules only. The React Compiler rules in this plugin flag
      // react-three-fiber's normal pattern of mutating three.js objects per frame.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  { files: ['scripts/**', 'eslint.config.js', 'vite.config.js', 'playwright.config.ts', 'tests/**'], languageOptions: { globals: { ...globals.node } } },
)
