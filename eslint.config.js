import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLAudioElement: 'readonly',
        Audio: 'readonly',
        MediaMetadata: 'readonly',
        Event: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        BroadcastChannel: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // Disable base no-undef for TS (handled by TS type checker)
      'no-undef': 'off',
    },
  },
  // Node/Backend JS files (server and scripts): enable Node globals and ESM
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node globals
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        // Common JS/browser-agnostic globals used in scripts
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      // keep defaults from eslint:recommended; no extra Node rules for now
    },
  },
  {
    ignores: [
      'dist/**',
      'build/**',
      '.vite/**',
      'node_modules/**',
      // Legacy/ancillary folders we don't lint right now
      'admin/**',
      'backend/**',
      'public/**',
      'scripts/**',
      // Root debug helpers
      'debug-*.js',
      // Temp/backup/logs
      'temp_backup/**',
      '*.backup',
      '*.bak',
      '*.log',
      'npm-debug.log*',
      // Env/IDE/OS
      '.env*',
      '.vscode/**',
      '.idea/**',
      '.DS_Store',
      'Thumbs.db',
    ],
  },
];
