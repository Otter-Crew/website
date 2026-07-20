---
title: "The Mind Reader, Part 4: Regret Is All You Need"
description: "Counterfactual regret minimization from zero - how tracking what you wish you'd done converges to unexploitable poker"
pubDate: 2026-07-28
tags: ["poker", "GTO", "game theory"]
---

_Part 4 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## The number that plays perfect poker

Part 3 ended at a ceiling. The pot-control agent beat every bot we sat it against, and we had written every one of them. Its rules were ours too: fixed thresholds, fixed sizings, a Monte Carlo equity call against no one in particular.

Play it long enough, and you will find patterns like those. Tuning moves a pattern; it never removes one.

So stop writing the strategy and let the agent find one no counter can beat. Part 0 called that equilibrium, and the machine that gets there runs on a single number.

The number is regret, an everyday emotion made arithmetic.

After each game, for every action you skipped, write down how much better it would have done, then play each action in proportion to what you have accumulated. That is regret matching ([Hart & Mas-Colell, 2000](https://ranger.uta.edu/~weems/NOTES6319/PAPERSTWO/hartMasColell.corrEq.pdf)). It is simple enough to run in your head, and it is the engine under Cepheus, Libratus, Pluribus, and every solver you can buy.

## Regret, precisely

Regret for an action is what it would have scored minus what you scored.

Throw rock into paper, and you score -1. Paper would have tied, so paper's regret is 1, and scissors would have won, so scissors' regret is 2. Rock's regret is 0, because you cannot regret what you did.

Two properties do all the work.

Regret is counterfactual. It scores the roads not taken and needs no model of the opponent, only the power to re-score the same game under a different choice of your own.

Regret is cumulative. You keep running totals across every game you play, because one round teaches nothing and the totals teach everything.

The rule is one line: play each action in proportion to its positive cumulative regret. Negative totals count as zero, and if nothing is positive you play uniformly.

## Two rounds of rock-paper-scissors, by hand

Round 1: we throw Rock into their Paper and lose, so score each alternative against that Paper.

| action        | would have scored | regret this round | cumulative regret |
| :------------ | ----------------: | ----------------: | ----------------: |
| Rock (played) |                -1 |                 0 |                 0 |
| Paper         |                 0 |                +1 |                 1 |
| Scissors      |                +1 |                +2 |                 2 |

Three units of regret, split one and two, so next round we throw Paper a third of the time, Scissors two thirds, Rock never. We lost to Paper, and the algorithm says throw what beats it.

Round 2: we sample Scissors, they throw Rock, and we lose again, so score against Rock and add to the totals.

| action            | would have scored | regret this round | cumulative regret |
| :---------------- | ----------------: | ----------------: | ----------------: |
| Rock              |                 0 |                +1 |         0 + 1 = 1 |
| Paper             |                +1 |                +2 |         1 + 2 = 3 |
| Scissors (played) |                -1 |                 0 |         2 + 0 = 2 |

The new mix is Rock 1/6, Paper 3/6, Scissors 2/6, and Rock is back in play because nothing is ever cut. The whole history sets the weights, and the algorithm leans without committing.

## Playing against a rock

Now point it at an opponent who always throws Rock. We start from zero, so the first mix is uniform, and we sample Rock.

Round 1: Rock into Rock, and we tie.

| action        | would have scored | regret this round | cumulative regret |
| :------------ | ----------------: | ----------------: | ----------------: |
| Rock (played) |                 0 |                 0 |                 0 |
| Paper         |                +1 |                +1 |                 1 |
| Scissors      |                -1 |                -1 |                -1 |

One positive total, so the next throw is Paper, every time.

Round 2: Paper into Rock, and we win a chip.

| action         | would have scored | regret this round | cumulative regret |
| :------------- | ----------------: | ----------------: | ----------------: |
| Rock           |                 0 |                -1 |        0 - 1 = -1 |
| Paper (played) |                +1 |                 0 |         1 + 0 = 1 |
| Scissors       |                -1 |                -2 |       -1 - 2 = -3 |

Paper stopped earning regret the moment we started throwing it, and nothing else can catch it, because every round we win drives the other two down by another one and another two.

| after round | Rock | Paper | Scissors |
| ----------: | ---: | ----: | -------: |
|           1 |    0 |     1 |       -1 |
|           2 |   -1 |     1 |       -3 |
|           3 |   -2 |     1 |       -5 |
|           4 |   -3 |     1 |       -7 |

The mix locks onto Paper and stays there, a chip a round, forever.

That is the second face of the same rule. Against a fixed opponent, regret matching finds the exploit and holds it, and against an opponent who moves, it defends, with nothing in the algorithm knowing which case it is in.

The guarantee is about us, not them: no regret means that in the long run we do as well as the best single action we could have picked in hindsight. Choose the mix in the moment, and nobody can show you a fixed choice you should have made instead.

## The catch: it's the average that converges

Against another learner, the current mix never settles. We over-throw Paper, their regrets swing toward Scissors, and ours swing back to Rock, two players counter-adjusting and orbiting each other forever.

The guarantee sits on the **average** strategy, the running average of every mix played, and regret matching drives its average regret to zero. Total regret grows like the square root of the number of rounds, so per-round regret falls like 1/sqrt(T), and four times the work buys half the error.

In a two-player zero-sum game (one player's win is the other's loss), if both players hold average regret under epsilon, the two average strategies form a 2-epsilon Nash equilibrium, and nobody can take more than that from you whatever they do.

For rock-paper-scissors, the average grinds down to a third, a third, a third. The mixed output is the point, because frequencies are what make you unreadable, and a solver's answer to a poker spot comes back in the same shape: raise 70%, call 30%, for the same reason.

## From three throws to a game tree

Rock-paper-scissors is one decision with three actions, while poker is thousands of decisions in a game you cannot fully see.

Start with what a poker decision is: you know your two cards, the board, and the betting so far, and you do not know theirs. Every deal consistent with what you can see is a separate world, and you have to act the same way in all of them, because you cannot tell them apart. That bundle is an _information set_, and it is the unit that gets a ledger, with one row per legal action and one running total per row.

CFR ([Zinkevich et al., 2007](https://papers.nips.cc/paper/3306-regret-minimization-in-games-with-incomplete-information)) runs a regret matcher at every information set in the game. (CFR is counterfactual regret minimization.)

One wrinkle makes it work: spots do not come up equally often, so the rewards feeding each ledger are scaled by the chance of arriving there. That scale counts what the deck and the opponents contribute and leaves out your own choices along the way, and the omission is the _counterfactual_ that keeps a local ledger honest when you change your play upstream of it.

Then comes the theorem: your total regret in the full game is bounded by the sum of the counterfactual regrets at the individual information sets, so drive each one down and the whole game comes down with it.

A game-sized problem decomposes into millions of rock-paper-scissors-sized ones, each a short table of numbers you could keep on paper, and that is the decomposition Part 0 promised.

The clean equilibrium result covers two players and zero sum. Six-handed, the proof is gone, and the strategies still win; Pluribus beat elite professionals this way.

## The backprop analogy

Backprop takes one global number, the loss, walks a graph backward, and hands each weight its share of the blame. CFR takes one global number, who won and how much, walks the game tree backward, and hands each decision its regret. Both are credit assignment: forward pass, backward pass, millions of iterations.

The families overlap. Online gradient descent is itself a no-regret algorithm, and the discounting and predictive CFR variants in Part 5 play the part that momentum and optimism play in an optimizer.

Two differences make poker the harder job. Regret is not a gradient, so nothing chains through it, and every ledger is updated on its own from values handed back up the tree. The loss surface itself moves: your opponent is running the same algorithm against you, so what you are climbing changes while you climb it.

## Next time

The theory is one thing, and lines of Rust are another.

Next time we open little-sorry, watch regret matching converge in a real test, and meet the refinements - CFR+, discounting, prediction - that turn 1/sqrt(T) into something shippable.
