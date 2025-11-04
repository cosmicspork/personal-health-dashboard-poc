import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      '.vite/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'vitest.config.ts',
      'tailwind.config.js',
      'tests/**',
      '**/*.test.ts',
      '**/*.spec.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow controlled use of any for DOM manipulation and external APIs
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow non-null assertions for DOM elements we know exist
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Other helpful strict rules
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      // Production code safeguards
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/explicit-function-return-type': ['error', { 
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true
      }],
    },
  }
);