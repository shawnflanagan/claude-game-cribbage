# Cribbage

A browser game of two-player, six-card cribbage: a human against a computer opponent. This glossary fixes one word per concept so code, tests, and conversation all speak the same language.

## Language

### Roles

**Seat**:
One of the two symmetric positions at the table. A Seat may be driven by a human or by the computer opponent; the rules never distinguish.
_Avoid_: player, side, slot

**View**:
What one Seat is allowed to know: the full state of the Game with the other Seat's Hand and the undealt deck hidden. The computer opponent decides from its View only.
_Avoid_: perspective, partial state

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

**Combination**:
One scoring item: a kind, a point value, and the cards that make it. Show kinds are Fifteen, Pair, Pair Royal, Double Pair Royal, Run, Flush, and Nobs. Pegging kinds are Fifteen, Thirty-One, the Pair family, Run, and Last Card.
_Avoid_: score, points, hit

**Tally**:
The full list of Combinations for one Hand, the Crib, or one Pegging play, with its total.
_Avoid_: breakdown, score sheet, count

**Fifteen**:
Cards totalling exactly 15, for 2. In the Show, every distinct subset that sums to 15 counts.

**Pair**:
Two cards of the same rank, for 2. **Pair Royal** is three of a rank for 6; **Double Pair Royal** is four for 12.
_Avoid_: trips, quads, three of a kind

**Run**:
Three or more cards of consecutive rank, 1 point per card. In Pegging the cards need not be played in order.
_Avoid_: sequence, straight

**Flush**:
Four Hand cards of one suit, for 4; 5 if the Starter matches. The Crib scores a Flush only when all five match.

**Thirty-One**:
Bringing the Count to exactly 31 in Pegging, for 2. Ends the Pegging sequence.

**Last Card**:
The 1 point for playing the final card of a Pegging sequence that ends short of 31, whether by Go or by both players running out.
_Avoid_: go point, one for last

**Heels**:
The 2 points the Dealer scores when the Starter is a Jack.
_Avoid_: nibs, his heels

**Nobs**:
The 1 point scored in the Show for holding the Jack of the Starter's suit.
_Avoid_: his nobs, right Jack

**Action**:
A decision a Seat makes: a Discard or a Pegging play. The only inputs a Game takes after it starts; everything mechanical (dealing, cutting, counting) follows on its own.
_Avoid_: move, command, input

**Event**:
One thing that happened in a Game as a result of an Action or of the rules advancing: a card dealt, a Starter cut, a Tally scored, a Round ended. The Log is written from Events.
_Avoid_: message, notification

**Violation**:
The reason an Action was refused: not this Seat's turn, card not in Hand, Count would exceed 31, wrong phase, must discard exactly two. Never an error in the program sense.
_Avoid_: error, exception, invalid move

**Log**:
The human-readable record of a Game, one line per thing that happened. Derived from the Game's history, never stored on its own.
_Avoid_: history, transcript, feed

**Skunk**:
A win where the loser has fewer than 91 points. A **Double Skunk** is a win where the loser has fewer than 61.
_Avoid_: lurch

### The Board

**Board**:
The wooden scoring board: two Tracks side by side, running the length of the Board and back through a Turn, ending at the Game Holes.
_Avoid_: scoreboard, tracker

**Track**:
One Seat's row of 121 Holes along the Board, painted in that Seat's colour. The two Tracks stay side by side, in the same order, through every Turn.
_Avoid_: lane, stripe, path, street

**Hole**:
One point's worth of Track. Holes are grouped in fives.
_Avoid_: pip, slot, dot

**Peg**:
A Seat's marker on its Track. Each Seat has two: the **front** peg marks the score and the **back** peg where the score was before the latest Tally; a new Tally moves the back peg ahead of the front.
_Avoid_: marker, counter, token

**Start Holes**:
The two Holes before Hole 1 where a Seat's Pegs rest at zero.
_Avoid_: home, zero holes

**Game Hole**:
The 121st Hole, at the end of a Track, that a front Peg reaches to win.
_Avoid_: finish, winning hole, 121st hole

**Leg**:
A straight run of Track between Turns. The Board shows one Leg out and one back, or more when the screen is narrow.
_Avoid_: row, side, rail

**Turn**:
Where the Tracks curve round together to begin the next Leg.
_Avoid_: bend, curve, U-turn, hairpin

**Fold**:
How many Legs the Board is drawn with for the screen it is on: two on a wide screen, four on a phone. The same Track either way.
_Avoid_: variant, layout, breakpoint, version

### Across Games

**Record**:
The running tally of finished Games between the human and the computer: wins for each Seat, with how many of those were Skunks and Double Skunks. Only a Game that reaches 121 counts; an abandoned Game leaves the Record unchanged. Kept in the browser, shown on the result screen, and cleared only by an explicit reset.
_Avoid_: stats, history, score, streak
