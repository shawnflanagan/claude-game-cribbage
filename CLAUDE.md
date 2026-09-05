# claude-game-cribbage

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`shawnflanagan/claude-game-cribbage`), operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root, created lazily by `/domain-modeling`. See `docs/agents/domain.md`.

## Coding standards

- Use the glossary in `CONTEXT.md` for every domain concept: identifiers, test names, Log text. Check the `_Avoid_` lists before naming anything.
- Tests are colocated as `foo.test.ts` beside `foo.ts`. Test names read as sentences about behaviour ("scores a pair royal for six").
- String-literal unions, never enums. `type` aliases, not interfaces. Named exports only, no default exports.
- Code under `src/engine/` and `src/opponent/` is pure: no `Date`, `Math.random`, timers, or I/O. The engine's randomness comes from the seeded source carried in game state; an opponent's randomness is passed in explicitly, never taken from `Math.random`. ESLint enforces this with restricted globals, alongside the import boundaries.
- Illegal Actions are Violations returned as values from `apply`, never thrown. The UI must never be able to produce one, because it greys out illegal moves.
- Prefer a few deep modules with narrow interfaces over many shallow files. See the `codebase-design` skill for the vocabulary.
- Comments explain a rule of cribbage or a non-obvious why. Never restate what the code does.
- The architecture is fixed by `docs/adr/`. Read ADRs 0001 to 0003 before touching engine, opponent, or persistence code.
