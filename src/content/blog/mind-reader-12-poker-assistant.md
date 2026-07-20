---
title: "The Mind Reader, Part 12: What Comes Next"
description: "The series finale: the advanced versions of everything you just read - MCCFR blueprints, AIVAT, quantized regrets - live on in poker-assistant"
pubDate: 2026-08-11
tags: ["poker", "mind-reader", "GTO", "announcement"]
---

_Part 12 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Where the story goes from here

- Thirteen posts of open source built a bot that plays, solves, and reads.
- Part 11 named the next job. The reads only get better when the games do.
- Great games take a real solver. Monte Carlo CFR (MCCFR), preflop and postflop.
- That engine got built. It became a product.

## Introducing poker-assistant

- poker-assistant is a native desktop or tablet app for serious players.
- Inside it is `rsp` - a private fork of rs-poker, grown into a solver.
- A full multiway MCCFR engine. It solves the whole game.
- Preflop blueprints for 2-6 players. Postflop re-solves on demand.
- rsp is compiled into the app. Solves run on your machine, in-process, no server.
- What you get: per-action EV and EV-loss, equity, blockers (cards that rule out his hands), hand-history analysis, a trainer.

## A taste of what's inside

- Each of these could be its own post. Here they get a sentence.
- Full multiway MCCFR blueprints, down to 3.5 mbb/g exploitability. The real version of Part 7's rough preflop.
- Belief-conditioned re-solves. The solver guesses opponent ranges before it solves.
- AIVAT variance reduction (Burch et al., AAAI 2018). Trustworthy solves from far fewer hands.
- `u16` regret quantization. Part 5's math and Part 6's tree at a quarter the memory.
- Node-locking for maximally exploitative re-solves.
- Aggregate flop reports across the 1,755 canonical flops.

## Thank you

- Thank you for following all thirteen parts.
- Try the crates. Load the dataset. Star the repos if they helped.
- Curious about poker-assistant? Follow for the launch.
- Which deep-dive do you want next? Reply and tell me.
