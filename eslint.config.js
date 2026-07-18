// Configuración mínima de ESLint — solo para detectar variables y componentes
// JSX usados pero nunca definidos ni importados, el tipo exacto de bug que se
// puede colar al dividir Dashboard.js en archivos más chicos sin darse cuenta.
// no-undef cubre variables/funciones normales; react/jsx-no-undef cubre
// específicamente etiquetas JSX como <CarpetaOneDrive/> (no-undef NO las
// revisa por sí solo).
import globals from 'globals'
import react from 'eslint-plugin-react'

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
    },
  },
]
