// @ts-check
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Architectural layers, as fixed by ADR 0001:
//   engine   -> may depend only on engine
//   opponent -> may depend on engine
//   ui       -> may depend on engine and opponent
// engine and opponent are pure and may never import React.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.claude'] },
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      // Data in this codebase is immutable values and literal unions, which
      // read better as `type` aliases than as interfaces.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // The pure layers (CLAUDE.md, "Coding standards"): no clock, no
    // ambient randomness, no timers, no browser or storage I/O. Randomness
    // comes from the seeded source carried in game state.
    files: ['src/engine/**/*.ts', 'src/opponent/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'Date',
          'setTimeout',
          'setInterval',
          'queueMicrotask',
          'requestAnimationFrame',
          'window',
          'document',
          'localStorage',
          'sessionStorage',
          'fetch',
          'console',
        ].map((name) => ({
          name,
          message: `${name} is not allowed in the pure engine and opponent layers.`,
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Use the seeded randomness carried in game state, never Math.random.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.app.json' },
      },
      'boundaries/elements': [
        { type: 'engine', pattern: 'src/engine/**' },
        { type: 'opponent', pattern: 'src/opponent/**' },
        { type: 'ui', pattern: 'src/ui/**' },
      ],
      // The Vite entry point sits beside the layers, not inside one.
      'boundaries/files': [{ category: 'entry', pattern: 'src/*.tsx' }],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          // Without this the rule ignores imports of npm packages entirely,
          // and the React ban below would never fire.
          checkAllOrigins: true,
          policies: [
            { allow: { to: { module: { origin: 'external' } } } },
            // React never enters the pure layers. Listed after the general
            // external allow because the last matching policy wins.
            {
              from: { element: { types: { anyOf: ['engine', 'opponent'] } } },
              disallow: {
                to: {
                  module: {
                    origin: 'external',
                    source: ['react', 'react-dom'],
                  },
                },
              },
            },
            {
              from: { element: { type: 'engine' } },
              allow: { to: { element: { type: 'engine' } } },
            },
            {
              from: { element: { type: 'opponent' } },
              allow: {
                to: { element: { types: { anyOf: ['opponent', 'engine'] } } },
              },
            },
            {
              from: [
                { element: { type: 'ui' } },
                { file: { categories: 'entry' } },
              ],
              allow: {
                to: {
                  element: { types: { anyOf: ['ui', 'engine', 'opponent'] } },
                },
              },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
