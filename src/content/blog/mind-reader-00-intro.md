---
title: "The Mind Reader, Part 0: Teaching a Computer to Read Your Mind at Poker"
description: "There is no open source engine for multiway no-limit hold'em. A 13-part series building one - fast cards, a full-rules arena, CFR, and a GPT that reads your hand"
pubDate: 2026-07-20
tags: ["poker", "rust", "machine learning"]
---

## Nobody has published this code

Online poker moves more money on skill than any game on the internet. The chips go to whoever plays better or bets better (assuming no collusion, but if you want to collude, please play in Atlanta's I-75 rush-hour traffic).

Chess and Go went the other way. Stockfish, Leela, KataGo. All open, all stronger than any human. Poker went dark. Libratus and Pluribus came as papers with no code. The commercial solvers ship as binaries and charge by the month. Nobody has even published a starting point for the hard parts.

So the charts go unchecked. A player buys a preflop range, or pulls one out of a Discord, and plays it for a year. He cannot see the abstraction behind it, the bet sizes that were allowed, or how far from equilibrium it stopped. Ask what it loses to a perfect counter, and nobody can tell him. Not the coach who sold it. Not the site that generated it. The chart is a number with no error bar, and the whole game is built on it.

I wrote mine in the open. Ten years, three repos on GitHub.

A card as an integer. An evaluator that ranks 50 million hands a second. A full-rules simulator. Regret matching. A game tree that survives Rust. A solver on a stopwatch."mind-reader",

Then, the part I have not seen shipped anywhere. A transformer that watches you bet and names your two cards.

## How much poker is running

No network publishes counts. Trackers scrape the lobbies and disagree, sometimes by half. Read the spread as the error bar.

SharkScope counted about 32,000 filled cash seats worldwide on an average day in July 2026 ([VIP-Grinders](https://www.vip-grinders.com/research/online-poker-traffic-report/)). Rakerace saw the same band, 22,000 to 32,000, across 2024 and 2025 ([Rakerace](https://rakerace.com/news/poker-articles/2025/08/27/global-online-poker-traffic-2022-2025-peaks-declines-and-the-road-ahead)). GGPoker tops both at roughly 9,000, a third of the whole game.

| Network       | Pool           |  Cash seats |
| :------------ | :------------- | ----------: |
| GGPoker       | International  |       9,726 |
| CoinPoker     | Crypto         |       2,032 |
| PokerStars    | International  |       1,926 |
| iPoker        | International  |       1,074 |
| Winamax       | France & Spain |       1,014 |
| The long tail | 40+ networks   |     ~16,000 |
| **Total**     |                | **~32,000** |

Those are SharkScope's counts. [PokerScout](https://www.pokerscout.com/) agrees on GGPoker and puts CoinPoker at 214, not 2,032, and Winamax at 27, not 1,014. Nobody counts an anonymous crypto room the same way twice, so CoinPoker sits second in the world or seventh, take your pick. That is the error bar.

Seats are not hands. Four to six players a table, sixty to a hundred hands an hour each ([Upswing](https://upswingpoker.com/hands-per-hour-live-poker-vs-online/)). Multiply the corners:

| Estimate | Hands / hour | Hands / day | Hands / year |
| :------- | -----------: | ----------: | -----------: |
| Low      |     ~200,000 |         ~5M |        ~1.8B |
| Middle   |     ~400,000 |        ~10M |        ~3.5B |
| High     |     ~800,000 |        ~19M |          ~7B |

Low is the thin field at the full-ring pace, high the fat one all six-max. Billions a year, whichever tracker you trust.

The card rooms add less. The US has 5,618 live tables across 589 rooms ([World Casino Directory](https://www.worldcasinodirectory.com/united-states/poker-rooms)), and 2,100 run on a busy Saturday ([Poker Pilgrims](https://www.pokerpilgrims.com/the-state-of-cash-poker-in-the-us-in-2025/)); Nevada alone licenses 635 ([Gaming Control Board, FY25](https://www.gaming.nv.gov/siteassets/content/about/info-sheet/2025-info-sheet.pdf)). A dealer pushes 20 to 35 hands an hour ([Upswing](https://upswingpoker.com/hands-per-hour-live-poker-vs-online/)), half the online rate. Forty to ninety thousand live hands an hour, nationwide. Real, and a fraction.

## Who's telling this story

I'm [Elliott Clark](https://elliottclark.info). My day job is storage and machine learning at scale. HBase, then seven years building the ad infrastructure at Facebook, then five years founding a company focused on Kubernetes and Postgres vector databases. Poker is the side project.

It started at Microsoft. Redmond is a beautiful town. Exciting, it is not. So I played in the company tournaments. Zero rake, sharp programmers, World Series entries in the prize pool. Poker was exciting.

Then I read the Coding the Wheel articles, "How I Built a Working Online Poker Bot" ([archive link](https://archive.is/vFTef)). Screen-scraped clients, injected mouse clicks. Janky. Programming poker became exciting.

I have been back at it every few years since, whenever a new tool made the next step possible. A faster language. A new algorithm. Now, multi-head attention.

## What "solving" poker even means

Chess and Go fall to search. Both players see the board, and the engine looks further ahead than you. Poker hides the cards. The best move depends on what you cannot see.

Solved means unexploitable. It cannot lose in expectation, whatever you do. Cepheus took heads-up limit hold'em that far in 2015, under one milli-big-blind per game ([Bowling et al., Science](https://www.science.org/doi/10.1126/science.1259433)). A lifetime of play cannot tell it from perfect.

Past heads-up, there is no single solution. Equilibria still exist. Three-player Kuhn poker, a four-card toy, has infinitely many. They do not fit together. Each splits the money its own way, so two players computing separately end up in different games.

So the job changes. Find one strategy you can compute and store at a poker scale. The scorecard is exploitability, what a perfect counter wins against you in milli-big-blinds per game. Drive it toward zero.

## CFR, in one breath

The workhorse is Counterfactual Regret Minimization. Break the game into small decisions. At each one, track how much you regret the actions you skipped. Play them in proportion to that regret.

Heads-up, it probably converges. Multiway, the proof is gone, and the strategies win anyway. Pluribus beat elite professionals six-handed this way.

Two problems remain. They are the frontier.

### Valuing a node fast

A chess engine stops the search and scores the position. Poker has no score to hand back. A state in an imperfect-information game has no well-defined value, because what a spot is worth depends on the strategies both players run everywhere else, including the branches you just cut ([Brown, Sandholm & Amos, 2018](https://arxiv.org/abs/1805.08195)).

The branching makes it worse. No-limit lets you bet anything from the minimum to your stack. A hundred blinds deep, that is hundreds of legal sizes at one decision, on four streets, against every stack the table can hold. Nobody solves that. Solvers pick a handful of sizes and throw the rest away.

Then a live opponent bets something outside the set, and you have to map it to a size you know. The heuristics everyone used for that proved highly exploitable, and the corrected mapping introduced a paradox. Adding bad actions to your abstraction can make you play better ([Ganzfried & Sandholm, 2013](https://www.cs.cmu.edu/~sandholm/reverse%20mapping.ijcai13.pdf)).

The way out is to stop early and let a network say what the leaf is worth. DeepStack learned that value from self-play and re-solved every decision as it came ([Moravcik et al., 2017](https://arxiv.org/abs/1701.01724)). Brown and Sandholm's depth-limited version lets the opponent choose among several continuations at the cut and beats two top agents on four cores and 16 GB.

### Knowing what they hold

CFR reasons over the opponent's range, every hand they could hold, weighted. Get the range wrong, and every value below it is wrong with it.

Alberta chased this twenty years ago by keeping a posterior over opponent strategies and playing a response to it ([Southey et al., 2005](https://arxiv.org/abs/1207.1411)). That is opponent modeling, and it leads to exploitation. This series does not go there.

The range a solver needs is not a read on the person. It is the distribution equilibrium that the play itself implies, and a solver approximates it from its blueprint. That approximation frays as the hand runs on. Bet sizes land outside the abstraction. The same size means different things to different people. An overbet arrives where the blueprint has nothing to say. By the river, the prior is thin.

This series takes the second problem. Learn the posterior from the betting record, hand it to the same unexploitable solver, and the play does not change. Only the input gets truer faster.

## The code

**rs-poker** ([repo](https://github.com/elliottneilclark/rs-poker)). Poker fundamentals in Rust. Hand evaluation at 50M hands per second per core, Monte Carlo equity, Omaha, ICM. Ten years of work. It also holds the arena, a full-rules no-limit table where bots play each other and every hand is written out as Open Hand History. That file is what the net trains on. The Foundations and Simulation arcs.

**little-sorry** ([repo](https://github.com/elliottneilclark/little-sorry)). The regret math. Six CFR variants behind one trait, no allocations in the hot path. The Regret arc.

**range-reader** ([repo](https://github.com/Otter-Crew/range-reader)). The mind reader. A GPT-style transformer in PyTorch with embeddings, loss, and vocabulary rebuilt for poker. It learns P(hand | betting) over all 1,326 combos. The Reading Minds arc.

None of this beats Pluribus. Pluribus had a lab and a cluster. What is here is every piece of the machine, running on hardware you own, with the tests that prove it.

What is missing are better games. The training hands were dealt by rough agents, and a model only learns to read the players it was shown. I will show you those gaps rather than hide it.

## The Map

Come back here. Each part is tagged **[Rust]**, **[Math]**, or **[ML]**.

<!-- Plain text until published; swap each title for a link as it ships. -->

**Arc 1 - Foundations**

1. **[Rust]** Part 1: A Deck of Cards Is a u64
2. **[Rust]** Part 2: Ranking Hands at Ludicrous Speed

**Arc 2 - Simulation**

3. **[Rust]** Part 3: The Arena - Full-Rules Poker and the Agents That Play It

**Arc 3 - Regret**

4. **[Math]** Part 4: Regret Is All You Need
5. **[Rust][Math]** Part 5: little-sorry - The Regret Math, in Rust
6. **[Rust]** Part 6: Trees in Rust Without Tears
7. **[Rust][Math]** Part 7: An Agent That Solves While It Plays

**Arc 4 - Reading minds**

8. **[ML]** Part 8: The Solver's Blind Spot
9. **[ML]** Part 9: Hole Cards as a Translation Problem
10. **[ML]** Part 10: Embeddings That Mirror Poker
11. **[ML]** Part 11: Did It Learn to Read Minds?

**Finale**

12. **[ML]** Part 12: What Comes Next

## Next time

Part 1 starts small. A playing card is a number. That choice sets the speed ceiling for every simulation, solver, and training run after it.
