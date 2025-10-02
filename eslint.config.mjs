// eslint.config.js (flat config)
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  // Next + TS baz ayarlar
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Global ignore’lar
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'prisma/**',        // generated veya prisma dosyaları
      '**/*.d.ts',
    ],
  },

  // Global kuralları “yumuşat”
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'react-hooks/exhaustive-deps': 'warn',
      '@next/next/no-img-element': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // API route’larında React hook kuralları gereksiz
  {
    files: ['app/api/**/*.{ts,tsx}', 'pages/api/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },

  // Prisma / generated dosyalarda kuralları kapat
  {
    files: ['prisma/**/*.{ts,js}', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
