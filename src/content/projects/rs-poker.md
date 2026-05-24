---
title: 'rs-poker'
summary: 'The most advanced open-source poker library in Rust: hand evaluation, equity, ICM, and a CFR solver. Version 5 adds multi-threaded CFR, a first in open source.'
year: 2026
status: 'active'
role: 'Author and maintainer'
link: 'https://github.com/elliottneilclark/rs-poker'
featured: true
order: 1
---

rs-poker is a Rust library for poker built for correctness and speed in equal
measure: hand evaluation at tens of millions of hands per second per core, Monte
Carlo equity, ICM, starting-hand range parsing, and an arena for pitting agents
against one another across Texas Hold'em and Omaha.

Version 5 is the milestone. It ships a multi-threaded Counterfactual Regret
Minimization (CFR) solver, the first parallel CFR implementation available in
open source, using PCFR+ regret matching and parallel tree exploration to learn
game-theory-optimal strategies.
