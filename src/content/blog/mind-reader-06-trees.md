---
title: "The Mind Reader, Part 6: Trees in Rust Without Tears"
description: "CFR needs a huge self-referential, multi-threaded game tree - the memory-arena design behind CFRState"
pubDate: 2026-07-28
tags: ["poker", "mind-reader", "rust", "performance"]
---

_Part 6 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Rust's famous weakness meets poker's biggest data structure

- Linked structures are hard in Rust. Parent pointers. Shared mutation. Self-reference.
- A CFR tree is all three. Millions of nodes. Each points up at its parent and down at its children. Many threads touch it at once.
- Stop fighting the borrow checker. See what the tree is.

## Why the obvious designs lose

- `Box<Node>` children give single ownership, so no parent pointers. Dropping a deep tree recurses.
- `Rc<RefCell<Node>>` panics at runtime, and it isn't `Send`. No threads.
- One lock around the tree makes every thread wait on every other.
- All three make the same mistake. They give each node its own life. A node has no life outside its game.

## One game, one owner

- The tree is one solve of one game. The nodes are born together and die together. Give them one owner, the arena.
- The arena owns every node. Everything else holds a `u32` index.
- Indices are `Copy`. They have no lifetime. They can't dangle - the arena outlives them all.
- The parent is just another index. Nothing borrows, so the borrow checker has nothing to say.

## The node, byte by byte

- `NodeData` has four variants. `Root`, `Chance` with one child per card, `Player` with its regret matcher, and `Terminal` with the utility.
- The parent is `Option<NonZeroU32>`, stored as index + 1. Four bytes where `Option<usize>` is sixteen.
- Children are `[AtomicU32; 52]`. Zero means no child. _n_ means node _n_ - 1. Reading a child is one atomic load.
- Node data sits behind its own `RwLock`. Locks are per-node, never per-tree. A test holds the node under 264 bytes.

## An arena that never moves a node

- The arena is chunked and append-only. 1,024 nodes per chunk. A chunk never reallocates. A written node has a stable address forever.
- Stable addresses buy lock-free reads. `get()` is an atomic length check and pointer math.
- New nodes serialize on one mutex. Linking a child is a compare-exchange. Two threads race, the first wins, the loser takes the winner's index.
- The tree grows lazily as the solver explores. Threads on different branches never touch.
- It holds ~268 million nodes. A 2 MB pointer table finds them.

## Drop is one free

- Dropping a `Box`-per-node tree walks millions of allocations. Dropping the arena frees a few thousand slabs.
- That makes the loop viable. Solve, act, drop the tree, next hand.
- `CFRState` is an `Arc` around the arena and the starting game state. Cloning the handle is free. Every thread solving the hand shares one tree.

## Next time

- Part 7 puts little-sorry inside this tree. An agent that solves while it plays, on a budget.
