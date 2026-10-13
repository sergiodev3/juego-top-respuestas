import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ENGINE_LAYER_MESSAGE = 'The engine must not import from the features, app, or db layers.';

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage', 'node_modules']),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // The game engine stays pure TypeScript: no UI, persistence, or app-layer dependencies.
    files: ['src/engine/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'The engine must not depend on React.' },
            { name: 'react-dom', message: 'The engine must not depend on React DOM.' },
            { name: 'dexie', message: 'The engine must not depend on Dexie.' },
          ],
          patterns: [
            {
              group: ['react/*', 'react-dom/*', 'dexie/*'],
              message: 'The engine must not depend on React or Dexie.',
            },
            {
              // Covers both `@/features/...` aliases and relative `../features/...` paths.
              group: ['**/features', '**/features/*', '**/app', '**/app/*', '**/db', '**/db/*'],
              message: ENGINE_LAYER_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  prettier,
]);
