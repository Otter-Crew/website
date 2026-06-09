---
title: 'RS-Poker V5: The one with self learning Agents'
description: 'rs-poker v5.0.0 releases with async RL arena, a state-of-the-art CFR agent, and an `rsp` CLI'
pubDate: 2026-05-09
tags: ['rust', 'reinforcement learning', 'GTO', 'poker']
---

v5.0.0 is a huge breaking release. We destroy all backwards compat this one time, in the hopes it was worth it. 

In breaking so many things we get a highly tuned RL arena for poker and a [counterfactual regret minimization](https://modelai.gettysburg.edu/2013/cfr/cfr.pdf) agent that's configuratble and budget driven exploration is the most complete and state of the art in the  open source world. No need to pay for closed source GTO calculators. This is
all open source now.

If you want to research poker this release gives you the fastest tools
with compact and performant implementations of all the most recent
research into poker bots in the world. Write your own async `Agent`
or use our pre-built strategies. Compare how they do against each
other.

If you're a poker enthusiast then this release is for you. You get a TUI to
browse your hand history in [Open Hand History](https://hh-specs.handhistory.org/) format. Or anonymize your logs before sending them off to others.

## Highlights
- **`rsp` CLI** — a single unified poker toolkit binary (holdem, arena, omaha,
  ICM, OHH) with interactive TUIs, a global `--budget` flag, and a jemalloc
  allocator tuned for CFR's allocation profile.
- **Async arena** — `Agent` and `Historian` are now `Send` with `async fn`
  methods; the simulation round state machine awaits on a tokio runtime.
- **Perfect-hash hand evaluator** — 2.2–2.4× faster `rank()`, `Rank` shrunk
  from 8 bytes to 2.
- **CFR overhaul** — single shared tree, compact action space, regret-based
  pruning, full board enumeration, PCFR+ regret matching, and a composable
  budget tree replacing the old tangle of depth/recursion/cancellation knobs.
- **Pluggable opponent-hand estimation** — a new `HandDistributionEstimator`
  trait and per-wave world sampling, the base for ML-driven range inference.

## Getting `rsp`

Everything lives in one crate: [`rs-poker`](https://crates.io/crates/rs-poker)
on crates.io, source on [GitHub](https://github.com/elliottneilclark/rs-poker).

The `rsp` binary is gated behind a feature flag, so install it with:

```bash
cargo install rs_poker --features rsp
```

That drops a single `rsp` binary on your `PATH`. A quick tour:

```bash
# Rank a five-card hand
rsp holdem rank AcKdQhJsTs

# Monte Carlo equity, AdKh vs 8c8s
rsp holdem simulate AdKh 8c8s

# Outs on a given board
rsp holdem outs AcAd KsKh --board QhJhTh --detailed

# Pit a directory of agent configs against each other
rsp arena compare ./examples/configs -n 5000 -p 3

# Chip stacks to tournament $EV
rsp icm simulate --chip-stacks 1500 1250 600 500 850 800 --payments 50 30 20 --iterations 50000
```

The global `--budget` flag bounds how much work the solver does, so you can
trade accuracy for time on any subcommand. Hand-history browsing and
anonymization live under the same binary too.

If you just want the library — the evaluator, arena, and CFR types — to build
your own tools on top of, skip the feature flag and add it as a dependency:

```bash
cargo add rs_poker
```

I'll write more about the different parts of the `rsp`, poker CFR, and the reinforcement learning arena in future articles. I think there's some very interesing research here, and solving these types of games is possible.
