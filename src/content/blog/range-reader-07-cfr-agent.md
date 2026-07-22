---
title: "The Range Reader, Part 7: An Agent That Solves While It Plays"
description: "CFRAgent - budget-driven exploration, regret-based pruning, and board enumeration, wired into the arena"
pubDate: 2026-07-22T15:00:00Z
tags: ["poker", "rust", "GTO"]
---

_Part 7 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Assembly time

A solver you can buy gets one spot, two fixed ranges, and all the time it wants. This agent gets a live table, hidden cards, and two seconds. It finds its node in a tree it is still building, runs CFR until the clock stops it, and bets.

That is what the six parts before it were for. A card is a number; seven of them rank in under a nanosecond; a game state clones with a memcpy; a million nodes hold still under threads. All of it, so two seconds is enough.

`CFRAgent` solves the hand while it plays it.

## What we took from chess engines

Chess engines solved real-time search decades ago. The game is nothing like poker and the scheduling problems are identical, so we took what worked.

An engine gets a clock, not an iteration count, because a player has a few seconds and does not care how many nodes that buys. Budgets are the same contract.

Engines look up the first ten moves instead of searching them. Preflop charts are our book; they get a section below.

When the best move stops changing, an engine plays it. Ours stops after three waves where the strategy barely moves.

Not everything ported. We took Stockfish's reverse futility pruning, wired it in, ran the matches. It measured negative. Gone. Every idea plays a match before it ships.

## Fifty-two slots

Part 6 gave every node fifty-two children. Here is why.

An action becomes an index in `0..52`. Fold is 0, call is 1, all-in is 51. The forty-nine slots between are raise sizes, spaced logarithmically from the minimum raise to the stack. The gap between two and four big blinds matters. The gap between eighty and eighty-two does not.

```rust
pub const ACTION_IDX_FOLD: usize = 0;
pub const ACTION_IDX_CALL: usize = 1;
pub const ACTION_IDX_RAISE_MIN: usize = 2;
pub const ACTION_IDX_RAISE_MAX: usize = 50;
pub const ACTION_IDX_ALL_IN: usize = 51;
pub const NUM_ACTION_INDICES: usize = 52;
```

Part 0 named the price: a live opponent bets outside the set, and you have to map it to a size you know. These forty-nine slots are that map. Two sizes can land in one slot, so the engine dedups by index before it trains and the picker dedups again before it samples. Skip the second and the collided slot counts twice, doubling its odds without telling anybody.

A node's matcher holds fifty-two experts, one per slot. Most are illegal on any turn, and those score minus the player's starting stack - the worst the game allows.

## One decision, from the inside

The agent's turn arrives. It finds its node, and if the node has no matcher, it gets one. Then it iterates.

The unit of work is a wave. It tries every live action against the strategy the node holds, averages the samples in each slot, and applies one regret update with the whole vector. That is Part 5's `update_regret`, once per wave. Split it across actions, and the node learns from half a wave.

```rust
loop {
    let stats = ExplorationStats { elapsed, iterations, nodes_touched, depth, avg_regret, timer_armed };
    let (wave_width, fast_forward) = match self.budget.next_step(&stats) {
        NextStep::Stop | NextStep::Pass => break,
        NextStep::Wave { width } => (width, false),
        NextStep::FastForward => (1, true),
        // StartTimer arms the deadline and continues
    };
    // ... sample every live action, sum and count per slot ...
    wave_mean_into(&mut rewards, &sums, &counts, invalid_action_penalty);
    self.update_regret_at_node(target_node_idx, &rewards);
}
```

Trying an action means playing it out. Clone the game state, which Part 1 made a memcpy. Force a copy of the agent to the action under test. Seat fresh CFR sub-agents in the other chairs and hand them the same tree, budget, and stop flag. Run a whole `HoldemSimulation` and read that seat's chips off the end.

Those sub-agents run this same loop. That is where the branching lives, and where the budget earns its keep.

The tree grows the whole time. Every sub-simulation appends nodes where it walks, so a wave spent on the flop leaves the turn cheaper.

Then the agent acts. It samples.

```rust
let weights = matcher.best_weight();
let random_value: f32 = rng.random::<f32>() * total_weight;
```

`best_weight` is Part 4's average strategy, normalized. It says raise 70%, call 30%, and the agent rolls at those odds. Take the argmax - the single highest-weighted action - and you raise every time, and the man across the table learns that inside an hour. Frequencies are what make you unreadable.

## Stopping is a flag

The clock has to reach every level of the recursion, and the recursion is spread over tokio tasks on several threads.

So stopping is cooperative. One `Arc<AtomicBool>` is shared by the root and every sub-agent under it. When the budget asks for a timer, the root spawns a task that sleeps and flips the flag. Every level reads it at its next wave boundary and breaks.

The check sits before a wave samples anything, and again after the samples come home. A wave that began before the flag flipped and ended after it is thrown away whole. The alternative is a node that learned from three actions out of five and cannot tell.

Running out of budget is not an error. It means fewer waves, and the agent picks from its regret.

## Guessing what they hold

To play the hand out, the agent has to deal the opponents something. What it deals them is a claim about their range, and it is the weakest claim in the system.

```rust
#[async_trait]
pub trait HandDistributionEstimator: Send + Sync {
    async fn estimate(&self, game_state: &GameState, history: Option<&GameLog<'_>>)
        -> OpponentRanges;
    fn needs_history(&self) -> bool { false }
}
```

Once per decision, the agent asks for a range for every hidden seat. Every wave re-deals those seats from those ranges. The board holds. The agent's own cards hold. Only the opposition changes, which is what CFR wants: one spot, played against a different plausible world each time.

`estimate` is async and takes the betting history because Act 4 needs both. The model that fills this trait runs on a GPU and reads the whole hand.

Two estimators ship. `KnownHandsEstimator` peeks at the real cards, an oracle for tests and benchmarks. `UniformRandomEstimator` assumes any two cards, and it is what plays in the arena.

One cheats, and one knows nothing. A real read lives between them, and closing that gap is the rest of the series.

## Budgets

The budget answers one question at every wave boundary. Keep going, go cheap, or stop?

```rust
pub trait Budget: Send + Sync {
    fn next_step(&self, stats: &ExplorationStats) -> NextStep;
}

pub enum NextStep {
    Wave { width: usize },
    FastForward,
    StartTimer { duration: Duration },
    Pass,
    Stop,
}
```

`ExplorationStats` is what the engine can report: elapsed wall clock, waves at this node, nodes in the tree, depth, and the node's average regret from the last update. Part 5 built that last one to walk toward zero as a node settles.

The leaves are small, each with one opinion. `Deadline` arms the timer. `IterationCount` caps waves at a node. `NodeCount` caps the tree. `RegretBelow` stops once the node goes quiet and enough iterations have run to trust the quiet. `MaxWidth` carries a width per depth; past the end of its list, `FastForward` - full recursion near the root, cheap lookahead below.

Two combinators do the rest. `PerDepth` dispatches to a different budget at each level, and `MostRestrictive` runs them all and takes the tightest answer.

It is all JSON, so changing one is a text edit.

```json
[
  { "type": "deadline", "millis": 250 },
  { "type": "per_depth_iterations", "counts": [24, 3, 1] },
  { "type": "regret_below", "epsilon": 0.001, "min_iterations": 8 },
  { "type": "max_width", "recursive_widths": [8, 1, 1] }
]
```

`rsp --budget` takes that inline or as a file, on any subcommand. The dial runs both ways: a hundred milliseconds for a million hands of self-play, a couple of seconds for one hand that matters.

## Spending the budget well

Most of the tree is never worth a second look.

Regret-based pruning (Brown & Sandholm, 2015) is the first cut. After a short warm-up, the engine reads which actions the matcher has driven to zero weight and takes no samples for them. A pruned slot keeps the penalty reward, which holds its regret at zero and keeps it pruned. Every fourth wave reprobes everything, in case one came back.

A second filter catches what the first cannot. PCFR+ floors regrets at zero, so an action rarely goes negative enough to prune outright. It just gets small. Each wave drops any action whose probability sits below `c / sqrt(iterations)`, a threshold that tightens as the node settles (Brown, Kroer & Sandholm, 2017). Reprobe waves skip this filter too.

Both decisions are made once per wave, so every sample agrees about which actions exist. A wave averaged over a shifting set of actions is not an average of anything.

Deeper in the tree, recursion stops, and a fast-forward takes over. It applies the action to a cloned state, assumes every later action by every player is a check or a call, deals what is left of the board, and scores the showdown. It throws away the mutual best response - the accurately solved continuation - and costs a bounded number of evaluations.

Then it enumerates instead of sampling. No cards to come is one evaluation. One card is all forty-six. Two is all thousand-and-thirty-five. Three would be sixteen thousand, so it samples three flops and enumerates every turn and river under each.

Part 2's accumulator makes that affordable: tally the board once, copy sixteen bytes, add two cards, rank. A thousand runouts land inside a microsecond.

Enumeration earns its arithmetic. A sampled board puts noise in the reward, the noise lands in the regret, and the node needs more waves to say the same thing. A thousand evaluations to stop guessing is cheap when a wave costs a sub-simulation.

## The one street we don't solve

Postflop the tree is kind. The cards are down, most of the range is gone, and rarely more than two or three players see a flop.

Preflop is the opposite. Every hand, every position, every stack is still live, and the branching peaks where the clock starts. Nobody solves that in two seconds.

So we don't. Every serious bot precomputes preflop offline - Libratus and Pluribus call it a _blueprint_ - and solves the rest live. We take the same shape at hobby scale.

rs-poker ships a rough preflop config: ranges and frequencies per position and per action, nothing finer. The agent looks up its spot and plays the chart, and only when the hand leaves the book does it fall through to the live solver.

Rough is the point. Preflop has to be sane, not perfect. The finale says what the real version looks like.

## How good is it?

`rsp arena generate` settles it. Same field as Part 3, seats rotated, hands by the hundred thousand.

```
Name                            Change                Games
CFR-Configurable               +51783.8              232013
GTO-Experiment                 +38119.4              612557
6Max-RFI-GTO                   +7753.6               612840
Pekarstas-6max-RFI             -25504.5              614384
RandomPotControl               -72153.6              380683
```

The pot-control agent won every match in Part 3 and finishes last here.

The CFR agents take the top three chairs. The one with no preflop chart takes the first. Give a solver a clock and a tree, and it beats a tuned heuristic without being told a thing about poker.

One weakness is left, the one from three sections ago. Every hand above was played against opponents dealt random cards. The solver is doing correct arithmetic on a guess.

## Next time

The solver plays a full hand now, on a clock, out of a tree it grows as it goes. It still deals you two random cards and reasons from there.

Part 8 opens Act 4. Millions of labeled hands, every hole card written down, and a first look at what that data can and cannot teach.
