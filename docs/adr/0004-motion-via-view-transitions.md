---
status: accepted
---

# Motion comes from the View Transitions API, never from animation state

Cards move (deal, Discard, Pegging play, sweep to the played pile, lift in the Show) by giving each card a stable `view-transition-name` and wrapping the state update that moves it in `document.startViewTransition`. The browser animates the old position to the new one. Where the API is missing, the update applies at once with no motion. Under `prefers-reduced-motion`, the transition is skipped the same way.

We chose this over a motion library or hand-rolled keyframes because the UI stays a pure render of the presentation cursor (ADR 0001, ADR 0003): no component holds "where the card was", no timers drive animation, and tests keep asserting on the same DOM. The cost is that motion is browser-dependent and cannot be tuned per card beyond CSS on the transition pseudo-elements, which is a trade we accept for a card game.

Only cards take part: the root is not snapshotted, so text and controls update at once while named cards glide. A face-down card the viewer may know (their own Discard in the Crib, a swept card on a pile) carries its card's name and glides; one they may not know (the Computer's Hand, the Computer's Discards) carries a slot name instead, so it still enters and leaves but never reveals where it came from.

Pegs are the exception: they live inside the Board's SVG, where view transitions are not dependable, so a Peg slides to its new Hole with a CSS transition on its transform. Reduced motion turns that transition off.
