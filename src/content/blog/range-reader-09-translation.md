---
title: "The Range Reader, Part 9: Hole Cards as a Translation Problem"
description: "Mask the hidden cards, translate the public betting record into a belief over 1,326 combos, and re-read the range at every street"
pubDate: 2026-07-23T12:00:00Z
tags: ["poker", "range-reader", "machine learning", "transformers"]
---

_Part 9 of [The Range Reader](/blog/range-reader-00-intro/), a series on teaching a computer to read your mind at poker._

All the code here lives in [`range-reader`](https://github.com/Otter-Crew/range-reader), a PyTorch project.

## The answer is a distribution

Sit at a table, and you never pin a man to one hand.

He could have aces. He could have the flush draw - four of a suit hunting the fifth. Each with a weight, and the weights move every time he acts.

There are C(52,2) = 1,326 two-card combinations - combos - he could be holding. A read puts a number on each one. Poker calls that a range.

The input is the public record: seats, stacks, blinds, bets, board cards, in order. The output is the belief.

Sequence in, belief out. NLP built that machinery a decade ago, and we borrow it.

## Hidden information is a blank

Years back I read BERT ([Devlin et al., 2018](https://arxiv.org/abs/1810.04805)). Hide a word, train a transformer to fill it back in from the words around it. The blank already has a right answer sitting in the corpus, so the labels cost nothing.

Poker hands over the same gift. The arena dealt the cards and wrote every one of them down (Part 8), and the villain - the seat we are reading - held two.

So hide those two and train the model to fill them in from the betting.

The framing outlives poker. Any sequential game with a public record and a hidden state fits: mask the state, read the record. Bridge is the twin. The auction is public. Thirteen cards stay hidden. Every hand turns face up at the end. Football fits too. The snaps are on tape, and the next play is its own label. So do the deduction games, Werewolf and Diplomacy. The talk is public, and the roles get named when the game closes. Each one hands you the answer once the round is over. The corpus held BERT's missing word the same way.

The shape holds even where the answer costs more. A market's tape is public. Every trader's private read is hidden. But the tape never turns over to say who knew what. An auction shows the winner's price. He paid it. It buries what the losers would have paid. A break-in writes itself into the logs, and only forensics, slow and rare, says what the intruder wanted. Same shape. Dearer labels.

Poker is the hard case for a different reason - who is talking. A bet is a word chosen by a man who profits from your believing the wrong thing. He tells the truth some of the time and lies the rest, and he mixes the two on purpose, which is all of Part 4. You are learning a language from someone lying to your face.

One thing did not carry over. BERT reads the sentence in both directions, left of the blank and right of it. A read at a live table has only the past. So the model is a causal decoder - each position attends to earlier positions and nothing later - and it emits a fresh read at every one of them.

## The stream

`hand_history.py` parses the arena's [Open Hand History](https://hh-specs.handhistory.org/storage-format) into a canonical hand: seats zero-indexed, cards as strings, chips as numbers. [`encoder.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/encoder.py) flattens that into tokens.

The order is the order of the table. A start marker, one `sit` per seat, the `is_button` marker, `preflop`, one hole slot per seat, then each later street - flop, turn, river, the rounds that deal the shared board - with its board cards and every action. Ninety-six positions hold a six-handed hand with room to spare, and anything longer is cut.

**Actions ride on their seat.** There are thirteen base actions - `sit`, `post_blind`, `fold`, `check`, `call`, `bet`, `raise`, `all_in`, and the rest - and sixteen possible seats, and the vocabulary is their cross product. `raise@seat3` and `raise@seat7` are different tokens, 208 of them, inside a vocabulary of 1,596 - the fixed set of tokens the model can read. The model never works out whose turn it is. The seat is in the token. [`tokens.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/tokens.py) owns that layout.

**Chips ride alongside as a number.** Every position carries a token id and a float, and the float is chips in big blinds - the forced bet that sets the stake. The stack on a `sit`, the amount on a bet, each divided by that blind. A 3bb raise is then the same event at a 1/2 game and a 25/50 one - three big blinds either way, at two different stakes. Part 10 is about getting that number into a network without chopping it into buckets.

**Cards get one canonical form.** A card is an integer, rank times four plus suit, so integer-divide by four and you have the rank. Two of them sort low to high and fold into one of the 1,326 combo ids. Part 1 packed a card the other way around, suit times thirteen plus value, because Rust wanted a suit to be a contiguous block of bits. Here the rank is the thing that has to be cheap to reach, and Part 10 says why.

Then the mask, at the hole slots.

- The seat we read from - the perspective - shows its combo. Those two cards are ours, and knowing them is legal.
- The villain gets `<predict_hole>`.
- Every other unseen seat gets `<hide_hole>`.

Both of those are seat-attached like everything else, so the stream says which chair is blank without anybody counting positions.

What is left is what a watcher at the table sees. Hidden information in the game is a masked token in the sequence.

One thing came out of the stream and stayed out. An early vocabulary emitted `win` and `lose` at the end of a hand. It trained beautifully. The outcome lands inside the window we supervise, and a live read never gets to see it, so the model was reading the answer off the back of the card. Those tokens are gone.

## One hand becomes many reads

A showdown - the cards turned face-up at the end - reveals more than one hand.

`augment_hand` walks every ordered pair of seats with known cards. Seat 2 reading seat 5 is one sample. Seat 5 reading seat 2 is another. Four face-up seats give twelve reads out of one hand.

A seat that folds without ever putting a voluntary chip in is skipped as a villain. An open fold shows a wide fold range and teaches nothing. The seat still serves as a perspective, since the two cards it holds are two the villain cannot. A seat that calls and then folds is kept, because somebody wanted to read it before it gave up.

Hands where nobody committed a chip - a walk - are dropped when the shards are written. No chips, no signal.

Then the suits multiply it. Relabel all four suits consistently and the poker does not change: no suit outranks another, and a flush cares only that the suits match. That is an exact symmetry, and four suits admit twenty-four relabelings. Training draws one at random per sample, and the token stream and the target combo move through the same permutation.

The same twenty-four relabelings come back at read time. `tta_canonical_probs` runs one hand through all of them, maps each output back to canonical order, and averages the probabilities. A perfectly symmetric model would not move. The real one is close to symmetric, and averaging cancels part of the gap.

The 613,399 hands of Part 8 come out as roughly three million reads. Every one of them is a legal hand.

A dozen of those reads share a hand. Split them at random and half of a hand trains the model while the other half grades it - leakage. So `prepare` hashes the hand id instead and sends five percent of hands to validation, every read of a hand going the same way.

## The same hand, at every position

A GPT is trained to name the next token. This one is trained to name the same hidden hand at every position it is allowed to speak.

Two masks in [`data.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/data.py) decide where that is.

`loss_mask` is the supervised window. It opens just after `<predict_hole>`, because before that the model has not been told which seat to read. It closes on the villain's fold, that fold included, because a folded hand says nothing more. A villain who reaches showdown holds the window open to the end.

The target never moves inside the window. The same two cards are the answer at the flop, at the turn, and after the check-raise. The input is what changes, and the loss adds a term at every position, so one label trains a trajectory instead of a guess.

The two masks are read off the token stream. The window keys on `<predict_hole>` and `fold` - seat-attached, suit-free - so a permutation leaves it fixed. The dead mask keys on the cards, so a permutation moves it - but the target moves the same way, and the true combo stays alive. Neither comes loose.

## Nothing you can see is in his hand

The read covers 1,326 combos, and most of them are impossible.

The rule is card removal. A card you can see is a card he cannot hold, and each card sits in fifty-one combos. Your two and a flop - three shared cards - leave 1,081 of the 1,326 alive.

`dead_mask` is a table of those impossibilities, one row per position, filled in left to right as cards land. Dead entries go to negative infinity before the softmax - the step that turns raw scores into probabilities - which gives them probability zero and zero gradient - nothing for training to push on. Arithmetic enforces the rule, so the model never has to learn it. The true combo is alive by construction: the perspective is never the villain, and the villain's cards are never board cards.

The stream is drawn from 1,596 token ids. The answer is one of 1,326 combos, scored by a plain `Linear(d, 1326)` on top of the decoder. Read one language, emit another. That is the translation.

## Grading a belief

Accuracy is the wrong scorecard. One guess out of 1,326 is wrong nearly every time, and being wrong tells you nothing about how good the range was.

So we score by rank. Sort all 1,326 by probability, find the truth, take one over its position. First scores 1.0, tenth 0.1, hundredth 0.01. Averaged over the supervised positions, that is mean reciprocal rank (`val/mrr` in [`metrics.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/metrics.py)), and it pays for shoving the truth toward the top. Loss and mean rank pay for lifting it off the bottom, which is easier and worth less.

The average pools every supervised position in a pass and divides once. A mean of per-batch means would weight a two-position window the same as a forty-position one, and training and the recorded eval would report different numbers for the same checkpoint.

A blind guess sets the floor on all three. Uniform over 1,326 gives mrr 0.0059, loss ln(1326) = 7.19, and mean rank 663.5. The floor is printed beside every result, and the runs worth keeping clear it by about threefold.

That number chose everything below.

## The model underneath

The transformer blocks are ordinary. Ten layers, `d=640`, ten heads, about fifty million parameters, running in `bf16-true` - 16-bit floats, half the memory - on a single GPU.

Attention is the mechanism. Every position forms a query, every earlier position offers a key and a value, and the position takes back a weighted mix of the values whose keys it matched. Ten heads run ten of those mixes at once, so one token can track the button, the pot, and the last raise without the three fighting over the same channel.

The blocks are current small-decoder practice, one line each in [`model.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/model.py).

- **Pre-norm.** Normalize going into attention and into the MLP - the token's own feed-forward layer - and leave the residual path clean from input to output.
- **RMSNorm with no learnable scale** ([Zhang & Sennrich, 2019](https://arxiv.org/abs/1910.07467)). Divide by the root mean square of the vector. No mean subtracted, no gain, no bias.
- **QK-norm** ([Henry et al., 2020](https://arxiv.org/abs/2010.04245)). Normalize the queries and keys before the dot product, so an attention score cannot run away and saturate the softmax.
- **A ReLU^2 MLP** ([So et al., 2021](https://arxiv.org/abs/2109.08668)). Square the ReLU, the `max(0, x)` gate. One character, and it beat the usual GELU in the architecture search that turned it up.
- **Dropout 0.15** on the embedding, the attention output, and the MLP output. Fifty million parameters against three million reads will memorize, and dropping a share of the activations every step makes memorizing the harder path.

Then position.

The model gets no positional encoding. NoPE ([Kazemnejad et al., 2023](https://arxiv.org/abs/2305.19466)). A causal decoder recovers order from its own mask, and the position that matters in poker - which street, which seat relative to the button, how many players are still live - is fed as content in the embedding instead of as geometry. Part 10 covers that.

We measured it. `GPTConfig` carries a `rope` flag. Two runs, one bit apart, same thirty-five-minute budget.

| positional encoding        | steps in budget | val loss | mean rank |    mrr |
| :------------------------- | --------------: | -------: | --------: | -----: |
| NoPE                       |          40,420 |    6.549 |     324.6 | 0.0174 |
| RoPE on the sequence index |          36,746 |    6.562 |     330.1 | 0.0173 |

Rotary lost every column and cost enough per step to fit nine percent fewer of them. Rotating by the raw sequence index encodes how many players sat down and how many actions have gone by, which is noise. NoPE stays.

## How it trains

The recipe is standard.

- **AdamW** ([Loshchilov & Hutter, 2017](https://arxiv.org/abs/1711.05101)), betas 0.9 and 0.95, fused when there is a CUDA device.
- **Learning rate 6e-4**, linear warmup into a cosine decay that bottoms out at a tenth of peak.
- **Weight decay 0.20, on matrices and embedding tables only.** `build_optimizer` splits the parameters by dimension: two dimensions or more decay, and the one-dimensional leftovers do not. Decaying a bias or a norm gain shrinks something that has no business being small.
- **The schedule runs on the clock.** Experiments get a wall-clock budget, so the warmup ramp and the cosine are both measured in seconds rather than steps ([`optim.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/optim.py)). A slower architecture finishes fewer steps and still lands at the floor learning rate when time runs out, which is the only way two architectures compare at equal cost.
- **An EMA at 0.99 for evaluation** (`callbacks.py`). Training keeps the raw weights. An exponential moving average of them is swapped in for every validation pass and swapped back out. The averaged weights are steadier and score half a point to a point better on the top-K metrics, and the saved checkpoint is the EMA model, so the `val/mrr` rank is the one that ships.

Keep the best checkpoint by `val/mrr`. The last one is saved beside it and never used.

## Watching the read sharpen

Point [`scripts/query.py`](https://github.com/Otter-Crew/range-reader/blob/master/scripts/query.py) at one hand with `--show-steps`, and the belief prints street by street: the top combos with their probabilities, and the truth's rank and probability beside them.

Preflop, the model has a seat and a raise. By the river, it has four streets of betting and five board cards, and the true hand climbs the list.

The window holds one question in front of the model at every position, so more chips in the pot means more evidence on the same question.

Part 11 measures the climb.

## Next time

The decoder is stock. The embedding is not.

Part 10 opens it: seat, button-relative position, table size, live count, card identity, and bet size, each a poker concept summed into one vector. Hole cards are composed out of card vectors instead of looked up. Bet sizes enter as real numbers, never chopped into tokens.
