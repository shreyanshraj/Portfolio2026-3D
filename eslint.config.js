import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist', 'dist-inline', 'src/scene/sources/*.generated.js', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
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
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
  { files: ['scripts/**', 'eslint.config.js', 'vite.config.js', 'playwright.config.js', 'tests/**'], languageOptions: { globals: { ...globals.node } } },
]
