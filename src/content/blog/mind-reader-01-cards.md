---
title: "The Mind Reader, Part 1: A Deck of Cards Is a u64"
description: "Ten years of representing cards, hands, and decks in Rust - from Vec<Card> to bitsets, and why representation sets your speed ceiling"
pubDate: 2026-07-21
tags: ["poker", "rust", "performance"]
---

_Part 1 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## The choice under everything

The end of this series is a model that watches you bet and names your two cards.

Training takes hands by the million, each one labeled with what was really held. No such dataset exists, so the hands get dealt here.

Dealing them means agents playing each other, and agents need an arena with the full rules. The agents worth learning from have to rank hands and solve while they play.

So the work runs backward from the goal: cards, evaluator, arena, agents, dataset, model.

Every layer does the same small things. Deal a card. Ask whether a card is taken. Ask what overlaps the board. Copy a game state. Enumerate what is still to come.

Part 7's solver iterates at the root of one decision, and every iteration branches down the tree, trying each legal action. The game state is copied all the way down, the evaluator runs at the bottom, and the whole thing is on a millisecond deadline.

Those five run billions of times, and their cost depends on what a card is and how a pile of cards is stored.

So the core comes first, and the smallest thing in it is a card.

## The obvious card

All of this is Rust, and the whole library is a trade between three things: CPU time, bytes in memory, and code that is pleasant to call. Most of what follows is picking one of the three over the other two.

```rust
pub enum Value { Two = 0, Three = 1, /* ... */ Ace = 12 }
pub enum Suit { Spade = 0, Club = 1, Heart = 2, Diamond = 3 }

pub struct Card {
    pub value: Value,
    pub suit: Suit,
}
```

That is what anyone writes first, and it is fine. A Rust enum is an integer with names on it, so it costs nothing at runtime, and the compiler checks the matches for you.

`Value` counts up from two, so the discriminant - the integer behind each variant - is the ordering, and `Ord` comes from the derive.

`Suit` derives `Ord` too, and that ordering means nothing, because poker does not rank suits. It is there so a hand can be sorted for display.

A `Card` is two named fields, two bytes, `Copy` everywhere, and easy to read at a call site. Ten years on, it has not changed.

What has changed is that a card also converts to a number.

```rust
impl From<Card> for u8 {
    fn from(card: Card) -> Self {
        u8::from(card.suit) * 13 + u8::from(card.value)
    }
}
```

The struct keeps its two named fields; the number is a conversion off them. `suit * 13 + value` maps the fifty-two onto `0..52` and puts each suit in thirteen slots in a row, which is why a suit is a mask later.

One card was easy.

## A hand is a set

Now that we have cards, we need somewhere to keep them, for the players and for the board, the cards everyone shares.

Hands grow street by street - one betting round at a time - and a vector grows, so the first design made a hand a `Vec<Card>`.

But every question the engine asks is a set question: is this card taken, what overlaps the board, what is left to come. Order matters to the deal, and the hand has already forgotten it.

A vector answers those badly, because `contains` is a scan, dedup is a sort, union allocates, and every clone is a malloc, while a solver clones all day.

Measure the cheapest one, probing all fifty-two cards against a seven-card hand.

```text
Vec<Card> contains 52 probes of 7 cards.
                        time:   [306.11 ns 348.97 ns 400.11 ns]
CardBitSet contains 52 probes of 7 cards.
                        time:   [200.22 ns 215.09 ns 228.99 ns]
```

That is 6.7 ns against 4.1, and the bitset wins by 1.6x on the vector's best day, scanning seven bytes that sit together and stay hot in cache. On union, dedup, and every clone, the vector allocates, and the bitset does not.

So storage is a set.

## A deck of cards is a u64

Write down what the storage has to do. Say whether a card is in it. Add one. Remove one. Intersect and union with another set. None of it is allocated.

It also has to be small. A six-handed game carries six hands and a deck, and the solver copies all of it every time it branches, so every byte is multiplied by the number of players and again by the number of copies.

Fifty-two cards, and a `u64` has sixty-four bits, so give every card a bit.

That is `CardBitSet`. Bit _n_ set means card _n_ is in the set, and _n_ is the `suit * 13 + value` from a page ago. Twelve bits go unused, and nobody misses them.

```rust
pub struct CardBitSet {
    cards: u64,
}
```

Insert is `|=`. Remove is `&=` `!`. Membership is a shift and a mask. Counting is `count_ones`, which is `POPCNT`. Union and intersection are one instruction each, on the whole set at once.

The layout from the last section pays off here too. `suit * 13 + value` gives each suit thirteen bits in a row, so a suit is one contiguous field. Shift it down, mask off thirteen bits, count: `((cards >> (13 * suit)) & 0x1FFF).count_ones()`.

That is how many hearts are in the set, and five or more is a flush. Part 2's evaluator counts flushes another way, but it has the same layout underneath.

Now the useful part. A player's hand and the deck are both sets of cards, the same fifty-two slots with different ones filled, so they are the same type.

```rust
pub struct Hand(CardBitSet);
pub struct Deck(CardBitSet);
```

The board does not get a bitset. A community card is dealt into every player's hand, so by showdown each hand holds seven cards and ranks as one thing.

Building the deck is set algebra. Start with all fifty-two `(1 << 52) - 1`, then take out what is already visible.

```rust
let mut d = CardBitSet::default();
for hand in game_state.hands.iter() {
    d &= !CardBitSet::from(*hand);
}
```

Dealing is the same shape, one card at a time. Clear the bit in the deck; set it in the hand.

```rust
deck.remove(card);
game_state.hands[idx].insert(card);
```

Two instructions, and the deck never needs a discard pile; the bits still set are the cards still available.

This raises the only hard question in the whole file: where does the card come from?

### Dealing a random card

You hold two cards, and the flop is down, so five are gone, and `count_ones` says forty-seven are left.

Now, deal one of them uniformly.

The naive way is rejection sampling. Roll a number from 0 to 51, look at that bit, and take the card if the bit is set. If the card is already out, throw the roll away and go again.

It is correct and four lines. Every remaining card is equally likely because every dead roll is discarded without favoring anybody.

What it does not have is a fixed cost. With forty-seven left, you miss about one roll in ten. With one card left, you miss fifty-one times in fifty-two. On paper, dealing a full deck costs about 236 rolls to place 52 cards, and the worst case has no bound at all.

The rolls are the expensive part. An RNG call costs more than the bit work around it, and the retry branch is unpredictable, so the CPU guesses wrong more often as the deck gets thinner.

So roll inside the count instead. Take n from 0 to 46 and deal the n-th card still in the deck. One roll, always, and no branch.

That trades the problem rather than settling it. You now hold an index into the remaining cards, and what you need is a position in the word. The deck is full of holes where the dealt cards were, so the n-th card left is not bit n.

The naive fix is another loop. Walk the word from the bottom, count set bits, stop at n. It is bounded at fifty-two, which beats unbounded, but it is still a loop with a data-dependent exit inside every deal.

What we want is a lookup. Hand something the deck and the number n, get back the position of the n-th card still in it, in constant time.

x86 has had that in silicon since 2013, and hardly anyone uses it. The instruction is [`PDEP`](https://www.felixcloutier.com/x86/pdep) (parallel bit deposit), one of the BMI2 additions that shipped with Haswell. Chess engines generate sliding-piece moves with it, and graphics code builds Morton codes with it. Outside those two trades, it mostly sits idle.

Here is what it does. It keeps two cursors. One walks the mask and the destination together, from bit 0 up, and it moves on every step. The other walks the source, and it moves only when the mask bit under the first cursor is set.

At each step, it looks at the mask. A 0 means the destination bit stays 0 and the source cursor does not move. A 1 means the destination bit takes whatever the source cursor points at, and then the source cursor advances by one.

That is all the instruction does, and the software fallback in the file spells it out.

```rust
fn pdep_fallback(mut val: u64, mut mask: u64) -> u64 {
    let mut result = 0u64;
    while mask != 0 {
        let lowest = mask & mask.wrapping_neg();
        if val & 1 != 0 {
            result |= lowest;
        }
        val >>= 1;
        mask &= mask - 1;
    }
    result
}
```

`mask & mask.wrapping_neg()` isolates the lowest set bit, and `mask &= mask - 1` clears it, so the loop visits the set bits of the mask from the bottom up. `val >>= 1` is the source cursor, and it moves once per visit. The hardware does the same thing without the loop.

Now run it with the deck as the mask. The set bits of the deck are the only places the destination can ever get a bit, and the source cursor advances once per remaining card. Make the source `1 << n` and the source cursor reads a 1 at exactly one moment: when it has already passed n cards.

The deck holds cards at bits 1, 3, 7, 9, 12, and we want the third, so the source is `1 << 2`.

```text
mask bit    source read    destination
 1          src[0] = 0     .
 3          src[1] = 0     .
 7          src[2] = 1     bit 7
 9          src[3] = 0     .
12          src[4] = 0     .
```

Every other bit position has a 0 in the mask, so it is skipped and stays 0.

```text
deck    0b1_0010_1000_1010
1 << 2  0b0_0000_0000_0100
pdep    0b0_0000_1000_0000
```

One bit comes back, and it sits on the card you asked for, so read its position off the bottom with trailing zeros.

```rust
fn nth_set_bit(&self, n: u32) -> u32 {
    pdep(1u64 << n, self.cards).trailing_zeros()
}
```

Rust exposes the instruction as [`_pdep_u64`](https://doc.rust-lang.org/core/arch/x86_64/fn._pdep_u64.html), and `pdep` here is a thin wrapper over it.

`PDEP` and `TZCNT`, two instructions, no branch. The deal is uniform because the roll is uniform and the map from index to card is one-to-one. There is a chi-squared test in the file that checks it anyway.

### Enumerating what is left

Dealing gives one card. The other job wants all of them.

Take the cards nobody has seen and walk every subset of size N. Two at a time gives every hand an opponent could be holding, and it also gives every turn and river that could still fall. Larger N gives every way the unseen cards could be split across the seats still in the pot.

The counts are not small. Your two cards and a flop leave forty-seven unseen, which is 1,081 hands one opponent could hold. Deal a second player in, and 990 turn-and-river pairs remain.

Equity numbers (a hand's odds of winning), out counts, and the solver's leaf scores all come from that walk. The solver runs it every time it stops recursing and plays the hand to showdown.

The naive way is to copy the unseen cards into a list and iterate over the indices with nested loops. That allocates, and the loop nest has to be rewritten every time N changes.

Say it in bits instead. A subset of N cards is a word with N bits set, so enumerating subsets means walking every word of that population count, in order. Enumeration becomes counting, with one rule added: the number of set bits never changes.

That reduces the entire job to a single function. Give it a word with N bits set and get back the next larger word with N bits set. Call it until you run off the end and you have visited every subset once, in order, with no list and no recursion.

The function is old: item 175 of HAKMEM, a 1972 memo out of the MIT AI Lab, known as Gosper's hack after Bill Gosper, who wrote it down.

The rule by hand: find the lowest run of adjacent set bits, move the top bit of that run up one position, and pack the rest of the run down at the bottom of the word.

```text
00111 -> 01011 -> 01101 -> 01110 -> 10011
```

Four operations do it.

```rust
let t = combo | (combo - 1);
let next = (t + 1) | ((((!t) & (t + 1)) - 1) >> (combo.trailing_zeros() + 1));
```

Follow one step with two bits set at positions 2 and 3.

```text
combo       0b01100    set at 2 and 3
combo - 1   0b01011    borrows from the lowest set bit
t           0b01111    the OR smears it into a solid block
t + 1       0b10000    the carry clears the block and sets bit 4
!t & (t+1)  0b10000    isolate the bit that carried out
       - 1  0b01111    a run as wide as the block that got cleared
  >> 2 + 1  0b00001    cut down to the bits that still need a home
next        0b10001    bit 4 and bit 0
```

`combo - 1` borrows down through the trailing zeros, and the OR turns the lowest run and everything under it into one solid block. Adding one carries through that block, clearing it and setting the bit above; that bit is the one that moved up. The rest of the line counts how many bits were cleared, keeps the ones still owed a position, and drops them at the bottom.

Now use it on a deck. Gosper counts over 0, 1, 2, and up, a dense range with no gaps, and the deck is full of gaps. So `combo` names slots rather than cards: the first, the third, the fourth, or whatever is left.

`PDEP` turns slots into cards; the same instruction does the same job it did in the deal.

```text
deck   cards at bits 1, 5, 8, 12, 20
combo  0b0_1010    slots 1 and 3
pdep   bits 5 and 12
```

The entire iterator is three `u64` fields and a bool, with nothing allocated, no index array, and no recursion. Part 2 runs it over every runout and treats it as free.

Cards, hands, and decks are integers now, and they never allocate. The rest of the game state is not so lucky.

## The list-shaped things: smallvec

The board arrives flop, turn, river, and stacks and bets are per seat. Those are lists, and a list can live inline.

```rust
pub type PlayerVec<T> = SmallVec<[T; MAX_PLAYERS]>; // 16
pub type BoardVec = SmallVec<[Card; 5]>;
```

Sixteen is the capacity of `PlayerBitSet`, a `u16`, and five is the size of a hold'em board, so neither can overflow because the rules will not let them.

That makes a `GameState` one flat block of bytes, down through every `Hand` in it to the `CardBitSet` to the `u64`, with nothing pointing anywhere and a clone that is a memcpy.

Part 7's solver copies one at every branch, and a malloc in that loop spends the clock on allocation instead of on solving.

One rule: the hot loop never touches the heap.

## Next time

Every copy in that loop exists so a hand can be ranked at the bottom. Next is the best five cards out of seven, and how fast we can find them. Part 2 is the evaluator.
