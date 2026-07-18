---
title: 'The Mind Reader, Part 0: Teaching a Computer to Read Your Mind at Poker'
description: 'Kicking off a 14-part series on building a poker bot from scratch - fast cards, a full-rules arena, CFR, and a GPT that reads your hand'
pubDate: 2026-07-20
tags: ['poker', 'mind-reader', 'rust', 'machine learning']
---

## The claim

- I built a model that can tell you what two cards you're holding from nothing but the way you bet. Sit down, play a hand, and it names your hole cards.
- Estimating hidden hands is one of the hard open problems in computer poker.
- This series covers the ten years and four projects it took to get here. All of it is open source.

## Who's telling this story

- I'm [Elliott Clark](https://elliottclark.info). My day job is distributed systems and infrastructure.
- Poker is the side project.
- It started at Microsoft. Redmond is a beautiful town. Exciting, it is not.
- So I played the Microsoft tournaments. Zero rake, sharp programmers, prize pools with World Series of Poker entries. Poker got exciting.
- Then I read the Coding the Wheel "How I Built a Working Online Poker Bot" articles ([archive link](https://archive.is/vFTef)).
- They screen-scraped clients and injected mouse clicks. Janky, but it convinced me poker is a programming problem.
- Every few years a new tool - a faster language, a new algorithm, now transformers - makes the next step possible. I go back in.
- This is the latest time. Not the last, I'm sure.

## What "solving" poker even means

- Chess and Go fall to search. Both players see the whole board, so a strong engine just looks further ahead than you.
- Poker hides the opponent's cards. The best move depends on information you don't have.
- "Solved" means a Nash equilibrium - unexploitable, unable to lose in expectation no matter what the opponent does. Heads-up poker is effectively solved this way.
- Beyond heads-up there is no single Nash solve. Equilibria still exist - three-player Kuhn poker has infinitely many.
- They aren't interchangeable. Different equilibria split the EV differently. Compute your own and the pieces don't fit together.
- So the job changes. Find one unexploitable strategy you can compute and store at poker scale.
- The scorecard is exploitability - what a perfect best-responder wins against you, in milli-big-blinds per game. Drive it toward zero.
- One caveat. Multiway equilibria don't carry the full two-player guarantee. Coordinated opponents can in theory shift EV against you.
- In real Hold'em those spots barely exist. Low measured exploitability is the strongest target the multiway game offers.

## CFR, in one breath

- The workhorse is Counterfactual Regret Minimization (CFR). Break the game into small decision points.
- At each one, track how much you regret not taking each action. Play actions in proportion to accumulated regret.
- Heads-up, this provably converges to equilibrium. Multiway, the proof is gone but the strategies are still superhuman. Pluribus beat pros six-handed this way.
- Two problems remain, and they define the frontier:
  - **Valuing a node fast.** There are too many poker situations to solve each to the end. You need a fast, accurate estimate of what a state is worth.
  - **Knowing what they hold.** CFR reasons over the opponent's range - every hand they could have. Estimating that range from their actions is the critical input for live play.
- This series attacks the second problem. Get the range right and you're not guessing. You're reading minds.

## The four projects

- **rs-poker** ([github.com/elliottneilclark/rs-poker](https://github.com/elliottneilclark/rs-poker)) - a Rust library of poker fundamentals. Hand evaluation at 50M+ hands per second per core, Monte-Carlo equity, Omaha, ICM. Ten years of work. Covered in the Foundations arc.
- **The arena** (inside rs-poker) - a full-rules No-Limit Hold'em simulation where bot agents play each other. It writes standard Open Hand History files, the format the neural net trains on. Covered in the Simulation arc.
- **little-sorry** ([github.com/elliottneilclark/little-sorry](https://github.com/elliottneilclark/little-sorry)) - the regret math in Rust. Six CFR variants behind one trait, zero allocations in the hot path. Covered in the Regret arc.
- **range-reader** ([github.com/Otter-Crew/range-reader](https://github.com/Otter-Crew/range-reader)) - the mind reader itself. A PyTorch transformer, GPT-style, with embeddings, loss, and vocabulary reshaped for poker. It learns P(hidden hand | betting history) over all 1,326 combos. Covered in the Reading Minds arc.

## The Map

<!-- Plain text until published; swap each title for a link as it ships. -->

Each part is tagged by what it's mostly about: **[Rust]**, **[Math]**, **[ML]**.

**Arc 1 - Foundations**

1. **[Rust]** The Mind Reader, Part 1: A Deck of Cards Is a u64
2. **[Rust]** The Mind Reader, Part 2: Ranking Hands at Ludicrous Speed

**Arc 2 - Simulation**

3. **[Rust]** The Mind Reader, Part 3: The Arena - Full-Rules Poker and the Agents That Play It

**Arc 3 - Regret**

4. **[Math]** The Mind Reader, Part 4: Regret Is All You Need
5. **[Rust][Math]** The Mind Reader, Part 5: little-sorry - The Regret Math, in Rust
6. **[Rust]** The Mind Reader, Part 6: Trees in Rust Without Tears
7. **[Rust][Math]** The Mind Reader, Part 7: An Agent That Solves While It Plays

**Arc 4 - Reading minds**

8. **[ML]** The Mind Reader, Part 8: The Solver's Blind Spot
9. **[ML]** The Mind Reader, Part 9: Hole Cards as a Translation Problem
10. **[ML]** The Mind Reader, Part 10: Embeddings That Mirror Poker
11. **[ML]** The Mind Reader, Part 11: Did It Learn to Read Minds?

**Finale**

12. **[ML]** The Mind Reader, Part 12: What Comes Next - poker-assistant

## Next time

- Part 1 starts with a small decision. A playing card is just a number. That choice sets the speed ceiling for every simulation, solver, and training run that follows.
