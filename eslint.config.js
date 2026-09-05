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
      globals: { ...globals.browser, ...globals.node },
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
        { type: 'engine', pattern: 'src/engine/**', partialMatch: false },
        { type: 'opponent', pattern: 'src/opponent/**', partialMatch: false },
        { type: 'ui', pattern: 'src/ui/**', partialMatch: false },
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
            // Any other external package is fine anywhere.
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
              from: { element: { type: 'ui' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['ui', 'engine', 'opponent'] } },
                },
              },
            },
            {
              from: { file: { categories: 'entry' } },
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
