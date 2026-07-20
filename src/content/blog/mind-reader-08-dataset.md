---
title: "The Mind Reader, Part 8: The Solver's Blind Spot"
description: "Machine learning starts with a dataset. Ours is a deliberately rough v0.1 - millions of arena hands, a shove-happy cast of agents, and every hole card labeled."
pubDate: 2026-07-30
tags: ["poker", "mind-reader", "machine learning", "dataset"]
---

_Part 8 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Machine learning starts with a dataset

- Part 7 left the solver half-blind. It plays the hand, then deals the opponents cards at random. The range is a guess.
- We want to learn it. A model learns. A model needs data. Data first.
- Karpathy starts on tinyshakespeare - a megabyte of the plays in one file. Dumb on purpose.
- The corpus doesn't matter. The pipeline does.
- Wire it end to end on something you can't botch. Watch it overfit a tiny batch. Then scale. "Don't be a hero."
- So our first dataset is rough by design. It proves the plumbing. Nothing more.

## What one example is

- Input: the public betting, every action at every seat. Label: the two hole cards behind it.
- The model learns P(hand | betting) - a probability for each of the 1,326 possible hands, given the betting.
- A better prior - a sharper starting guess - gives the same unexploitable solver a truer range than uniform-random. We sharpen its input. The play stays unexploitable.

## v0.1: let the arena deal

- The arena already writes [Open Hand History](https://hh-specs.handhistory.org/), the standard JSON format for a poker hand. Seat the agents. Press go. Read the file.
- `RandomPotControl` is the recreational player - the fish, betting without a plan.
- Three CFR agents each wear a different preflop chart - which hands to play from each seat - lifted from online solves: `Pekarstas-6max-RFI`, `GTO-Experiment`, `6Max-RFI-GTO`.
- One more CFR agent runs no chart at all, just a realtime budget: `CFR-Configurable`.
- Tables run 2 to 6 seats, split evenly. Heads-up to short-handed. Position and player count both move.
- 613,399 hands. About 1.4 GB. Newline-delimited JSON, one hand per record.
- The labels are free. Real histories show cards only at showdown.
- The arena sees every seat. It writes every hole card on every hand - folded, won, or shown. Every hand is labeled.
- It is public: [`otter-crew/range-reader-v0.1`](https://huggingface.co/datasets/otter-crew/range-reader-v0.1) on Hugging Face. 613,399 hands, 1.42 GB.

## What v0.1 gets wrong

- The play over-shoves. One hand in six goes all-in. More than half never leave preflop. The agents trusted a read they had not earned.
- These agents carried the crude estimator from Part 7. Sure of a range they had no right to, they committed.
- The pre-neural-net state of the art fixes this. Libratus and Pluribus reason over a precomputed _blueprint_.
- The blueprint is an MCCFR (Monte Carlo CFR) strategy that gives every hand a probability. At any node you hold a real range, not a point guess.
- No neural nets. Just abstraction and self-play. v0.1 has none of it.
- So the data leans loose and shove-happy. A known bias, written down.
- Good enough to build the pipeline. Not good enough to trust the numbers.
- That is the plan. v0.1 proves the pipeline. The ranges get better from here.

## Next time

- Part 9 is the model. Predicting hole cards from betting is a translation problem. Read one sequence. Emit another you can read.
