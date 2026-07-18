---
title: 'The Mind Reader, Part 5: little-sorry - The Regret Math, in Rust'
description: 'A small crate for a big idea: regret matching, CFR+, and the discounted and predictive variants - the numeric core every solver shares'
pubDate: 2026-07-27
tags: ['poker', 'mind-reader', 'rust', 'GTO']
---

*Part 5 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker.*

## A crate named for feeling bad

- The algorithm runs on regret. Regret in one word is sorry. Little because the crate is small - one idea, one dependency, `rand`. [Room here for the real naming story.]
- The first commit, October 2019, is titled "Regret Matching in Rust." The design bet still holds.
- The regret math is separable from any game. Nothing in the crate knows what a card is. It turns streams of rewards into strategies.
- The update rules are isolated, property-tested, and benchmarked on toy games.

## One trait, one contract

- The API is the `RegretMinimizer` trait. Its heart is one method, `update_regret(&mut self, rewards: &[f32])`. The caller scores each action. The crate does the rest.
- That rest is the whole loop. Instantaneous regrets, cumulative totals with the variant's discounting, strategy from positive regrets, running average.
- Part 4's lesson is two methods. `current_strategy()` chases; sample your next action from it. `best_weight()` is the average - the answer you keep.
- Everything is slices of `f32` updated in place. Zero heap allocations in the hot path.
- That matters in Part 7. A solver calls this millions of times inside a real-time budget.

## Rock-paper-scissors, now running

- Part 4 worked two rounds by pencil. The crate ships the same game as code.
- Each throw's payoff is a three-entry table - `ROCK_REWARD: [0.0, 1.0, -1.0]`. A round of self-play is two matchers exchanging reward slices.
- The runner is generic over the algorithm, so the same game runs under any matcher.
- The tests play matchers against themselves and assert the average lands on 1/3, 1/3, 1/3. The test fails if convergence doesn't come.

## Six variants, one dial each

- Plain regret matching works. But at 1/sqrt(T), the last digit of precision costs a hundred times the first.
- Twenty years of research is, roughly, one-line changes to how the totals are kept. The crate ships the whole family behind one trait.
- **CFR+** clips cumulative regrets at zero. An action driven negative gets a clean slate when it turns useful. With linear averaging, it solved limit hold'em. The default.
- **Linear CFR** weights iteration *t* by *t*. Early iterations, played when both players were terrible, fade.
- **DCFR** discounts with three exponents - alpha for positive regrets, beta for negative, gamma for the average. The crate ships the paper's `DCFR(alpha=1.5, beta=0, gamma=2)` and a pruning-safe alternative.
- **PCFR+ and PDCFR+** feed the matcher a prediction of the next regret, so it anticipates instead of reacting. State of the art on many games.

## Built to be embedded

- The newer machinery exists for solvers with millions of information sets. `BatchedMatcher` owns many regret ledgers on one iteration clock and computes each discount once, not per row.
- It is generic over update rule and storage. `Local` is single-threaded speed. `Atomic` is lock-free updates across threads.
- Optional lane layouts quantize regret and average-strategy storage to `u16`/`i16` - a little precision for half the RAM. `quantize_dist` exports a solved strategy as compact fixed-point codes.
- These return in the finale, when a preflop blueprint has to fit in memory.
- little-sorry works for any extensive-form game. Poker never appears in it. rs-poker depends on it, not the other way around.

## Next time

- Wiring matchers into a game means a game tree. Big, self-referential, parent-pointing. Rust is famously grumpy about that shape.
- Next time we build the CFR tree without fighting the borrow checker, with an arena - the memory kind.
