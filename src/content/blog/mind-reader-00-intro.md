---
title: "The Mind Reader, Part 0: Teaching a Computer to Read Your Mind at Poker"
description: "There is no open source engine for multiway no-limit hold'em. A 13-part series building one - fast cards, a full-rules arena, CFR, and a GPT that reads your hand"
pubDate: 2026-07-20
tags: ["poker", "rust", "machine learning"]
---

## Nobody has published this code

Online poker moves more money on skill than any game on the internet. The chips go to whoever plays better or bets better (assuming no collusion, but if you want to collude, please play in Atlanta's I-75 rush-hour traffic).

Chess and Go went the other way. Stockfish, Leela, KataGo. All open, all stronger than any human. Poker went dark. Libratus and Pluribus came as papers with no code. The commercial solvers ship as binaries and charge by the month. Nobody has even published a starting point for the hard parts.

So the charts go unchecked. A player buys a preflop range, or pulls one out of a Discord, and plays it for a year. He cannot see the abstraction behind it, the bet sizes that were allowed, or how far from equilibrium it stopped. Ask what it loses to a perfect counter, and neither the coach who sold it nor the site that generated it can say. The chart is a number with no error bar, and the whole game is built on it.

I wrote mine in the open. Ten years, three repos on GitHub.

A card as an integer. An evaluator that ranks 50 million hands a second. A full-rules simulator. Regret matching. A game tree that survives Rust. A solver on a stopwatch.

Then, the part I have not seen shipped anywhere. A transformer that watches you bet and names your two cards.

## How much poker is running

Nobody publishes a total. Six parties publish a piece, in six different units, and none of the units convert.

| Published                 | Figure             | Who says so           |
| :------------------------ | :----------------- | :-------------------- |
| GGPoker hands, 2025       | 5.08B              | GGPoker               |
| PokerStars hands, 2013-19 | ~17B / year        | PokerStars, then mute |
| Filled cash seats, world  | ~32,000            | trackers, disputed    |
| Europe online rake, 2024  | EUR 1.5B           | H2 Gambling Capital   |
| Nevada card rooms, FY25   | $222M              | Gaming Control Board  |
| WSOP 2025                 | $47M kept on $527M | WSOP                  |

Start with the only site that likes being counted. GGPoker dealt 5.08 billion hands in 2025, up from 4.87 billion ([Rakerace](https://rakerace.com/es/noticias/salas-de-poker/2026/01/08/ggpoker-in-2025-five-billion-hands-dealt-as-tournament-play-drives-record-year)). Fourteen million a day. A hundred sixty-one a second.

PokerStars once counted too. Its hundred billionth hand fell in June 2013 and its two hundred billionth in May 2019 ([PR Newswire](https://www.prnewswire.com/news-releases/pokerstars-deals-its-200-billionth-hand-300848091.html)), which is seventeen billion a year. Then it stopped saying. Flutter bought it and files poker inside a line called iGaming, beside slots and bingo and lottery ([SEC](https://www.sec.gov/Archives/edgar/data/1635327/000163532726000005/flut-20251231.htm)). Poker appears in that filing eighty-nine times and never once with a number beside it.

The trackers see 32,000 filled cash seats worldwide and give GGPoker nine thousand of them ([VIP-Grinders](https://www.vip-grinders.com/research/online-poker-traffic-report/)). They also disagree with each other by a factor of ten on the crypto rooms, so call GG a fifth of the game, or a third. Run that share backward against its hand count and the world deals fifteen to twenty-five billion hands a year. The old PokerStars rate lands in the same decade.

The money says less than you would hope. Europe's regulated rooms took EUR 1.5 billion in rake and fees in 2024, flat since 2020 ([EGBA](https://www.egba.eu/uploads/2025/03/250324-EGBA-European-Gaming-Market-Key-Figures-2025-Edition.pdf)). Nevada's card rooms grossed $222 million in the year to June 2025 ([Gaming Control Board](https://www.gaming.nv.gov/)). The World Series collected $527 million in buy-ins, returned $482 million, kept $47 million ([WSOP](https://www.wsop.com/)). Scale those against the rooms nobody regulates and the house keeps somewhere near five to nine billion dollars a year.

What the players push at each other is bigger, and no one can tell you by how much. A pot is never published. So the honest headline is the hand count: **fifteen to twenty-five billion hands a year, dealt for about seven billion dollars in rake.** The range is wide because it rests on the one company that volunteers a number.

## Who's telling this story

I'm [Elliott Clark](https://elliottclark.info). My day job is storage and machine learning at scale. Apache HBase, then seven years building the ad infrastructure at Facebook, then five years founding a company focused on Kubernetes and Postgres vector databases. Poker is the side project.

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

The range a solver needs is the distribution equilibrium that the play itself implies, and a solver approximates it from its blueprint. That approximation frays as the hand runs on. Bet sizes land outside the abstraction. The same size means different things to different people. An overbet arrives where the blueprint has nothing to say. By the river, the prior is thin.

This series takes the second problem. Learn the posterior from the betting record, hand it to the same unexploitable solver, and the play does not change. The input just gets truer faster.

## The code

**rs-poker** ([repo](https://github.com/elliottneilclark/rs-poker)). Poker fundamentals in Rust. Hand evaluation at 50M hands per second per core, Monte Carlo equity, Omaha, ICM. Ten years of work. It also holds the arena, a full-rules no-limit table where bots play each other and every hand is written out as Open Hand History. That file is what the net trains on. The Foundations and Simulation arcs.

**little-sorry** ([repo](https://github.com/elliottneilclark/little-sorry)). The regret math. Six CFR variants behind one trait, no allocations in the hot path. The Regret arc.

**range-reader** ([repo](https://github.com/Otter-Crew/range-reader)). The mind reader. A GPT-style transformer in PyTorch with embeddings, loss, and vocabulary rebuilt for poker. It learns P(hand | betting) over all 1,326 combos. The Reading Minds arc.

None of this beats Pluribus. Pluribus had a lab and a cluster. What is here is every piece of the machine, running on hardware you own, with the tests that prove it.

What is missing are better games. The training hands were dealt by rough agents, and a model only learns to read the players it was shown. I will show you those gaps rather than hide them.

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
