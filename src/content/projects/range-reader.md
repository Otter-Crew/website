---
title: "Range Reader"
summary: "A GPT that reads a poker player's hole cards from the way they bet - a full distribution over all 1326 starting hands, learned from hand histories alone."
year: 2026
status: "active"
role: "Author and maintainer"
link: "https://github.com/Otter-Crew/range-reader"
featured: false
order: 3
---

Range Reader treats hidden information as a translation problem. Mask the
villain's two cards, then translate the public record of a hand - who sat where,
who bet how much, what fell on the board - into a belief over the 1326 possible
Texas Hold'em starting combos. The mask is a real token in the stream, and the
model re-emits its read at every position after it, so you watch the range
narrow street by street as the chips go in.

The transformer blocks are ordinary; almost nothing around them is. Each
position is an action _and_ a chip amount, so bet sizes enter as continuous
values rather than being bucketed into tokens.

The current model ranks the true hand around 299th of 1326 on average and
scores five times the random-guessing floor on mean reciprocal rank, reading
nothing but the betting. There is a [written series](/blog) on how it was
built, from card representations up.
