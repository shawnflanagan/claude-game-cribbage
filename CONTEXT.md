# Cribbage

A browser game of two-player, six-card cribbage: a human against a computer opponent. This glossary fixes one word per concept so code, tests, and conversation all speak the same language.

## Language

### Roles

**Dealer**:
The player who deals the round and owns the Crib. Counts last in the Show.
_Avoid_: player 1, house

**Pone**:
The player who is not the Dealer this round. Cuts the Starter, leads the first Pegging card, and counts first in the Show.
_Avoid_: non-dealer, opponent, player 2

### Cards

**Hand**:
The cards a player holds: six after the deal, four after discarding to the Crib.
_Avoid_: cards, holding

**Discard**:
The two cards each player sends from their Hand to the Crib.
_Avoid_: throw, lay-away

**Crib**:
The Dealer's extra four-card hand, made of both players' Discards. Counted by the Dealer after their own Hand in the Show.
_Avoid_: box, kitty

**Starter**:
The card cut from the deck after discarding. Counts with every Hand and the Crib in the Show but is never played in Pegging.
_Avoid_: cut card, turn-up, up card

### Phases

**Round**:
One deal, from shuffling through the Show. A Game is a sequence of Rounds with the Dealer alternating.
_Avoid_: hand, deal

**Pegging**:
The phase where players alternately play cards face up, adding to the Count, scoring as they go.
_Avoid_: the play, play phase

**Count**:
The running total of card values played in the current Pegging sequence. Never exceeds 31.
_Avoid_: total, pile value, running score

**Go**:
The call a player makes when they hold cards but none can be played without the Count exceeding 31. The other player scores 1 for the last card unless they reach exactly 31.
_Avoid_: pass

**Show**:
The phase after Pegging where each Hand, then the Crib, is counted with the Starter. Pone counts first, then Dealer, then the Crib.
_Avoid_: counting, the count, showing

**Game**:
Play to 121 points. The first player to reach 121 wins immediately, even mid-Round.
_Avoid_: match

### Scoring

**Heels**:
The 2 points the Dealer scores when the Starter is a Jack.
_Avoid_: nibs, his heels

**Nobs**:
The 1 point scored in the Show for holding the Jack of the Starter's suit.
_Avoid_: his nobs, right Jack

**Skunk**:
A win where the loser has fewer than 91 points. A **Double Skunk** is a win where the loser has fewer than 61.
_Avoid_: lurch
