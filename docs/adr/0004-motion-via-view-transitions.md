---
status: accepted
---

# Motion comes from the View Transitions API, never from animation state

Cards move (deal, Discard, Pegging play, sweep to the played pile, lift in the Show) by giving each card a stable `view-transition-name` and wrapping the state update that moves it in `document.startViewTransition`. The browser animates the old position to the new one. Where the API is missing, the update applies at once with no motion. Under `prefers-reduced-motion`, the transition is skipped the same way.

We chose this over a motion library or hand-rolled keyframes because the UI stays a pure render of the presentation cursor (ADR 0001, ADR 0003): no component holds "where the card was", no timers drive animation, and tests keep asserting on the same DOM. The cost is that motion is browser-dependent and cannot be tuned per card beyond CSS on the transition pseudo-elements, which is a trade we accept for a card game.
