---
title: 'little-sorry'
summary: 'A Rust library of state-of-the-art regret-minimization algorithms for solving imperfect-information games. Six CFR variants behind one trait, now powering the rs-poker solver.'
year: 2026
status: 'active'
role: 'Author and maintainer'
link: 'https://github.com/elliottneilclark/little-sorry'
featured: true
order: 2
---

little-sorry is a Rust library for Counterfactual Regret Minimization (CFR), the
family of algorithms used to converge on Nash-equilibrium strategies in
imperfect-information games like poker.

It ships six regret-learning variants behind a single `RegretMinimizer` trait —
CFR+, Discounted CFR, DCFR+, Linear CFR, Predictive CFR+ (PCFR+), and Predictive
DCFR+ (PDCFR+) — so an agent can swap learning rules generically and measure
which converges fastest on a given game. The hot path allocates nothing: regret
updates run without touching the heap, and the only dependency is `rand`.

little-sorry now powers the CFR solver in [rs-poker](/projects), where its
predictive regret matching does the equilibrium-finding work.
