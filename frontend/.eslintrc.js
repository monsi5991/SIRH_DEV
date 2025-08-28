// frontend/.eslintrc.js
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
  ],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    // Hooks
    'react-hooks/rules-of-hooks': 'error',
    // ✅ Tu as choisi l’option B (désactiver exhaustive-deps)
    'react-hooks/exhaustive-deps': 'off',

    // CRA n’exige plus React en scope
    'react/react-in-jsx-scope': 'off',

    // Ton override existant
    'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
  },
};
