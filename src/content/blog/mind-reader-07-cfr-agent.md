---
title: 'The Mind Reader, Part 7: An Agent That Solves While It Plays'
description: 'CFRAgent - budget-driven exploration, regret-based pruning, and board enumeration, wired into the arena'
pubDate: 2026-07-29
tags: ['poker', 'mind-reader', 'rust', 'GTO']
---

*Part 7 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker.*

## Assembly time

- The parts are built. Now we assemble the agent.
- `CFRAgent` solves the hand while it plays it.
- On its turn it finds its node in the tree. It runs CFR until a budget says stop. Then it acts from the frequencies.

## What we took from chess engines

- Chess engines solved real-time search decades ago. We took what worked.
- Time controls. An engine gets a clock, not an iteration count. Our budgets are the same contract.
- The opening book. Engines don't search the first ten moves. They look them up. Our preflop charts are the book - more on that below.
- The easy move. When the strategy stops moving, stop solving. Our early exit fires after three stable iterations.
- Not everything transferred. We ported Stockfish's reverse futility pruning, tested it, and it measured negative. Gone.
- The lesson from chess is the discipline. Every idea plays a match before it ships.

## One decision, from the inside

- The agent's turn comes. It walks to its node in the shared tree. If the node has no matcher, it gets one.
- Then it iterates in waves. Each wave snapshots the strategy, tries every live action against it, and averages the rewards.
- One regret update per wave. It repeats until the budget says stop.
- Trying an action means playing it out. Clone the game state. Force a copy of the agent to that action, and seat CFR sub-agents in the other chairs.
- Run the simulation into the shared tree. The tree grows where the play goes.
- The final act is a sample, not an argmax. The average says raise 70%, call 30%. The agent rolls at those odds.
- Frequencies are what make you unreadable.
- The tree lives through the hand. The historian moves each player forward as real cards fall. The turn decision keeps what the flop learned.

## Guessing what they hold

- To simulate the hand, the agent must deal the opponents something. What it deals them is a claim about their range.
- The range guess comes from a trait, `HandDistributionEstimator`. Once per decision it hands back a range for every hidden seat.
- Each wave re-deals the opponents from those ranges. The board and the agent's own cards stay fixed.
- Two estimators ship. `KnownHandsEstimator` peeks at the true hands. An oracle, for tests and benchmarks. `UniformRandomEstimator` assumes any two cards. It knows nothing.
- One cheats. One knows nothing. A real read belongs in the gap between them. That is Arc 4.

## Budgets: solving what you can afford

- The budget is one question, asked at every wave. Keep going, go cheap, or stop?
- The pieces are small. A deadline in milliseconds. An iteration cap. A regret floor that stops when the node goes quiet.
- A width schedule too - full recursion near the root, cheap lookahead below.
- Compose them and the tightest opinion wins. The default gives about two seconds, 128 iterations at the root shrinking with depth, and an early stop when regret settles.
- It is all JSON. `rsp --budget` takes it inline or as a file. Same solver. Dial accuracy against latency.

## Spending the budget well

- Most of the tree is junk and stays junk. Regret-based pruning (Brown & Sandholm) skips actions the matcher has driven to zero.
- Every fourth wave reprobes them all, in case one came back.
- A second filter skips actions whose probability falls below a shrinking threshold.
- Deep in the tree, recursion stops and a fast-forward takes over. Assume everyone checks it down, then score the showdown.
- No cards to come is one evaluation. One card is all ~46. Two is all ~1,035 pairs.
- Three to come? Sample a few flops and enumerate each runout. Part 2's accumulator makes this nearly free.
- Enumeration beats sampling for a reason. Sampled boards put noise in the reward. Noise slows convergence.

## The one street we don't solve

- Postflop, the tree is kinder. The cards are down. Even multi-way, rarely more than two or three players see the flop.
- Preflop, every hand, every position, every stack is still live. The root is where the branching explodes. You cannot solve it on the clock.
- So we don't. Every serious bot precomputes preflop offline - a *blueprint* - and solves the rest live. We take the same shape at hobby scale.
- rs-poker ships a rough preflop config. Ranges and frequencies per position and action, nothing finer.
- The agent looks up its spot and acts. Only when the hand leaves the book does it fall through to the live solver.
- Rough is the point. The preflop play has to be sane, not perfect. We iterate from there.

## How good is it?

- `rsp arena generate` settles it.
- The pot-control agent loses its title here.

```
Name                            Change                Games
CFR-Configurable               +51783.8              232013
GTO-Experiment                 +38119.4              612557
6Max-RFI-GTO                   +7753.6               612840
Pekarstas-6max-RFI             -25504.5              614384
RandomPotControl               -72153.6              380683
```
- One weakness remains. The range guess is crude - Arc 4.

## Next time

- The solver plays a full hand now. But it deals the opponents cards at random. It doesn't know what you could be holding.
- Part 8 opens Arc 4. Generate the data and learn the read.
