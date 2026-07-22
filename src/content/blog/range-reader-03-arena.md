---
title: "The Range Reader, Part 3: The Arena - Full-Rules Poker and the Agents That Play It"
description: "Inside rs-poker's arena - the game state machine, the Agent trait, historians, side pots, invariant-checked fuzzing, and the tournament that crowned a bot"
pubDate: 2026-07-22T11:00:00Z
tags: ["poker", "rust", "simulation"]
---

_Part 3 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## The full game, or nothing

Most poker software starts simply - two-player heads-up, fixed bet sizes, no antes - and so do we, in the regret act.

But an agent raised on cut-down rules only learns the cut-down game, and it never meets a side pot.

The arena speaks the whole language: two to sixteen seats, any legal bet size, antes, all-ins, and the settlement math when three unequal stacks all go in.

It pits bots against each other and says which is better.

This post is the tour. What is here, how the data moves, and how to put your own agent in a chair. The last one is a trait with one method.

## The game is a state machine

Every number your agent reads comes from here, and so does the moment it gets asked.

A `Hand` is data, and so is `GameState`. `HoldemSimulation` moves it, one transition at a time.

| Round         | What happens              |
| :------------ | :------------------------ |
| `Starting`    | nothing yet               |
| `Ante`        | forced money goes in      |
| `DealPreflop` | hole cards                |
| `Preflop`     | **betting**               |
| `DealFlop`    | three community cards     |
| `Flop`        | **betting**               |
| `DealTurn`    | a fourth community card   |
| `Turn`        | **betting**               |
| `DealRiver`   | a fifth community card    |
| `River`       | **betting**               |
| `Showdown`    | hands compared, pots paid |
| `Complete`    | nothing left              |

Twelve rounds, and four of them take bets. The four betting rounds - preflop, flop, turn, river - are the streets.

Dealing gets its own round, because cards arriving and people acting are different events.

Seats are tracked in a `PlayerBitSet`, one bit per chair, sixteen bits wide. The deal rounds walk in the same order the betting rounds do, so dealing starts left of the button for free.

A betting round tracks three things: who still owes action, the bet to match, and the minimum legal raise.

Owing action is one of those bits. Put money in, and your bit clears. Raise, and every active bit turns back on. The round closes when no active player owes an action.

The minimum raise only grows. It holds the largest raise made this round, so a small all-in cannot shrink what the next player has to put in.

Raises are capped at three per round by default. Past the cap, a raise becomes a call. Pass `None` to lift it.

Every transition is a plain function of the state. Any point in a hand is inspectable and testable.

## What the agent is handed

An agent gets `&GameState`, all of it.

That includes `hands`, which holds every player's cards, the folded ones too. The arena is the dealer, and the dealer sees everything.

So the arena cannot stop you from cheating. It hands you the truth and trusts you to look away.

`RandomPotControlAgent` shows the discipline. Before it estimates its equity, it builds a clean copy of the table.

```rust
fn clean_hands(&self, game_state: &GameState) -> Vec<Hand> {
    let mut default_hand = Hand::new();
    default_hand.extend(game_state.board.iter().cloned());

    let to_act_idx = game_state.to_act_idx();
    game_state.hands.clone().into_iter().enumerate()
        .map(|(idx, hand)| if idx == to_act_idx { hand } else { default_hand })
        .collect()
}
```

Every seat but its own becomes the board and nothing else. Then it deals those seats a thousand random hands, ranks every showdown with Part 2's evaluator, and counts how often it wins. That is Monte Carlo equity against opponents it knows nothing about, which makes for a weak read but an honest one.

The rest is what you would ask a dealer. Whose turn, the bet to match, what you already put in, the minimum raise, your stack, the pot, the board, the button.

And it copies cheaply. Part 1 made `GameState` a single flat block of bytes, with a `u64` per hand. An agent that wants to play the hand out a thousand times clones the entire table using memcpy. Part 7 lives on that.

## A seat at the table

An agent answers one question. Given the state, what do you do?

```rust
#[async_trait]
pub trait Agent: Send {
    async fn act(&mut self, id: u128, game_state: &GameState) -> AgentAction;
    fn name(&self) -> &str;
    fn historian(&self) -> Option<Box<dyn Historian>> { None }
}
```

`act` is async, so deciding can await an HTTP call, a batch of inference, or sub-simulations spawned in the runtime, and Act 4 needs all three. `Send` lets the simulation itself be spawned.

`id` is the simulation's id, so a stateful agent can tell one hand from another. `name` goes in the ledger. `historian` has a section to itself below.

There are four answers.

```rust
pub enum AgentAction {
    Fold,
    Call,
    Bet(f32),
    AllIn,
}
```

`Bet` is the total you want in for this round, not the amount you are adding. Bet the current bet, and you have called. This trips everyone once.

Here is an agent that min-raises from the button and calls everywhere else.

```rust
struct ButtonRaiser;

#[async_trait]
impl Agent for ButtonRaiser {
    async fn act(&mut self, _id: u128, game_state: &GameState) -> AgentAction {
        if game_state.to_act_idx() == game_state.dealer_idx {
            let to_match = game_state.current_round_bet();
            AgentAction::Bet(to_match + game_state.current_round_min_raise())
        } else {
            AgentAction::Call
        }
    }

    fn name(&self) -> &str { "button-raiser" }
}
```

Seat it.

```rust
let game_state = GameStateBuilder::new()
    .num_players_with_stack(3, 100.0)
    .blinds(10.0, 5.0)
    .build()?;

let agents: Vec<Box<dyn Agent>> = vec![
    Box::new(ButtonRaiser),
    Box::<CallingAgent>::default(),
    Box::<RandomAgent>::default(),
];

let mut sim = HoldemSimulationBuilder::default()
    .game_state(game_state)
    .agents(agents)
    .build_with_rng(StdRng::seed_from_u64(420))?;

sim.run().await;
```

One agent per stack. Same seed, same hand, every time.

That is the entire gap between an idea and ten thousand hands played.

Four agents ship at the corners of the game. `FoldingAgent` folds. `CallingAgent` never folds and never raises. `AllInAgent` shoves. `RandomAgent` rolls dice against fold and call percentages that deepen as raises stack up.

`RandomPotControlAgent` is the first one that looks at its cards.

## When you get it wrong

You will. The arena will not crash.

Bet more than your stack, and it silently becomes an all-in. Bet 100,000,000 with 100 behind, and you bet 100.

Fold when nothing is owed, and it becomes a check. You cannot give up a free card by accident.

Bet an illegal amount - under the call, under the minimum raise, negative, `NaN` - and you fold. The bet is validated before anything moves, so a bad one changes nothing before it is refused.

Raise past the cap, and it becomes a call.

Every one of those goes into the record, carrying what you tried and what happened instead. The hand plays on. Your mistake is in the file, in your handwriting.

## Historians

Agents decide. Historians watch.

```rust
#[async_trait]
pub trait Historian: Send {
    async fn record_action(
        &mut self,
        id: u128,
        game_state: &GameState,
        action: &Action,
    ) -> Result<(), HistorianError>;
}
```

One method, every event, in order. The simulation finishes mutating the state before it records. Replays depend on that.

Here are the events.

| Event              | What it carries                            |
| :----------------- | :----------------------------------------- |
| `GameStart`        | blinds and ante                            |
| `PlayerSit`        | a seat and its stack                       |
| `DealStartingHand` | one card, one seat                         |
| `ForcedBet`        | ante, small blind, big blind               |
| `RoundAdvance`     | the machine moved                          |
| `DealCommunity`    | one board card                             |
| `PlayedAction`     | what a seat did                            |
| `FailedAction`     | what a seat tried, and what it got instead |
| `Award`            | chips going out                            |

`PlayedAction` carries the before and after of every number that moved: pot, bet, minimum raise, that player's total, who is active, who is all-in. A historian never has to reconstruct anything.

Six ship.

| Historian                  | What it records                      |
| :------------------------- | :----------------------------------- |
| `VecHistorian`             | everything, in memory                |
| `StatsTrackingHistorian`   | VPIP, PFR, 3-bet, profit by position |
| `DirectoryHistorian`       | one JSON file per hand               |
| `OpenHandHistoryHistorian` | the format the neural net trains on  |
| `FnHistorian`              | a closure                            |
| `NullHistorian`            | nothing                              |

Return an error and you are dropped from the simulation. The hand goes on without you. Build with `panic_on_historian_error` and it stops instead, which is what you want in a test.

Now the third method on `Agent`. An agent that needs to see the whole hand, not just its own turns, ships a historian and gets every event. That is how the CFR agent walks its tree in Part 7.

## Conservation of chips

Finding all the edge cases of a poker simulation is arduous, and the state space is too big to hand-test, so the arena checks itself.

Chips are conserved: bets sum to the pot, and so do winnings. That holds through an all-in, an all-in for less, and a hand that splits into three side pots. No card is dealt twice. The board never passes five. A folded player who was never all-in wins nothing.

The assertions are public. `assert_valid_game_state` is not buried in a test module - turn on `arena-test-util` and anything that runs a hand can call it.

The rest comes from the fuzzer. `cargo-fuzz` hands `Arbitrary` a pile of random bytes, and `Arbitrary` turns them into stacks, blinds, and a list of `AgentAction`. A replay agent plays the list back one action at a time. The invariants are armed.

Then it goes further and builds the Open Hand History for the same hand, asserting the export agrees with the state it came from. A record that disagrees with the game is worse than no record.

Three unequal stacks, an odd ante, and the short one shoves for less than a raise. Nobody writes that test. The fuzzer finds it. Past crashes become the corpus.

## A directory is a tournament field

Agents are JSON.

```json
{
  "type": "random_pot_control",
  "name": "PotControl",
  "percent_call": [0.5, 0.3]
}
```

`ConfigAgentBuilder` takes a file, a directory, or an inline string. Trying a variation is a text edit.

A directory of configs is a field. `examples/configs` ships eight - the four corners, two flavors of random, a preflop chart, and a CFR agent with its whole budget written out. Those last two are Part 7's subject, and their configs run long.

## Crowning a champion

```bash
rsp arena compare ./examples/configs -n 5000 -p 3
```

Point it at a directory. `-p` sets the seats, `-n` the game states each seating gets.

Seat matters in poker, so it runs every ordered arrangement. Eight configs into three chairs is 336 of them. At `-n 5000` that is 1.68 million hands, which is the point.

Results come back as a ledger: profit per game in big blinds, and under it VPIP, PFR, 3-bet - how loose each plays, how often it raises, how often it re-raises - and profit by position.

Poker variance is brutal. A bad agent wins for a thousand hands. Volume is what buys a trustworthy ranking.

Against the simple roster, the pot-control agent wins. It value-bets strong hands, keeps pots small with weak ones, and grinds the rest down. Nothing beats it until the CFR agent sits down in Part 7 - and then it finishes last.

## Writing the hands down

```bash
rsp arena generate ./examples/configs -o hands.ohh -n 1000
```

Same field, different job. Every hand goes out as Open Hand History, the standard JSON format, one hand per line. Pass `-n 0` and it runs until you stop it.

Real hand histories only show cards at showdown, which is the problem with them.

The arena deals the cards, so it writes every hole card on every hand - folded, won, mucked. The label is free, and it is on all of them.

Millions of recorded hands from a mixed field, every one labeled. That is the shape of a training set.

## The ceiling

Beat everything in the field, and the field is bots we wrote.

<!-- I need a participation trophy image here. -->

## Next Time

A tuned heuristic has patterns, fixed thresholds and predictable sizings, and patterns get countered. Tuning harder only moves them around.

Breaking that takes a way to learn a strategy nobody can exploit.

That is the equilibrium territory from Part 0, and at the bottom of it is one number. Regret.
