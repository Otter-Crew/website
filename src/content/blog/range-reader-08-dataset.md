---
title: "The Range Reader, Part 8: The Arena Deals the Data"
description: "Machine learning starts with a dataset. Ours is a deliberately rough v0.1 - over 600,000 arena hands, a shove-happy cast of agents, and every hole card labeled."
pubDate: 2026-07-22T16:00:00Z
tags: ["poker", "range-reader", "machine learning", "dataset"]
---

_Part 8 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Machine learning starts with a dataset

Part 7 left the solver half-blind. It plays the hand well, then deals the opponents their cards at random. The range is a guess, and every value built on it inherits the error.

We want to learn the range instead. A model learns from data, so the data comes first.

Karpathy teaches on tinyshakespeare, a megabyte of the plays in one file ([char-rnn](https://github.com/karpathy/char-rnn)). The corpus stays dumb on purpose, so the pipeline around it can prove itself: wired end-to-end on data you cannot botch, watched until it overfits a batch of two, then scaled ([the recipe](http://karpathy.github.io/2019/04/25/recipe/)). Don't be a hero.

So the first dataset here is rough by design. It proves the plumbing. Nothing more.

## What one example is

Each example is an input and a label. The input is the public action - every seat, every bet, in order. The label is the two hole cards it was hiding.

The model learns P(hand | betting): a probability for each of the 1,326 possible hands, given the betting.

The solver from Part 7 is unchanged. It still solves for a strategy no counter can beat. A sharper prior - the starting guess over the opponent's hands - gives it a truer range than uniform-random. The input gets better, and the play stays unexploitable.

## v0.1: let the arena deal

The arena is the dealer, and it already writes what it deals ([rs-poker](https://github.com/elliottneilclark/rs-poker)). Seat the agents, press go, read the file.

Every hand comes out as [Open Hand History](https://hh-specs.handhistory.org/), the standard JSON format for a poker hand. A real hand history shows cards only at showdown. The arena sees every seat, so it writes every hole card - folded, mucked, or shown. The label is free, and it is on all of them.

The field is the one from Part 3. `RandomPotControl` is the recreational player, the fish, betting without a plan. Three CFR agents each wear a different preflop chart - which hands to play from each seat - lifted from online solves: `Pekarstas-6max-RFI`, `GTO-Experiment`, and `6Max-RFI-GTO`. One more, `CFR-Configurable`, runs no chart at all, just a real-time budget. Tables run two to six seats in an even split, so position and player count both move.

The result is public: [`otter-crew/range-reader-v0.1`](https://huggingface.co/datasets/otter-crew/range-reader-v0.1) on Hugging Face. 613,399 hands, 1.42 GB, one JSON hand per line.

## What v0.1 gets wrong

The play over-shoves. One hand in six goes all-in. More than half never leave preflop. The agents trusted a read they had not earned.

They carried the crude estimator from Part 7 - opponents dealt uniformly at random - and committed as if the guess were fact.

There is a way to hold a real range without a neural net. Libratus ([Brown & Sandholm, 2018](https://www.science.org/doi/10.1126/science.aao1733)) and Pluribus ([Brown & Sandholm, 2019](https://www.science.org/doi/10.1126/science.aay2400)) reason over a precomputed _blueprint_: an MCCFR strategy ([Lanctot et al., 2009](https://proceedings.neurips.cc/paper_files/paper/2009/hash/00411460f7c92d2124a67ea0f4cb5f85-Abstract.html)) - Monte Carlo CFR - solved from self-play over an abstraction of the game, a shrunk and clustered copy of it. The blueprint gives every hand a probability, so a solver reading it holds a real range at any node instead of a point guess.

v0.1 has none of that. So the data leans loose and shove-happy. A known bias, written down.

That buys a working pipeline. The ranges get better from here.

## Next time

Part 9 is the model. Predicting hole cards from betting is a translation problem: read one sequence, emit another you can read.
