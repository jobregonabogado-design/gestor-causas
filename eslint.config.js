// Configuración mínima de ESLint — solo para detectar variables usadas pero
// nunca definidas ni importadas (no-undef), el tipo exacto de bug que se
// puede colar al dividir Dashboard.js en archivos más chicos sin darse cuenta.
import globals from 'globals'

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      'no-undef': 'error',
    },
  },
]
