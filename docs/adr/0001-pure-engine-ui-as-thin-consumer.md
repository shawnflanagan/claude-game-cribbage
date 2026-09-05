---
status: accepted
---

# Pure game engine, UI as a thin consumer

The engine under `src/engine/` is framework-free TypeScript: game state is an immutable value, every move is an action, and applying an action to a state returns the next state or a rule violation. Randomness (shuffle, cut) comes from a seedable source, so a game is reproducible from its seed and action history. The React UI under `src/ui/` renders state and dispatches actions; the computer opponent under `src/opponent/` is just another producer of actions. Neither `engine` nor `opponent` may import from `ui` or React, and `engine` may not import from `opponent`. The rule is enforced by `eslint-plugin-boundaries`, and pnpm's strict `node_modules` stops any layer from leaning on a dependency it did not declare.

We chose this over writing game logic in React state and hooks because it makes every rule testable without a browser, makes the opponent swappable behind one interface, and is the shape a future multiplayer server would need. The cost is a stricter boundary to maintain and some ceremony in the UI layer.
