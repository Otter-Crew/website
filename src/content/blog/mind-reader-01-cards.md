---
title: "The Mind Reader, Part 1: A Deck of Cards Is a u64"
description: "Ten years of representing cards, hands, and decks in Rust - from Vec<Card> to bitsets, and why representation sets your speed ceiling"
pubDate: 2026-07-21
tags: ["poker", "mind-reader", "rust", "performance"]
---

_Part 1 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Every hold'em game is the same question

- Every hold'em hand reduces to one computation. Given the board and the hands, which rank wins which pot?
- Betting sets the pot sizes. Cards decide who gets them.
- The simulator, the solver, and the neural net ask that question billions of times.
- So first we decide what a card is to the machine. That choice sets the speed ceiling for everything after.

## Rust enums are numbers with manners

- A Rust enum is an integer the compiler guards. Pattern matching and exhaustiveness checks come free. No runtime cost.
- `Value` runs `Two = 0` through `Ace = 12`. The discriminant is the ordering, so comparison comes from the derive.
- `Suit` is the four suits. Poker doesn't rank suits and neither does the type.
- A `Card` is a value and a suit, packed into one `u8`. 13 values x 4 suits = 52 codes. One byte, `Copy` everywhere.

## Why a hand isn't a vector of cards

- The original rs-poker design made a hand `Vec<Card>`. Hands grow street by street. A vector grows. It seemed right.
- But the engine asks set questions. Is this card taken? How many hearts? What overlaps the board? Order belongs to the deal, not the hand.
- `Vec<Card>` answers set questions badly. `contains` is a scan. Dedup is a sort. Union is an allocation. And every clone is a malloc.
- Measure it. From the rs-poker benches - probe all 52 cards against a 7-card hand, vector versus bitset:

```rust
fn contains_vec(c: &mut Criterion) {
    let d: FlatDeck = Deck::default().into();
    let hand: Vec<Card> = d.sample(7);
    let deck: Vec<Card> = Deck::default().into_iter().collect();
    c.bench_function("Vec<Card> contains, 52 probes of 7 cards", |b| {
        b.iter(|| {
            let mut hits = 0;
            for card in &deck {
                if hand.contains(black_box(card)) {
                    hits += 1;
                }
            }
            hits
        })
    });
}
// contains_bitset is identical, with `hand` a CardBitSet.
```

```text
Vec<Card> contains, 52 probes of 7 cards
                        time:   [306.11 ns 348.97 ns 400.11 ns]
CardBitSet contains, 52 probes of 7 cards
                        time:   [200.22 ns 215.09 ns 228.99 ns]
```

- That's ~6.7 ns against ~4.1 ns per probe. The bitset wins 1.6x at the vector's best operation.
- On union, intersection, and dedup the vector allocates. The bitset runs one instruction.

## A deck of cards is a u64

- `CardBitSet` is a 64-bit integer. Bit _n_ set means card _n_ is present. Fifty-two cards, twelve bits to spare.
- Insert is `OR`. Remove is `AND NOT`. Membership is shift-and-mask. "How many hearts?" is a mask and `popcount`.
- Union and intersection of whole hands are one instruction each.
- The full deck is `(1 << 52) - 1`. Dealing clears bits. What's left is the complement.
- Sampling a random remaining card uses `PDEP` to drop an index into the set bits in one instruction. A software fallback covers CPUs without it.

## Telling the compiler what decade it is

- By default Rust compiles for a 2003-era x86-64. The compiler won't emit `POPCNT` or `PDEP` it can't prove exist. Your one-instruction operations become loops.
- The fix is one line in `.cargo/config.toml`. `-C target-cpu=x86-64-v3` unlocks AVX2, BMI1/2, `popcnt`, `lzcnt`, `tzcnt`, `pdep`. The floor is Haswell, 2013.
- The flag is per-target. Apple Silicon is aarch64; its floor is `target-cpu=apple-m1`.
- The `pdep` call keeps a `#[cfg]`-gated fallback. Published crates run on machines you don't control.

## The list-shaped things: smallvec, not the heap

- Some things really are sequences. The board arrives flop-turn-river. Stacks and bets are per-seat.
- A list doesn't have to live on the heap. `GameState` uses `SmallVec` with inline capacity. `BoardVec` holds 5 cards inline and `PlayerVec<T>` holds a full table inline.
- Solvers clone `GameState` on every what-if. With inline storage a clone is a memcpy.
- The whole library obeys one rule. The hot loop never touches the heap.

## Next time

- Cards, hands, and decks are now a handful of integers.
- Next, the best five-card hand from seven, and how fast we can find it. Part 2 is the evaluator.
