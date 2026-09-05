# Cribbage

Two-player, six-card cribbage in the browser: you against a computer opponent. A learning project built with a pure, testable game engine and a thin React UI.

**Play it:** https://shawnflanagan.github.io/claude-game-cribbage/

## Run it locally

Requires Node 24 (see `.nvmrc`) and pnpm (`corepack enable` installs the pinned version).

```sh
pnpm install
pnpm dev          # start the dev server
pnpm test         # run the tests once
pnpm test:watch   # run the tests on change
pnpm check        # typecheck, lint, format check, test: what CI runs
pnpm build        # production build into dist/
```

## How it's put together

- `src/engine/` will hold the game: pure TypeScript, immutable state, seeded randomness, no React.
- `src/opponent/` will hold the computer opponent. It sees only what a human in its Seat would.
- `src/ui/` renders state and sends Actions. It contains no rules of cribbage.

The layer boundaries are enforced by ESLint. Why it's built this way is in `docs/adr/`. The vocabulary the code uses is in `CONTEXT.md`.
