---
status: accepted
---

# Persist a Game as its seed plus action history

A saved Game is the RNG seed and the ordered list of player actions (Discards and Pegging plays), not a state snapshot. Everything else, including the current state and the Log, is rebuilt by replaying the actions through the pure engine (see ADR 0001). The RNG state lives inside the game state and is advanced by shuffles and cuts, so a replay is exact.

We chose this over serializing the current state because it makes every saved game a reproducible test case, turns a bug report into "seed plus actions", and keeps the save format immune to state-shape refactors. The cost is that loading a Game means replaying it, which for a 121-point game is a few hundred pure function calls.
