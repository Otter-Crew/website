---
title: 'The Mind Reader, Part 2: Ranking Hands at Ludicrous Speed'
description: 'The perfect-hash hand evaluator - how rs-poker ranks poker hands 2.4x faster and shrank Rank from 8 bytes to 2'
pubDate: 2026-07-22
tags: ['poker', 'mind-reader', 'rust', 'performance']
---

*Part 2 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker.*

## Simulations explode; the leaves are all the same

- Every simulation is recursive what-if. 47 turn cards. 46 rivers each. 1,081 villain combos. Millions of branches before one interesting question gets asked.
- Every branch bottoms out in the same computation. Take the best five-card hand from seven and compare it.
- The evaluator is the most-called function in the system. Its speed is the system's speed.

## What a ranking has to be

- The output must be a single number where bigger wins. Callers want `a > b` in one instruction.
- Tie-breaking runs deep. Kings and nines against kings and nines comes down to the fifth card.
- One pair carries three kickers. High card carries four. The sixth and seventh cards must not matter.
- 2.6 million five-card deals collapse to exactly **7,462** distinct values. Suits matter only for flushes. Order never matters.
- That fits in 13 bits. rs-poker packs it as a `u16` - category in the high nibble, tiebreak below. Integer comparison is poker comparison.

## The original: recompute everything, every call

- The first version started from zero on every call. Slice the hand into four 13-bit suit masks. Scan for a flush.
- Derive pairs, trips, quads from set algebra. Walk the ladder from quads down to high card.
- It was clever all the same. The straight check is branch-free. `v & v<<1 & v<<2 & v<<3 & v<<4` leaves a bit only where five ranks run. The wheel is checked separately.
- Kickers are "clear low bits until *n* remain." No sort, no allocation, no table.
- It ran in tens of nanoseconds. For years that was plenty. It still lives in the codebase as the oracle.
- The new evaluator is checked against it - all 2.6M five-card hands, and hundreds of thousands of random 7-card hands.

## The observation: the board barely changes

- At a six-player showdown, all six hands share the same five board cards. Five-sevenths of every evaluation is the same work, redone six times.
- Enumeration is worse. Equity on a flop means 990 turn-and-river runouts. From-scratch evaluation refolds five constant cards 990 times to vary two.
- The fix is to make evaluation incremental. Tally the shared cards once. Copy the tally. Add the cards that differ.

## The perfect-hash version: rank = two array loads

- The state is two `u64`s. Dealing a card is two instructions with no branches. `key += CARDS_KEY[card]; mask |= CARDS_MASK[card]`.
- The low 32 bits of `key` accumulate a rank fingerprint. Each rank has a magic multiplier.
- The wrapping sum is unique per rank histogram - same ranks, same number; different ranks, no collision.
- The high 16 bits handle flushes. Four 4-bit suit counters start pre-loaded with 3. A counter hits 8 - binary `1000` - at five of a suit.
- One AND against `0x8888` finds the flush and its suit.
- Scoring is a lookup. On a flush, the suit's 13-bit pattern indexes an 8,192-entry table. Otherwise the fingerprint indexes a perfect hash.
- No probing, no collisions. Add an offset, load the score.
- The wrapper is `SevenCardAccum`, 16 bytes and `Copy`. Tally the board once. For each player or runout, copy it, add two cards, and rank.

## build.rs is the compiler

- The tables come from `build.rs`. All the combinatorial work happens at compile time and ships as flat arrays in the binary.
- The script enumerates every reachable rank histogram, classifies each with the same ladder as the old evaluator, and squashes tiebreaks into the 7,462 values.
- The perfect hash is built by first-fit row displacement - the technique compilers used to pack parser tables.
- The build asserts its own output. Every fingerprint is distinct. Every key reads its own score back. There are exactly 7,462 values.
- A wrong constant fails the compile. A broken table can't ship.

## The numbers

- Ranking a pre-tallied 7-card hand is sub-nanosecond. It's the flush test plus a couple of array loads:

```text
seven_card_accum_rank/high_card        time: [2.65 ns  2.94 ns  3.25 ns]
seven_card_accum_rank/one_pair         time: [859 ps   926 ps   990 ps]
seven_card_accum_rank/two_pair         time: [572 ps   591 ps   616 ps]
seven_card_accum_rank/three_of_a_kind  time: [538 ps   539 ps   541 ps]
seven_card_accum_rank/straight         time: [548 ps   553 ps   558 ps]
```

- From scratch - fold seven cards and rank - it's ~22 ns per hand, about 45 million hands per second per core:

```text
Rank 1024 random 7card hands           time: [21.6 us  23.0 us  24.3 us]
Oracle rank 1024 random 7card hands    time: [58.8 us  62.0 us  65.3 us]
Rank board enumeration turn+river      time: [14.8 us  15.3 us  15.9 us]
```

- The oracle takes ~61 ns on the same hands. The new path takes ~22.
- The comparison favors the oracle - it gets pre-built bitmasks, while the new path folds all seven cards itself.
- The third line matters most. Two players, a flop, all 990 runouts, both hands ranked at each one, in fifteen microseconds. The rest of the series treats that as free.
- In v5, `Rank` also shrank from 8 bytes to 2.

## Next time

- We can deal and rank fast. Now the game itself. Full no-limit hold'em, betting rounds, all-ins, side pots, and agents to play it. Part 3 builds the arena.
