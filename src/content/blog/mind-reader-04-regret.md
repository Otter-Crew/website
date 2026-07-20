---
title: "The Mind Reader, Part 4: Regret Is All You Need"
description: "Counterfactual regret minimization from zero - how tracking what you wish you'd done converges to unexploitable poker"
pubDate: 2026-07-24
tags: ["poker", "mind-reader", "GTO", "game theory"]
---

_Part 4 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## The number that plays perfect poker

- Part 3 ended at the ceiling. Every hand-written strategy has patterns. Patterns can be countered.
- The way past is an algorithm that learns a strategy no one can counter.
- The engine under every modern solver is regret - an everyday emotion made into a number.
- After each game, for every action you skipped, write down how much better it would have done. Next time, play actions in proportion to accumulated regret.
- That's regret matching ([Hart & Mas-Colell, 2000](https://ranger.uta.edu/~weems/NOTES6319/PAPERSTWO/hartMasColell.corrEq.pdf)). Simple enough to run in your head.

## Regret, precisely

- Regret for an action is what it would have scored minus what you scored.
- Played rock into paper? You scored -1. Paper would have tied - regret 1. Scissors would have won - regret 2. Rock's regret is 0. You can't regret what you did.
- Regret is counterfactual. It scores the roads not taken. No model of the opponent - just the power to re-score the game under a different choice.
- Regret is cumulative. You keep running totals across every game. One round teaches almost nothing. The totals teach everything.
- The matching rule is to play each action in proportion to its positive cumulative regret. Negative totals count as zero. Nothing positive, play uniformly.

## Two rounds of rock-paper-scissors, by hand

- Round 1: we throw Rock, they throw Paper. We lose. Score each alternative against their Paper:

| action        | would have scored | regret this round | cumulative regret |
| ------------- | ----------------- | ----------------- | ----------------- |
| Rock (played) | -1                | 0                 | 0                 |
| Paper         | 0                 | +1                | 1                 |
| Scissors      | +1                | +2                | 2                 |

- Next round we throw Paper 1/3, Scissors 2/3, Rock never. We lost to Paper; the algorithm says throw what beats it.
- Round 2: we sample Scissors, they throw Rock. We lose again. Score against Rock and add to the totals:

| action            | would have scored | regret this round | cumulative regret |
| ----------------- | ----------------- | ----------------- | ----------------- |
| Rock              | 0                 | +1                | 0 + 1 = 1         |
| Paper             | +1                | +2                | 1 + 2 = 3         |
| Scissors (played) | -1                | 0                 | 2 + 0 = 2         |

- The new mix is Rock 1/6, Paper 3/6, Scissors 2/6. Every action is back in play, weighted by the whole history. The algorithm leans toward what it regrets most without ever committing to it.
- One more experiment. Play regret matching against an opponent who only throws Rock.
- Paper's regret grows without bound. The mix slides toward pure Paper. Exploiting the weak and defending yourself run on the same machinery.

## The catch: it's the average that converges

- The current mix never settles. We over-throw Scissors. Their regrets drift toward Rock, ours toward Paper.
- The mixes orbit each other - two players counter-adjusting forever.
- The guarantee is on the **average** strategy - the running average of every mix played. Regret matching drives average regret to zero.
- In a two-player zero-sum game, both players under epsilon makes the average strategies a 2epsilon-Nash equilibrium. Average regret shrinks like 1/sqrt(T).
- For rock-paper-scissors the average grinds to 1/3-1/3-1/3. The mixed output is the point. Frequencies make you unreadable.
- A solver's answer to a poker spot has the same shape - raise 70%, call 30% - for the same reason.

## From three throws to a game tree

- Rock-paper-scissors is one decision. Poker is thousands of decision points with hidden cards, each with its own ledger.
- CFR ([Zinkevich et al., 2007](https://papers.nips.cc/paper/3306-regret-minimization-in-games-with-incomplete-information)) runs a regret matcher at every point. Each point's regrets are weighted by the probability the game reaches it.
- The theorem: total regret in the full game is bounded by the sum of the per-decision counterfactual regrets. Minimize locally, everywhere, and you minimize globally.
- The game-sized problem decomposes into millions of RPS-sized ones. That's the decomposition Part 0 promised.

## The backprop analogy

- Backprop takes one global number - the loss - and walks a graph backward, handing each weight its blame.
- CFR takes one global number - who won, how much - and walks the game tree backward, handing each decision its regret.
- Both are credit assignment. Forward pass, backward pass, millions of iterations.
- Both belong to the online-learning family. Gradient descent is itself a no-regret algorithm.
- The discounting and predictive CFR variants in Part 5 play the role momentum and optimism play in optimizers.
- Two core differences make poker hard.
  - Regrets are not gradients that can be applied deeply.
  - The loss surface keeps moving, because the opponent updates too.

## Next time

- The theory is one thing. Sixty lines of Rust are another.
- Next time we open little-sorry, watch regret matching converge in a real test, and meet the refinements - CFR+, discounting, prediction - that turn 1/sqrt(T) into something shippable.
- (Further reading: [Neller & Lanctot's introduction to CFR](https://modelai.gettysburg.edu/2013/cfr/cfr.pdf).)
