// Testing Library only unmounts between tests when Vitest exposes globals,
// which this project does not, so register the cleanup explicitly.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
