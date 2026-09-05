---
status: accepted
---

# Only player decisions are Actions; the engine auto-advances everything else

The engine accepts exactly two kinds of Action during a Game: a Discard and a Pegging play (plus starting a new Game). Every mechanical step (shuffle, cut for deal, deal, cut the Starter, score Heels, count the Show, start the next Round) happens automatically the instant it is possible, and the engine reports what happened as a list of Events alongside the new state. There are no "acknowledge" or "continue" Actions.

We chose this over modelling every step as an explicit Action because it keeps the saved history (ADR 0002) down to the decisions, keeps the engine's surface tiny, and puts pacing where the human experiences it: the UI, which reveals Events one at a time with a presentation cursor. The cost is that a single Action can produce a burst of Events, so the UI must never assume one Action yields one visible change.

Amended: the presentation cursor may also step inside a single Event. Counting out a Show reveals one Combination at a time, and a Pegging Tally lingers before the next play, even though the engine emitted each as one Event. The engine stays unaware of these sub-steps; they are a fold over the Event list in the UI, exactly like the cursor itself.
