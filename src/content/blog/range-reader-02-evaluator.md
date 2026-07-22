---
title: "The Range Reader, Part 2: Ranking Hands at Ludicrous Speed"
description: "The perfect-hash hand evaluator - how rs-poker ranks poker hands in less than a nanosecond"
pubDate: 2026-07-22T10:00:00Z
tags: ["poker", "algorithm", "performance"]
---

_Part 2 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Simulations explode; the leaves are all the same

Every simulation is a recursive what-if. Forty-seven turn cards, forty-six rivers under each, and 1,081 hands the villain - the opponent - could hold. Millions of branches go by before one interesting question gets asked.

All of them bottom out in the same computation: take the best five cards out of seven and compare them.

The evaluator is the most-called function in the system. Fast-forwarding a hand to showdown, the solver spends 88% of its time inside `rank()`. Its speed is the system's speed.

## What a ranking has to be

One number, bigger wins. The caller wants `a > b` in one instruction.

Tie-breaking runs deep. Kings and nines against kings and nines come down to the fifth card. One pair carries three kickers - the unpaired side cards that break the tie. High card carries four. The sixth and seventh cards must not matter.

C(52,5) = 2,598,960. Five-card deals collapse to 7,462 values. Suits matter only when five of them make a flush, and order never matters. Kevin Suffecool counted them out two decades ago and published the table. Every fast evaluator since then is built on his number.

The count comes apart by category.

| Category        |     Count | How it is counted (13 ranks)       |
| :-------------- | --------: | :--------------------------------- |
| Straight flush  |        10 | one per high card, wheel up to ace |
| Four of a kind  |       156 | 13 quad ranks x 12 kickers         |
| Full house      |       156 | 13 trips ranks x 12 pair ranks     |
| Flush           |     1,277 | C(13,5) patterns - 10 straights    |
| Straight        |        10 | the same 10 high cards             |
| Three of a kind |       858 | 13 trips ranks x C(12,2) kickers   |
| Two pair        |       858 | C(13,2) pairs x 11 kickers         |
| One pair        |     2,860 | 13 pair ranks x C(12,3) kickers    |
| High card       |     1,277 | the same 1,277 patterns, off-suit  |
| **Total**       | **7,462** |                                    |

Flush and high card share the same 1,277 patterns, and the two straights share their 10. The difference between each pair is whether the five cards are of one suit, and that is everywhere suits matter.

It fits in thirteen bits. [rs-poker](https://github.com/elliottneilclark/rs-poker) spends sixteen and packs `(category << 12) | subrank`: hand class in the high nibble (its top four bits), one through nine, tiebreak in the twelve bits below. The class sits on top, so integer comparison is a poker comparison. `Rank` wraps that `u16` and holds nothing else.

## Count, then branch

Start from what the rules say. Count how many cards of each rank and how many of each suit. Five of a suit is a flush, four of a rank is quads, three and a two is a full house, and so on down. Take the first thing that matches, then fill in the kickers from what is left. Seven cards change nothing; count all seven, and the best five fall out of the same count.

Tuned hard, that lands at eleven nanoseconds for a seven-card hand, and it stops there. Two costs are built into the shape: each call rebuilds the state it already had, then walks the ladder to the bottom.

## The board barely changes

At a six-player showdown, all six hands share five board cards. Five sevenths of every evaluation is the same work, redone six times.

Enumeration is worse. Equity - a hand's odds of winning - on a flop is 990 turn-and-river runouts, and each one refolds five constant cards to vary two.

So tally the shared cards once, then copy that tally and add the cards that differ. That kills the first cost and leaves the second. The tally is five arrays, so a copy is five arrays, and the ladder still runs to the bottom on all 990 runouts.

Both have to get cheap: the tally small enough to copy in one move, and the finish free of branches.

## Rank is two array loads

Those two requirements point to one shape. Copying in a single move means the state must be a couple of machine words, and finishing without a branch means those words have to work as an index, with the answer already sitting in a table.

So decide what a card contributes before the program runs. Two tables, fifty-two entries each, were generated at build time. `CARDS_KEY` holds a card's contribution to the arithmetic, and `CARDS_MASK` holds the card's own bit. Dealing is reading two entries and folding them in, and neither fold cares what order the cards arrived in, so a hand is just the sum of its cards. A copy is two words.

Those two words answer different questions.

`key` carries two accumulators that never interfere. The low 32 bits fingerprint the rank histogram, which is how many deuces, how many threes, on up through aces, with suits thrown away. The high 16 bits count how many cards of each suit came in. The first is the entire answer when nothing is suited, and the second decides whether that is the case.

`mask` records which exact cards are present, and it is Part 1's bitset unchanged: bit _n_ set means card _n_ is here. It earns its keep only on a flush, when the counters say five of a suit arrived and that suit's thirteen ranks have to be read back somewhere.

```rust
key = key.wrapping_add(CARDS_KEY[i]);
mask |= CARDS_MASK[i];
```

That is all of the dealing. The rest is making each field pay off.

Take the fingerprint first. Each rank owns a magic 32-bit multiplier, and the fingerprint is the wrapping sum of the multiplier times the count. You cannot read the counts back out, and you do not need to. The same histogram always yields the same number, and no two histograms ever collide. The build proves this by enumerating all reachable histograms and verifying that the keys are distinct.

Now the counters. Four 4-bit fields share the high sixteen bits, one per suit, and each starts pre-loaded with three.

```text
  cards of suit:  0    1    2    3    4    5    6    7
  nibble       : 0011 0100 0101 0110 0111 1000 1001 1010
                                          ^ the 0x8 bit flips at five
```

Three plus five is eight, so the top bit of a nibble sets at exactly five cards of a suit. One AND against `0x8888 << 48` says whether a flush exists and which suit made it. The bias also keeps the counter within four bits: seven of a suit reach ten and stop.

That leaves scoring, and both fields finish the same way. Turn what you hold into an integer, use that integer to index a table of `u16` scores, and return what comes back. Both tables hold the same thing the whole post has been building toward, `(category << 12) | subrank`, sorted and comparable the moment it lands.

What separates them is how crowded the index space is.

A flush is settled by thirteen bits, the rank pattern of the suited cards. Thirteen bits are 8,192 possibilities, and every one of them is a question worth asking, so the table has 8,192 entries, and the pattern is its own index. There is no arithmetic between having the pattern and having the score.

A hand without a flush is settled by the fingerprint, and the fingerprint is sparse. Roughly seven thousand live values are scattered across 25 bits. A flat array over that range is 64 MiB to hold seven thousand answers, so the fingerprint has to be squeezed into something cache-sized first. That costs one extra load: fetch the displacement belonging to the key's row, add it, and then take the same load a flush would have taken.

```rust
let offset = ROW_OFFSETS[rank_key >> ROW_SHIFT];
LOOKUP[rank_key + offset]
```

One load for a flush, two for everything else, and 64 MiB squeezed to 256 KiB. How the squeezing works is in the next section.

The lookup lands on the score on the first try, with no probe and nothing to resolve. The bounds check goes too, since every table is a power of two long and every index is masked to fit, which leaves the compiler nothing to prove. The card tables run 64 wide for the same reason; slots 52 through 63 are left at zero. There is no `unsafe` in the evaluator.

Both halves came cheap. `SevenCardAccum` is the `(key, mask)` pair and nothing else, sixteen bytes against fifty-six for a tally of arrays, asserted at compile time so the number in the docs cannot drift. Adding a card costs an add and an OR, and ranking one costs a test and a load. Tally the board once, then for each player or each runout, copy it, add two cards, and rank.

Almost none of this is ours. The whole scheme - additive multipliers, biased suit counters, a perfect hash over the fingerprint - comes from OMPEval, a C++ hand evaluator and equity calculator for hold'em published in 2016 by a developer who goes by zekyll.

Its contribution was size. The fast evaluators of the day answered a hand with one enormous table; OMPEval got the same answers out of 200 kB by hashing the key instead of indexing it. The thirteen multipliers are older still: zekyll took them from Kenneth Shackleton's SKPokerEval, a seven-card evaluator, which traces back to Suffecool's five-card work. Hand-picked constants, handed down twice.

The port changed one thing: OMPEval indexes a card as `4*rank + suit`, and [rs-poker](https://docs.rs/rs_poker/latest/rs_poker/) keeps Part 1's `suit*13 + value` instead, so each suit stays a contiguous thirteen-bit block and the deck arithmetic from Part 1 keeps working.

## build.rs is the compiler

The tables come from `build.rs`. The combinatorial work happens once, at build time, and ships as flat arrays in the binary.

The script enumerates every reachable histogram, every rank from zero to four, and every hand from zero to seven cards. It classifies each one with the same ladder, from quad down to high card. Seven cards make that ladder longer than a five-card one. Hold two trips, and you hold a full house, the higher set filling the trips slot and the lower playing as the pair. Five cards can never do that.

Classification hands back an ordering number full of gaps, so the script densifies. Inside each category, sort the distinct payloads and hand out subranks 1, 2, 3. Two histograms that make the same best five cards share a payload, so they share a subrank.

Then it packs the keys, which are the 64 MiB problem from the last section. The tool is first-fit row displacement, the same trick compilers use to pack parser tables, and it takes a few paragraphs to explain.

Split every key in two and it lands on a grid, row `key >> 12` and column `key & 0xFFF`. The grid is enormous and almost entirely empty, because seven thousand keys are spread over eight thousand rows of four thousand columns each.

Now flatten the grid into one array by sliding each row sideways until its occupied cells drop into holes the other rows left behind. Each row gets one number, its displacement, and a key's slot is `key + displacement_of_its_row`. Every key in a row shares the same high bits, so adding that one number shifts the entire row without changing the spacing inside it. One number per row, not one per key, and there are only eight thousand rows.

Finding the displacements is greedy. Sort the rows by how many keys they hold, densest first, because a crowded row needs a run of free slots and the table only gets more crowded as you go. For each row, try displacement 0, then 1, then 2, and take the first one where none of that row's keys land on a slot already spoken for. Mark those slots taken and move on.

Shrink the numbers to see it. Say rows are eight wide, the flat table has eight slots, and six keys need homes:

```text
row 0   keys  0,  2,  5      columns 0, 2, 5
row 1   keys  8, 11          columns 0, 3
row 2   key  18              column  2
```

Row 0 is densest, so it goes first at displacement 0, taking slots 0, 2, and 5. Row 1 wants slots 0 and 3; slot 0 is gone, so displacement 1 puts it at 1 and 4. Row 2 wants slot 2, which is gone, so displacement 1 puts it at 3. Six keys, eight slots, nothing overlapping:

```text
slot   0   1   2   3   4   5   6   7
key    0   8   2  18  11   5   -   -
```

Looking up key 11 is now arithmetic. Its row is `11 >> 3 = 1`; that row's displacement is 1, and slot `11 + 1 = 4` holds the score for key 11. No comparison and no search.

The real table uses the same two lines with bigger numbers: 8,192 rows, 4,096 columns, and 131,072 slots holding every one of the seven thousand answers. That is the 64 MiB down to 256 KiB.

Empty slots stay zero, and zero is not a legal score: category one is a high card. A lookup that lands where it should not returns a number no hand can have, which is a failure you can see.

Three asserts run before anything is emitted. The fingerprints have to be distinct, each key has to read its own score back, and the finished tables have to yield exactly 7,462 classes when counted both ways, histograms and flush patterns. A wrong constant fails to compile, so a broken table cannot ship.

The counting evaluator has one job left, and being slow and plainly right is what qualifies it: it is the oracle. It sits in `rank.rs` under `mod oracle`, compiled only for tests, never shipped, with the ladder rewritten to return a packed `u32` so the two rankers compare as plain integers.

It is the test for the table evaluator. All 2,598,960 five-card hands go through both, and the categories have to agree, while the map from one score to the other must be strictly monotonic, so the order holds across every last one. Then 200,000 random seven-card hands.

## The numbers

Ranking a pre-dealt seven-card hand is the flush test and a couple of loads.

```text
seven_card_accum_rank/high_card        time: [2.65 ns  2.94 ns  3.25 ns]
seven_card_accum_rank/one_pair         time: [859 ps   926 ps   990 ps]
seven_card_accum_rank/two_pair         time: [572 ps   591 ps   616 ps]
seven_card_accum_rank/three_of_a_kind  time: [538 ps   539 ps   541 ps]
seven_card_accum_rank/straight         time: [548 ps   553 ps   558 ps]
```

Most archetypes land under a nanosecond; the high card is the outlier at three.

Counting against table, same machine, same benches, `target-cpu=native`:

```text
                       counting      table
Rank one 5-card hand       7.42 ns   3.40 ns
Rank best 5 of 7 cards    11.02 ns   4.65 ns
```

Call it 2.4x.

Built from scratch, a seven-card hand costs about 2.8 nanoseconds. One that has already been tallied ranks in under a nanosecond, which is where the copy-and-extend path pays: two players and a flop, every one of the 990 runouts, both hands ranked at each, finish in under two microseconds; that is 0.9 nanoseconds per rank.

The tables cost about 305 KiB of read-only data in the binary: 256 for `LOOKUP`, 32 for `ROW_OFFSETS`, 16 for the flush table, one for the card keys. That is more than most L2 caches will hold. The flush table and the hot rows stay resident, while the rest sit there as a cache miss waiting for a hand nobody deals.

## Next time

We can deal fast and rank fast, so now the game itself: full no-limit hold'em, betting rounds, all-ins, side pots, and agents to play it. Part 3 builds the arena.
