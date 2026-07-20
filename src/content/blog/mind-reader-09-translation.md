---
title: "The Mind Reader, Part 9: Hole Cards as a Translation Problem"
description: "Mask the hidden cards, translate the public betting record into a belief over 1326 combos - and re-read the range at every street"
pubDate: 2026-07-31
tags: ["poker", "mind-reader", "machine learning", "transformers"]
---

_Part 9 of [The Mind Reader](/blog/mind-reader-00-intro/), a series on teaching a computer to read your mind at poker._

All the code here lives in [`range-reader`](https://github.com/Otter-Crew/range-reader), a PyTorch project. Links point at the file that does the work.

## How to predict in poker

- Sit at a table and you never pin an opponent to one hand. You hold a hunch over many.
- He could have aces. He could have the flush draw. Each with a weight.
- So the answer is a distribution. A belief over 1,326 hands, each with a probability. A range.
- The input is a sequence. Seats, blinds, bets, board cards, in order. The output is a belief.
- Sequence in, belief out. NLP built this machinery a decade ago. We borrow it.

## The idea came from BERT

- Years back I read BERT ([Devlin et al., 2018](https://arxiv.org/abs/1810.04805)). Hide a word, train a transformer to fill the blank from the words around it.
- Betting is a language too. A bet is a word. It says something about the hand, and about how strong the bettor feels.
- The speaker lies. A word can be an honest belief or a bluff. You are learning a language from someone lying to your face.
- So the job is translation with deception baked in. Hide the two cards. Train the model to hear what the betting really means.
- BERT is the mechanism. Fill a masked blank from context. We mask the hole cards and let the betting fill them in.

## Masking hidden information

- The hand becomes a token stream ([`encoder.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/encoder.py)). One `sit` per seat, carrying its stack. The button. The blinds.
- Then a hole token per seat. Then streets, board cards, and every action.
- The seat you read gets `<predict_hole>`, a real token standing in the villain's place.
- The seat you read _from_ shows its true cards. Every other hidden seat gets `<hide_hole>`.
- Now the stream shows what a watcher at the table sees. Hidden information in the game is a masked token in the sequence.
- Actions ride on their seat ([`tokens.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/tokens.py)). `raise@seat3` and `raise@seat7` are different tokens - 208 of them, 13 actions across 16 seats.
- So the model never works out whose turn it is. The seat is in the token.

## One hand becomes many reads

- A showdown reveals more than one hand. `augment_hand` in [`encoder.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/encoder.py) turns each ordered pair of shown seats into its own read.
- Seat 2 reading seat 5 is one sample. Seat 5 reading seat 2 is another. One hand yields a dozen.
- A seat that open-folds is skipped as a villain. An open fold shows only a wide fold range, nothing to learn.
- It still serves as a _perspective_. Its two cards strike dead combos from the seat you do read.
- Then suits multiply it. Relabel the four suits and the poker does not change - an exact symmetry. There are 24 relabelings.
- Training draws one at random per sample, the betting and the target moving together.
- So one hand fans into many streams. Different seats read, different suits worn. Every stream is a real, legal hand.

## Translating to a belief over 1,326 combos

- The read is a distribution over all C(52,2) = 1,326 combos. That output space is not the 1,596-token input vocabulary - the fixed set of tokens the model reads.
- The stream speaks one language. The answer speaks another.
- We mask to keep the model honest. Any combo using a visible card - the board, the perspective's cards - is impossible.
- A per-position mask sends those to -inf before the softmax - the step that turns scores into probabilities. The hard rule is enforced.
- Grade the belief by where it puts the truth. That metric is `val/mrr`, below.

## The model underneath

- It is a GPT decoder in [`model.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/model.py). Ten layers, `d=640`, ten heads. About 50M parameters, small enough for one GPU.
- Attention is the mechanism: each token weighs every earlier token and pulls in what it needs, and multi-head runs several such weightings at once.
- The blocks are current small-decoder practice. Pre-norm. RMSNorm with no learnable scale. QK-norm attention. A ReLU^2 MLP.
- Dropout 0.15, so 50M params don't memorize 600k hands.
- No positional encoding. NoPE. A causal decoder recovers order from its own mask.
- The position that matters - street, button-relative seat, table size - is fed as explicit content, not geometry.
- The output head is a plain `Linear(d, 1326)`. It scores the villain's hand at every position in the stream.

## How it trains

- Precision is `bf16-true` on any Ampere-or-newer GPU, fp32 below ([`common.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/common.py)). Half the memory, the same read.
- AdamW, weight decay 0.20, learning rate 6e-4.
- The [`optim.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/optim.py) schedule is linear warmup into cosine decay, keyed to a wall-clock budget. Short runs and long runs warm and cool in proportion.
- Evaluation runs on an EMA of the weights, decay 0.99. Smoother numbers, better checkpoints.
- One number decides keep or discard: `val/mrr` ([`metrics.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/metrics.py)). Sort the 1,326, take one over the truth's rank.
- It rewards shoving the truth to the very top, which is what a read is for. Loss and mean rank only reward lifting it off the bottom.
- A blind guess scores 0.0059. We keep runs that clear it threefold.

## Re-reading the mind at every street

- The model re-emits its belief at every position after the mask, not once at the end. One hand supervises it at every street.
- The two masks that define the supervised window live in [`data.py`](https://github.com/Otter-Crew/range-reader/blob/master/range_reader/data.py).
- The window opens the moment the seat is named, at `<predict_hole>`. Before that, the model has not been told whom to read.
- It closes when the villain folds - a folded hand tells you nothing more. A showdown holds it open to the river.
- The target never moves inside the window. The same hidden hand, scored again as more betting lands. The loss trains a trajectory.
- This is the part that feels like mind reading. Follow one showdown hand and the truth climbs.
- Inspect it on a single hand with [`scripts/query.py`](https://github.com/Otter-Crew/range-reader/blob/master/scripts/query.py). The read sharpens as the player commits.

## Next time

- The decoder is stock. The embedding is not. Part 10 opens it - seat, position, table size, card identity, and bet size, each a poker concept summed into one vector.
- Hole cards are composed from card vectors, not looked up. Bet sizes enter as real numbers, never chopped into tokens.
