---
title: "The Mind Reader, Part 5: little-sorry - The Regret Math, in Rust"
description: "A small crate for a big idea: regret matching, CFR+, and the discounted and predictive variants - the numeric core every solver shares"
pubDate: 2026-07-29
tags: ["poker", "rust", "GTO"]
---

_Part 5 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## A crate named for feeling bad

Part 4 ended with a table you could keep on paper. Poker needs millions of them, one per information set, updated billions of times on a millisecond deadline, and that takes code.

Regret in one word is sorry, and little because the crate holds one idea and one dependency, `rand`.

The first commit landed in October 2019, and two days later came one titled "Regret Matching in Rust." That commit made the bet the crate still runs on: the regret math separates from the game. Nothing in [little-sorry](https://github.com/elliottneilclark/little-sorry) knows what a card is. It turns streams of rewards into strategies, and it would do the same for an auction or a firewall.

Six years on, rs-poker depends on little-sorry, and not the other way around.

## One ledger, one method

The API starts with `RegretMinimizer`, and this is the half you have to implement.

```rust
pub trait RegretMinimizer: Clone {
    fn new(num_experts: usize) -> Self;
    fn update_regret(&mut self, rewards: &[f32]);
    fn num_updates(&self) -> usize;
    fn current_strategy(&self) -> &[f32];
    fn cumulative_strategy(&self) -> &[f32];
    fn cumulative_regret(&self) -> &[f32];
}
```

Actions are called experts, the online-learning name for the same thing: a panel of advisors, each with a track record, followed in proportion to how right they have been.

`update_regret` does the work. The caller scores every action, and the crate runs Part 4's whole loop from there: instantaneous regrets, cumulative totals under the variant's discounting of old iterations, a strategy from the positive ones, and a running average.

Two methods read it back, and Part 4 described both before they had names. `current_strategy()` is the mix that chases the opponent, and you sample your next action from it. `best_weight()` normalizes the running average, and the average is the answer you keep.

`average_regret()` says when to stop. It is the largest positive cumulative regret divided by the weight accumulated so far, and it walks toward zero as the node settles. CFR+ resets its accumulators when every action goes negative, so a fresh matcher and a just-reset matcher both report zero, and the check has to be gated on a minimum iteration count or it will mistake the first update for convergence.

Every buffer is allocated in `new`, so `update_regret` writes slices in place and never touches the heap.

## Rock-paper-scissors, now running

Part 4 played two rounds by pencil. The crate ships the same game as code, behind the `rps` feature.

A throw's payoff is three entries.

```rust
const ROCK_REWARD: [f32; 3] = [0.0, 1.0, -1.0];
```

That is the table for a Rock thrown at you: Rock ties, Paper wins a chip, Scissors loses one. Three such tables are the entire game, and a round is two matchers sampling a throw and handing each other the loser's row.

The tests play the matchers against themselves, assert the average strategy lands on one third each, then compute exploitability against that weight and assert it goes small. The test fails if convergence doesn't come.

The runner is generic over the algorithm, which matters because there are six of them.

## Six variants, one dial each

Regret matching converges at 1/sqrt(T), so the last digit of precision costs a hundred times the first. Twenty years of research is, roughly, small changes to how the totals are kept.

**CFR+** ([Tammelin, 2014](https://arxiv.org/abs/1407.5042)) floors cumulative regret at zero, so an action driven deep negative gets a clean slate the moment it turns useful again instead of climbing out of a hole it dug ten thousand iterations ago. It is the algorithm under Cepheus, and the default here.

**Linear CFR** weights iteration _t_ by _t_, and the early iterations, played when both players were terrible, fade.

**DCFR** ([Brown & Sandholm, 2019](https://arxiv.org/abs/1809.04040)) puts that weighting on three dials. Alpha discounts positive regrets, beta the negative ones, gamma the average strategy, and the factor at iteration _t_ is `t^exp / (t^exp + 1)`. The crate ships the paper's `DCFR(1.5, 0, 2)` and a pruning-safe `DCFR(1.5, 0.5, 2)`. **DCFR+** adds CFR+'s floor on top, and turning the dials to their ends recovers CFR+ from the same machine.

**PCFR+ and PDCFR+** ([Xu et al., 2024](https://arxiv.org/abs/2404.13891)) feed the matcher a prediction of the next regret before it picks a strategy, so it anticipates rather than reacts. PDCFR+ carries prediction and discounting together and is state of the art on small games.

Switching between them is one type name.

## Many ledgers, one clock

A poker decision point is not one ledger. The solver holds a range there, and every hand in the range needs its own row over the same three or four actions, so hundreds of ledgers sit behind one node. Give each of them its own matcher and the arithmetic starts repeating itself.

`BatchedMatcher` owns them together, on one iteration clock.

```rust
let node = BatchedMatcher::<Dcfr, Local>::new(8, 3, DiscountParams::RECOMMENDED);
node.update_batch(|action, row| reward(action, row), &mut expected);
```

One tick advances every row. The discount factors depend on the tick and nothing else, so `t^alpha / (t^alpha + 1)` gets computed once for the batch instead of once per row, and a `powf` per row was the tax the scalar matchers paid. `expected[row]` comes back holding that row's value under its pre-update strategy, which is what CFR propagates up the tree.

The memory goes down too. The current strategy is never stored, and gets re-derived from the regret lane on demand, which drops a whole per-row array. Re-deriving it from unchanged regret gives back the exact numbers a stored-strategy matcher would carry, so a batch of one matches its scalar counterpart bit for bit. The scratch buffers are sized to one row, allocated once per call, and reused down the batch.

Every update runs through `&self` on interior-mutable cells - mutating through a shared reference instead of `&mut` - so one routine drives two backends. `Local` is an ordinary `Cell`, deterministic, and `!Sync`, which makes threaded misuse a compile error. `Atomic` is a relaxed `AtomicU32`, `Sync`, and takes updates from every worker at once.

The atomic path races on purpose. An update is a load, an add, and a store, so two threads on one cell can lose one. No theorem covers that. The argument is Hogwild ([Recht et al., 2011](https://arxiv.org/abs/1106.5730)), where lock-free gradient updates converge in expectation under sparse contention, and CFR already swallows the noise Monte Carlo sampling injects. A lost update is a small bounded perturbation, and threads working different branches rarely touch the same row anyway. Run `Local` when reproducibility matters.

## Buying RAM with precision

At blueprint scale - a strategy solved offline for the whole game - the accumulators are the whole memory bill, so the crate lets you pay part of it in precision.

A third type parameter picks the lane layout. Keep regret in scaled `i16` and the strategy average in `u16` and the footprint halves. The saving is smaller than it sounds at poker's narrow nodes, because the `u16` lane carries a per-row weight of its own, and across three actions that one extra word eats most of the gain. Shared-weight layouts drop it to a single cell for the batch, at the price of a stricter contract: every row has to advance on every tick. The `i16` layouts are marked experimental, since exploitability equivalence with the f32 baseline has not been proven.

The finished strategy compresses more cleanly, because it is a probability distribution. `quantize_dist` maps the unit interval onto `0..=65535`, which lands every entry within eight millionths of its float, and the decoder renormalizes because rounding each component alone breaks the sum. The codec ships a solved policy to a runtime that only reads it, and quantized accumulators would wreck a resumed solve.

All of it comes back in the finale, when a preflop blueprint has to fit in memory.

## Next time

Wiring matchers into a real game means a game tree of millions of nodes, each pointing up at its parent and down at its children, with many threads touching it at once.

Rust is famously grumpy about that shape. Part 6 builds it anyway, with an arena.
