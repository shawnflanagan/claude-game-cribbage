import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// GitHub Pages serves a project site under /<repo>/. The deploy workflow sets
// BASE_PATH to that prefix; everywhere else the app is served from the root.
const base = process.env['BASE_PATH'] ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/ui/test-setup.ts'],
    // Without this Vitest blanks CSS modules, including the raw import the
    // stylesheet test reads.
    css: true,
  },
});
