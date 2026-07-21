---
title: "The Range Reader, Part 11: Did It Learn to Read Minds?"
description: "Measuring the model - mean reciprocal rank, the random floor, the read sharpening street by street, and why the data sets the ceiling"
pubDate: 2026-08-10
draft: true
tags: ["poker", "range-reader", "machine learning", "evaluation"]
---

_Part 11 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## One number, not accuracy

- There are 1,326 possible hands. "Right or wrong" is almost always wrong, and tells you nothing.
- So score by rank. Sort all 1,326 by probability. Take one over the true hand's rank.
- Rank the truth first and it scores 1.0. Rank it tenth, 0.1. Hundredth, 0.01. That is mean reciprocal rank.
- One number, `val/mrr`, decides keep or discard. It rewards pushing the truth toward the top.

## Know the floor

- A blind guess sets the bar. Uniform over 1,326 scores mrr 0.0059, mean rank 663.5.
- We print the floor beside every result. It keeps us honest.
- The model reads at about 0.017 - three times the floor.
- It pulls the true hand from 664th to 324th. It lands in the top 64 one hand in six. From betting alone.

## The scorecard

- One 35-minute run, one GPU. Best checkpoint by `val/mrr`, scored on held-out hands - ones it never trained on.
- Split by how far the villain got before folding:

```text
last street live   samples   top64   mean_rank      mrr
preflop-fold         14594   0.114       374.5   0.0123
flop-fold            18896   0.127       323.1   0.0142
turn-fold            16269   0.118       337.5   0.0125
river-fold           12856   0.126       340.8   0.0132
showdown             89684   0.179       313.3   0.0205
TOTAL               152299   0.156       324.1   0.0175

random floor                             663.5   0.0059
```

- Showdown hands read best. They commit the most chips.
- A fold ends the signal early, so folders read worse. Every bucket clears the floor - 2x at worst, 3.5x at showdown.

## The read sharpens

- Follow the same showdown hands across the streets. More betting, better read.

```text
read after    mean_rank      mrr
flop              346.4   0.0176
turn              305.9   0.0214
river             313.3   0.0210
showdown          302.7   0.0216

random floor      663.5   0.0059
```

- mrr climbs from 0.0176 after the flop to 0.0216 by showdown.
- Mean rank falls from 346 to 303. Most of the gain is in by the turn.
- The model reads better the more you commit. That is Part 9's design paying off.

## The ceiling is the data

- This is not state of the art. It can't be, not yet.
- The training hands come from sub-optimal agents (Part 8) - a fish and coarse-chart solvers that over-shove.
- The model learns to read those players well. It can't learn a read the data never shows.
- Proving the architecture was the goal. It holds. The score climbs only when the data does.
- State-of-the-art reads need state-of-the-art games. That takes a real MCCFR engine, solving preflop and postflop.
- Building that engine is the next job. The reader is ready for the games that engine will deal.

## Closing the loop

- The learned range feeds back into the solver.
- It replaces the CFR agent's uniform-random guess (Part 7) with a real prior over hands - a learned starting distribution.
- That is the whole story. Bits, a simulator, regret, and a model that reads.

## Next time

- Part 12: where this goes next, and the parts that stay closed.
