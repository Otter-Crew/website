---
title: "The Range Reader, Part 10: Embeddings That Mirror Poker"
description: "No flat vocab table - factored additive embeddings built from poker primitives, and bet sizes fed as floats instead of bucketed tokens"
pubDate: 2026-08-06
draft: true
tags: ["poker", "range-reader", "machine learning", "transformers"]
---

_Part 10 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Embeddings are underrated

- I was tech lead for ads at Facebook. I learned to love embeddings.
- You could tell the model a feature's shape and importance.
- A GPT throws that away. One embedding table, one row per token, as wide as the vocabulary. Want more capacity? Make the rows wider.
- Width is the only knob. Nothing tells the table that a token is a number, a position, a known kind of thing. Every row learns from scratch.
- This works great if you have the independent dataset and GPU years to spare. With fewer resources, structure has to earn its keep.

## Language models can't count

- Language models are famously bad at math. Grade-school word problems stump large models ([Cobbe et al., 2021](https://arxiv.org/abs/2110.14168)).
- Multi-digit multiplication collapses as the numbers grow ([Dziri et al., 2023](https://arxiv.org/abs/2305.18654)). The models pattern-match. They don't compute.
- The reason is the space. A token's vector is shaped to predict words, not to hold magnitude. Numeracy is a weak side effect ([Wallace et al., 2019](https://arxiv.org/abs/1909.07940)).
- Poker is math. A bet size matters to the big blind. A word-space blurs the exact number range-reader needs.
- So we keep range-reader's embedding out of that space. Every axis is a quantity the game defines - probability and poker, nothing else.

## The factored embedding

- A GPT gives each token one row from one giant table, learned from scratch. range-reader builds each token's vector from parts ([`model.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/model.py)).
- Picture a shelf of small tables, one per fact the game hands you. Look each fact up, add the vectors, and the sum is the token.
- The facts are plain. What happened, who did it, where they sit relative to the button, how many are at the table, how many are still in the pot.
- One table holds a vector per action, another one per seat. The code names them `E_action`, `E_seat` - one `E_` table per fact.
- An action means the same whoever makes it. "Raise" gets one vector; the seat is added on top, not baked into a separate row.
- The bet size is one more fact - a number, not a lookup. Its own section below.
- Position, table size, and live count aren't fed in. The model counts them from the stream, so they can't disagree with the actions.

## Position is button-relative

- Position is the most important fact at the table.
- The button acts last and plays more hands. Under the gun acts first and needs a better one.
- So on top of the raw seat, each token also carries its seat relative to the button. `relpos = (seat - button) mod players`. BTN, SB, BB, UTG fall straight out.
- The same raise means different things from different chairs. On the button it is wide; under the gun, strong.
- The embedding knows the difference before attention starts.
- `E_n_live` carries how many players remain. A bet into five live hands is not a bet into one.

## Hole cards are composed

- The two hidden cards are the answer. There are 1,326 possible pairs, and they get no table of their own.
- The model builds a pair's vector from its two cards. Each card has a vector; add the two.
- A card's vector is itself two parts. One for the exact card (`E_card`), one shared by all four cards of a rank (`E_card_rank`). Every ace teaches the model about aces.
- Add one vector for the shape - pair, suited, or offsuit (`E_combo_type`). Two card vectors alone can't say whether the suits match.
- So 1,326 hands come from about 70 small vectors, not 1,326 strangers.

## Chips are floats

- Every other fact is a category you look up. A bet size is different. It's a number, and the number matters - 12 big blinds tells a different story than 40.
- The easy hack buckets sizes into a few tokens, a "small bet" and a "pot bet". That throws away the exact amount, the signal a read lives on.
- You can't paste the raw number onto the vector either. A network reads a lone number poorly.
- So we spread the number into many. Take the bet in big blinds and take its log.
- Then read sines and cosines at several frequencies - eight numbers that move smoothly as the bet grows.
- This is the trick transformers use to encode position, pointed at money. Close amounts get close features, so the model feels magnitude. The code calls it `phi`.
- A small learned weight folds those eight numbers into the token's vector, one weight per action (`W_value`). A raise's size and a call's size aren't the same thing.
- A 12bb raise and a 40bb raise arrive as different vectors, no bucket between them. The bet is a number. We feed it as one.

## Next time

- Part 11: does it read minds? The metric, the experiments, and the read sharpening street by street.
