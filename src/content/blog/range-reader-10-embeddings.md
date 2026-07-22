---
title: "The Range Reader, Part 10: Embeddings That Mirror Poker"
description: "No flat vocab table - factored additive embeddings built from poker primitives, and bet sizes fed as floats instead of bucketed tokens"
pubDate: 2026-07-23T13:00:00Z
tags: ["poker", "range-reader", "machine learning", "transformers"]
---

_Part 10 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

## Embeddings are underrated

An embedding table turns a discrete thing - a word, a seat, a card - into a vector of numbers. It is where a model meets the world, and everything above it works on whatever the table hands up.

A GPT standard gives up embedding structure for simplicity. One table, one row per token, as many rows as the vocabulary, and the width of a row is the only capacity you can buy. Nothing in the table says that this token is a number and that one is a position, so every row starts from noise and learns alone.

With a corpus the size of the internet and GPU-years to burn, that is a fine trade. range-reader has 613,399 hands, three million reads, and thirty-five minutes on one GPU. Structure has to earn its keep here.

## Language models can't count

Grade-school arithmetic still beats them. OpenAI built GSM8K out of 8,500 word problems a ten-year-old can do and found the largest transformers of the day could not solve them reliably ([Cobbe et al., 2021](https://arxiv.org/abs/2110.14168)). Multiplication is worse. Off-the-shelf GPT-4 lands near 59% on three-digit by three-digit, and accuracy falls toward zero as the digits grow, because the model matches patterns it has seen instead of running the algorithm ([Dziri et al., 2023](https://arxiv.org/abs/2305.18654)). Scale has closed much of that gap since, and it closed it with data and compute this project does not have.

Knowing what a number is worth and computing with it are different skills, and the embedding is where the first one lives. Wallace and coauthors probed what ordinary word vectors know about magnitude. A surprising amount: GloVe and word2vec carry it accurately up to about a thousand, and character-level embeddings beat sub-word ones ([Wallace et al., 2019](https://arxiv.org/abs/1909.07940)). What they also found is where it stops. Train a probe on one range of integers, test it outside that range, and it fails. Numeracy arrives as a side effect of predicting words, and it holds over the numbers the text happened to cover.

Poker is arithmetic. A bet is a number measured against the big blind, the forced bet that sets the stake, and twelve big blinds tells a different story than forty. A space built to predict words blurs the part range-reader lives on.

So the embedding stays out of that space. Every table in it holds a quantity the game defines.

## The factored embedding

Part 9 left the vocabulary at 1,596 ids, and 208 of those are one base action attached to one seat. `raise@seat3` and `raise@seat7` are separate tokens, and a GPT would hand each a row and let the two of them learn what a raise is twice.

range-reader builds the vector instead ([`model.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/model.py)). Picture a shelf of small tables, one per fact the game hands you. Look each fact up, add the vectors, and the sum is the token. The code names them with an `E_` prefix.

```python
E_action      # 75 rows: one per base action, one per non-action token
E_seat        # 17 rows: sixteen chairs and nobody
E_relpos      # 17 rows: seat relative to the button
E_n_players   # 17 rows: table size
E_n_live      # 17 rows: players still in the pot
E_card        # 52 rows
E_card_rank   # 13 rows: shared by the four cards of a rank
E_combo_type  #  3 rows: pair, suited, offsuit
W_value       # 13 projections: the bet size, one per action
```

A raise means the same thing whoever makes it, so raise gets one row and the seat is added on top. Thirteen base actions and seventeen seats - sixteen chairs and a row for the tokens belonging to nobody, like a street marker or a board card - cover all 208 ids with thirty vectors.

Sharing rows changes how often each number gets taught. A row in a flat table learns only from the hands that contain its token, and Part 8's data never seats more than six players, so `raise@seat7` never appears and its row never moves off the noise it started at. The raise row in `E_action` takes a gradient - a nudge from one training example - out of every raise anybody makes at any seat, and `E_seat` keeps its own rows for what is actually about the chair.

The parameter count comes down as well, from 1,021,440 numbers to 201,600 at `d=640`. In a fifty-million-parameter model, that matters far less than the sharing does.

## Position is button-relative

Position is the most important fact at the table. The button - the last seat to act on every street after the first - watches everybody else commit before it has to, so it can open far more hands than anyone. Under the gun opens the action with five unknown hands behind it and needs a real holding to do it.

The seat number carries none of that. Seat 3 is under the gun at one table and on the button at the next, and the only thing deciding which is where the dealer button sat down.

So every token carries its seat relative to the button as well.

```python
relpos = (seat - button) % n_players
```

Zero is the button, one the small blind, two the big blind, three under the gun, and the rest follow in order. `E_relpos` gives each of those a row, and a token with no seat at all takes a seventeenth row that means nobody. The same raise is a wide range from the button and a strong one from under the gun, and the embedding carries that difference into the first attention head instead of leaving it to be worked out there.

Two more tables come off the same reading. `E_n_players` holds the table size, since six-handed and heads-up - two players - are different games played with the same cards. `E_n_live` holds how many of those players have not folded, because a bet into five live hands is not a bet into one.

None of the three arrives as a token. The model works them out from the stream it already has. The encoder emits one `is_button` token and one `sit` per seat, so the button and the table size are each one sum, and the live count is the table size minus a running total of folds. A fact computed from the actions cannot contradict the actions.

That is the other half of Part 9's decision to run with no positional encoding. What matters about position in poker is which chair and which street, and both go in as content.

## Hole cards are composed

The perspective seat - the chair we read from - shows its two cards, and that showing is one token out of 1,326. The token gets no row of its own.

A hand's vector is built out of the cards in it. Each card contributes a row from `E_card` plus a row shared by all four cards of its rank from `E_card_rank`, so every ace anybody is dealt teaches the model something about aces. Add the two cards, and most of the hand is there.

What is missing is the shape. Addition throws away which vector came from where, so two card vectors summed cannot say whether the suits matched. `E_combo_type` supplies that in three rows: pair, suited, offsuit. Ace-king suited and ace-king offsuit are the same two ranks and a different hand, and those three rows are the difference between them.

```python
E_card[low]  + E_card_rank[low // 4]
+ E_card[high] + E_card_rank[high // 4]
+ E_combo_type[shape]
```

Sixty-eight vectors cover all 1,326 combos, and the training count is why that matters. Three million reads carry one hand apiece, so a flat table with a row per combo would show each row about 2,300 examples over the whole run. The thirteen rank rows see roughly half a million each.

There is no table for suits, on purpose. Part 9 draws a random one of the twenty-four suit relabelings for every sample, which leaves the four suits interchangeable in the data, so a suit table would spend four rows learning one vector. `E_card` is what carries whatever the symmetry does not.

Board cards skip all of this. A community card is one of fifty-two plain rows in `E_action`, with no rank sharing and no card vector behind it, and factoring it is the next obvious job nobody has done.

The output side is flat, a plain `Linear(640, 1326)` with a row per combo. It can afford to be. Every supervised position scores all 1,326 at once, so each output row takes a gradient from every read in the batch. The input side is the one starved for examples.

## Chips are floats

Every fact so far has been a category with a row waiting for it. A bet size has no row to wait in. It is a quantity, and the quantity is the signal, since a twelve-blind raise and a forty-blind raise are different sentences.

Part 9 already put the number on the stream. Every position carries a token id and a float, and the float is the chip amount divided by the big blind, so the same bet reads the same at a 1/2 game and a 25/50 one. What is left is how it enters the vector.

The easy answer buckets it. Define a small-bet token, a pot-bet token, an overbet token, look one up, and the amount is gone. Part 7 had to do exactly that, because a solver needs a finite set of actions, and it pays for it every time two live sizes land in one of its fifty-two slots. The reader never has to act. It only has to read so that it can keep the number.

The other easy answer is to paste the raw float onto the vector, and a network reads a lone scalar badly. Tancik and coauthors traced the reason to how these networks converge, fast on the low-frequency part of a function and impractically slowly on the high-frequency part, which leaves fine distinctions along a single input axis to be learned last ([Tancik et al., 2020](https://arxiv.org/abs/2006.10739)). Their fix is to hand the network the number already spread out. The code does the same, under the name `phi`.

Take the bet in big blinds, take `log1p` of it - the natural log of one plus the bet - call that `u`, and report eight numbers.

```python
u = log1p(v)
[u, u*u, sin(u), cos(u), sin(2u), cos(2u), sin(4u), cos(4u)]
```

The name for that is a Fourier feature map, and the log in front of it is Part 7's spacing all over again. The gap between two big blinds and four matters, and the gap between eighty and eighty-two does not, so the axis has to compress as it climbs. `u` carries the magnitude and `u^2` lets a linear read of the eight features bend instead of running straight. The three sine-cosine pairs give position within the range at three resolutions, so two bets a blind apart come back as eight nearby numbers, and the network feels the distance rather than learning it.

The frequencies stop at four deliberately. Chip amounts in this data keep `u` under about five, and at eight the pair turns over more than a full cycle between a one-blind bet and a four-blind bet, sending two bets nothing alike back with nearly the same numbers. A basis that wraps that fast is noise wearing a smooth coat.

Part 9 threw sinusoids out of the position slot and ran the decoder without them. They come back here, pointed at money.

The eight numbers reach the vector through `W_value`, one projection per base action. Seven of the thirteen carry chips: the stack a player sits down with, the forced blind and ante, and the four voluntary ways to put money in the pot. Each gets its own `(640, 8)` matrix, because a forty-blind call and a forty-blind raise are the same arithmetic and different news. That tensor holds 66,560 numbers, a third of the whole embedding, which makes the bet size the most expensive fact on the shelf.

A twelve-blind raise and a forty-blind raise arrive as different vectors with no bucket in between. The bet is a number, and it goes in as one.

## Next time

The stream is built, the embedding is built, and the thing has been trained. Part 11 grades it: one number against the random floor, the score broken out by how far the villain got before folding, and why the training data sets the ceiling over all of it.
