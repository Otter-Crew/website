---
title: 'The Mind Reader, Part 3: The Arena - Full-Rules Poker and the Agents That Play It'
description: 'Inside rs-poker''s arena - the game state machine, side pots, invariant-checked fuzzing, the async Agent trait, and the tournament that crowned a bot'
pubDate: 2026-07-23
tags: ['poker', 'mind-reader', 'rust', 'simulation']
---

*Part 3 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker.*

## The full game, or nothing

- Most poker software starts simplified. Heads-up, fixed bets, no antes. Good for studying algorithms - we do it ourselves in the regret arc.
- But an agent trained on simplified rules learns a simplified game.
- The arena speaks the whole language. Any number of players, any legal bet size, all-ins, antes, the settlement math.
- It also seats bots at the table, so it can answer who is better. The rest of the series keeps asking.

## The game is a state machine

- The game is the state machine, not the hand. A hand is data - two cards. `GameState` is data too: stacks, bets, board, whose turn.
- `HoldemSimulation` moves it forward one transition at a time.
- The rounds are explicit. The machine runs `Starting -> Ante -> DealPreflop -> Preflop -> DealFlop -> Flop -> DealTurn -> Turn -> DealRiver -> River -> Showdown -> Complete`.
- Dealing is its own state. Cards arriving and people acting are different transitions.
- Inside a betting round it tracks who still owes action, the bet to match, and when the round closes. Even the raise-reopening rules everyone gets wrong the first time.
- Every transition is a plain function of the state. Any position is inspectable and testable mid-hand.

## Side pots, and the all-in for less

- With three or more players and unequal stacks, one pot isn't enough. A player can only win chips they matched.
- Three players. Stacks of 100, 60, and 25. All the money goes in. The 25-stack can win at most 75. The 60-stack at most 195. The rest is a side pot between the big stacks.
- The arena doesn't build pots as it goes. It tracks each player's total wager and derives the pots at settlement. That turns a bug farm into arithmetic.
- The nastiest rule is the all-in for less. A shove smaller than a full raise doesn't reopen betting for players who already acted.
- "You may call the extra but not raise" is a real state in the machine, not a patch.

## Conservation of chips

- The state space is too big to hand-test. So the arena checks invariants instead.
- Winnings equal bets. Pots settle exactly. No more than 52 cards leave the deck. Active players in a closed round have matched the max bet.
- The assertions are public, not buried test code. Anything that runs a simulation can call `assert_valid_game_state` after every hand.
- Fuzzing supplies the games nobody would write. cargo-fuzz turns random bytes into stacks, blinds, and betting sequences via `Arbitrary`, then plays them with the invariants armed.
- The triple all-in-for-less with an odd ante - the fuzzer finds it. Past crashes become the regression corpus.

## A seat at the table: the Agent trait

- An agent answers one question. Given the game state, what's your action? The trait is `async fn act(&mut self, id, game_state) -> AgentAction`, and it's `Send`.
- While deciding it can run a Monte-Carlo sim, consult a solver, or call a neural net.
- Historians are the other half. They hear every action, deal, and settlement. Logging, statistics, the Open Hand History export - all historians.
- The engine doesn't know what they do with the events.
- Always-fold is a few lines. The gap between "I have an idea" and "it's playing thousands of hands" is one trait impl.

## The roster

- `FoldingAgent` folds everything. `CallingAgent` never folds and never raises. `AllInAgent` shoves. `RandomAgent` rolls dice.
- None of them are good. All of them are useful - the boundary conditions of poker.
- `RandomPotControlAgent` runs Monte-Carlo equity with Part 2's evaluator and sizes its aggression to its hand. It's the first agent that looks at its cards.
- Agents are TOML/JSON configs, not code. A directory of configs is a tournament field. Trying a variation is a text edit, not a recompile.

## Crowning a champion

- `rsp arena compare` runs the tournament. Thousands of games, seats rotated, results in a ratings ledger.
- Poker variance is brutal - a bad agent can win for a thousand hands. The volume buys a trustworthy ranking.
- The pot-control agent wins. It value-bets strong hands, controls the pot with weak ones, and grinds the roster down. It holds the title until the CFR agent arrives in Part 7.
- `rsp arena generate` writes every hand out as Open Hand History. Remember that. Millions of recorded hands from a diverse population is the shape of a training set.

## The ceiling, and what comes next

- "Beat everything in the field" has a catch. The field is bots we wrote.
- A tuned heuristic has patterns - fixed thresholds, predictable sizings - and patterns can be countered. Tuning harder just moves them around.
- Breaking the ceiling takes a different idea. Encode how to learn a strategy no one can exploit.
- That's the equilibrium territory from Part 0. At the bottom of it is one simple number, regret. Next time is pure theory, no code.
