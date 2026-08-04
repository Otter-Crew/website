---
title: "The Range Reader, Part 6: Trees in Rust Without Tears"
description: "CFR needs a huge self-referential, multi-threaded game tree - the memory-arena design behind CFRState"
pubDate: 2026-07-22T14:00:00Z
tags: ["poker", "rust", "performance"]
---

_Part 6 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## The biggest thing we have built

[Part 5](/blog/range-reader-05-little-sorry/) left us a regret matcher: a few arrays and one method. A solve needs millions of them arranged in a tree, and it needs them fast, because [Part 7](/blog/range-reader-07-cfr-agent/) puts the whole thing on a two-second clock.

Everything before this fit in a register. A card is a bit in a `u64`, a hand rank a `u16`, a `GameState` a flat block you copy with a memcpy. This is the first structure in the series that does not fit anywhere.

What it has to do is easy enough to write down. It holds millions of nodes, one per decision the solver has reached, each pointing down at up to fifty-two children and up at the parent that CFR will hand its value back to. It grows while it is being read, since the solver only allocates the branches it explores. Threads work it at once, on different branches, for the length of one hand. Then it dies, and the next hand starts.

Parent pointers, shared mutation, self-reference, and threads. Rust exists, in part, to stop you from writing that.

## The obvious tree

Start with what the compiler likes.

```rust
struct Node {
    data: NodeData,
    children: Vec<Option<Box<Node>>>,
}
```

A `Box` per child compiles on the first try and is wrong three ways.

Single ownership kills the parent pointer, because a `Box` has one owner and a child cannot own its parent back. You can pass the parent down the recursion and never store it, and that works right up until [Part 3](/blog/range-reader-03-arena/)'s historian, which does not recurse; it gets one event at a time and has to find its place in the tree from where it stood last.

Mutation is exclusive, so writing regret into one node means `&mut` on the root and `&mut` down every level to reach it, one writer holding the whole tree.

Dropping recurses, since every node is its own allocation, so freeing the root walks the tree and calls `free` a million times at the end of every hand.

## Rc, RefCell, and the runtime panic

The textbook fix is `Rc<RefCell<Node>>`. Shared ownership, interior mutability, `Weak` back-pointers to the parent. Every Rust tree tutorial ends here, and it buys the shape by selling the two things we need.

`RefCell` moves the borrow check to runtime, where the rule is the same - many readers or one writer - and only the punishment changes, from a compile error to a panic. CFR reads a node's strategy, recurses into the children, and comes back to write regret into the node it started at, so holding the read guard across that recursion panics the write. The compiler will not warn you. The fuzzer might, on a path where one node appears twice.

`Rc` is not `Send`, since its count is a plain integer, so the compiler refuses to move the tree to another thread. Swap in `Arc<RwLock<Node>>` and it moves, but now every child pointer carries an atomic refcount, and walking a node bumps a counter on a cache line every other thread is bumping too. You pay a bus transaction for the privilege of reading a pointer.

## One lock around everything

So put the nodes in a vector with one lock around it, which is simple and easy to get right.

Then count the reads. A wave of CFR clones the game state, forces an action, and plays the hand out, and every step of that playout is a child lookup: millions of them, a few nanoseconds of real work apiece, queued behind a lock that eight threads want.

Writes are worse, because appending a node takes the write lock and stops every reader on the tree, including the ones a thousand nodes away on a branch nobody else has touched. The tree grows the entire time it is being solved. There is no warmup phase to get past; the solver is still allocating nodes on the river.

The vector has a problem of its own underneath the lock. Push past capacity, and it reallocates, moving every node it holds and killing any reference into it; under a global lock, that is legal and merely slow, but it means nothing outside the lock can ever hold a node.

## One game, one owner

All three designs make the same mistake: they give each node its own life.

A node has no life outside its game. The tree is one solve of one hand, and its nodes are born together when the hand starts and die together when it ends. Nothing outlives what holds it.

So stop handing out ownership, and let one owner - the arena - hold every node while everything else holds a `u32`. Arena here is the allocator pattern, not Part 3's poker table.

An index is `Copy`, so it goes anywhere, and it has no lifetime, so it borrows nothing and the borrow checker has no opinion about it. It cannot dangle, because the arena outlives every index into it. A node storing its parent is a node storing a number, and a number can point at anything, including the thing pointing at it.

The idea is old and not ours: Niko Matsakis wrote it up for graphs in 2015 ([baby steps](https://smallcultfollowing.com/babysteps/blog/2015/04/06/modeling-graphs-in-rust-using-vector-indices/)), and most serious Rust graph code has worked this way since.

## The node, byte by byte

```rust
pub struct Node {
    pub idx: u32,
    data: RwLock<NodeData>,
    parent: Option<NonZeroU32>,
    parent_child_idx: Option<NonZeroU8>,
    children: [AtomicU32; 52],
}
```

`NodeData` has four variants. `Root`, created eagerly so every traversal has somewhere to start. `Chance`, the dealing of one card, with a child per card. `Player`, holding Part 5's regret matcher - PCFR+ here, a predictive-CFR variant - and the seat it belongs to. `Terminal`, holding the utility.

The lock sits on the node rather than the tree, so two threads on two branches take two different locks and never meet.

Then the sizes, because everything here is multiplied by millions. `Option<usize>` is sixteen bytes: eight for the index, one for the tag, seven thrown away to alignment. The tag is redundant, since no real node reaches its parent through slot zero, and `NonZeroU32` says so, which lets the compiler spend zero as the `None` tag. `Option<NonZeroU32>` comes to four bytes, and a test asserts it stays there.

The price is an encoding: store the parent as index + 1 and subtract one on the way out. The root is node zero and is its own parent, so its slot holds a 1. `parent_child_idx` takes the same deal in a single byte, since a child index runs 0 through 51.

The children pay it without the `Option`, as fifty-two `AtomicU32` where 0 is no child and _n_ is node _n_ - 1.

```rust
pub fn get_child(&self, idx: usize) -> Option<usize> {
    let val = self.children[idx].load(Ordering::Acquire);
    if val == 0 { None } else { Some((val - 1) as usize) }
}
```

That is one atomic load with no tag to unwrap and no pointer to chase. The array is 208 of the node's bytes, and a test holds the whole node under 264.

## One box, many ledgers

Look again at what a `Player` node carries.

```rust
pub struct PlayerData {
    pub regret_matcher: Option<Box<little_sorry::PcfrPlusRegretMatcher>>,
    pub player_idx: u8,
}
```

Part 5 is why it is a single pointer. A decision point holds a range, and every hand in the range needs its own row over the same three or four actions, so `BatchedMatcher` owns those rows together on one iteration clock and computes a discount factor once for the batch instead of once per row.

The tree collects that saving without knowing about it, storing a `Box` and a `u8`. Three ledgers or three hundred, the node is the same 264 bytes, and moving from the scalar matcher to a batched one changes one type in one struct.

The deeper fit is who is allowed to mutate. Part 5's scalar `update_regret` takes `&mut self`, so writing regret into a node takes that node's write lock, and two waves landing on the same node wait for each other. The batched matcher updates through `&self` on interior-mutable cells, with the `Atomic` backend making the lost updates benign in the Hogwild sense - racing writers lose a few updates, never the answer - so pointing the node at one of those turns the write lock into a read lock and retires the last serialization point on the hot path.

The arena and the matcher solve the same problem twice, moving ownership up a level - the arena owns the nodes, the matcher owns the rows - and putting mutation behind `&self` so that sharing costs nothing.

The memory follows the same seam. Part 5 buys RAM with precision, keeping regret in scaled `i16` and the strategy average in `u16`, and this tree is where that bill is paid.

## An arena that never moves a node

The arena is chunked and append-only, a thousand and twenty-four nodes to a chunk, boxed once at roughly a quarter megabyte and never touched again, so a written node keeps its address forever.

Compare that to growing a vector. Ten million nodes is twenty-odd doublings, and the last one asks the allocator for a five-gigabyte contiguous run, copies two and a half gigabytes into it while both blocks are live, and invalidates every reference anyone held. The arena copies nothing and asks for the same quarter megabyte every time, so a freed chunk is exactly the shape of the next request. Fragmentation that never varies costs nothing.

A table of raw pointers finds the chunks: 262,144 slots at eight bytes, two megabytes, enough for about 268 million nodes.

Stable addresses are what buy the lock-free read. `get` is an `Acquire` load of the length, a bounds check, a pointer out of the table, and a dereference.

```rust
let chunk_ptr = self.chunk_ptrs[idx / CHUNK_SIZE].load(Ordering::Acquire);
unsafe { &*chunk_ptr.add(idx % CHUNK_SIZE) }
```

That is the one `unsafe` in the design, and it comes with the argument written above it: reads only happen below `len`, which advances with `Release` after a node is fully written and after that node's chunk pointer has been published, and no chunk moves or is freed while the arena lives. [Part 2](/blog/range-reader-02-evaluator/)'s evaluator has no `unsafe` at all, so this one has to earn it and show its work.

Appends serialize on a single mutex. `push` takes the lock, reads the length inside it - reading it outside is two threads claiming one slot - allocates a chunk if the current one is full, writes the node, and stores the new length with `Release`. That store is the publication, and it is all or nothing: a reader sees the whole node or does not see it at all.

One mutex on every append sounds like the tree-wide lock we threw out, but it is held for one write, and no reader ever waits on it. A solver spends its time walking nodes that already exist, and every one of those steps is lock-free.

Linking the child happens outside the mutex, on the parent's atomic, by compare-exchange.

```rust
match self.arena.get(parent_idx).try_set_child(child_idx, idx) {
    Ok(()) => idx,
    Err(existing) => existing,
}
```

Two threads reach the same unexplored action together, both push a node, and both try to claim the slot. One wins, and the loser takes the winner's index and walks into it, leaving its own node in the arena with nothing pointing at it, 264 orphaned bytes. That is cheaper than the lock that would have prevented it, and rare, since threads on different branches never contend for a slot.

## The handle

```rust
pub struct CFRState {
    arena: Arc<NodeArena>,
    starting_game_state: Arc<GameState>,
    mapper_config: ActionIndexMapperConfig,
}
```

`CFRState` is an `Arc` around the arena and the state the hand started from, so cloning it is two refcount bumps and every thread solving the hand shares one tree.

Nothing in the API takes `&mut self`. Adding a node, reading a child, updating a matcher - all of it goes through `&self`, and the mutation lands under a per-node lock or inside one atomic. We never fought the borrow checker; we told it the truth about who owns what, and it lost interest.

## Next time

The tree holds still under threads, and now something has to walk it on a clock.

[Part 7](/blog/range-reader-07-cfr-agent/) seats little-sorry inside this arena: an agent that solves the hand while it plays it, with a budget in milliseconds, pruning the branches its own regret has already written off.
