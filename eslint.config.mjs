import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        Date: 'readonly',
        JSON: 'readonly',
        Math: 'readonly',
        parseInt: 'readonly',
        String: 'readonly',
        Error: 'readonly',
        Map: 'readonly',
        require: 'readonly'
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  prettierConfig,
  {
    ignores: ['out/**', 'release/**', 'node_modules/**', 'dist/**']
  }
]
