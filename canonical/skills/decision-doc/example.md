# Example — a threshold rule for one rated skill

Abridged from a real decision document (an NBA skill-rating engine, 2025-26 season). The reader approved it with "1, 2, park 3". Section numbers match the Skill's section order.

---

# Spot Up Shooter — the stat rule, and what it costs

**Your decisions: three, listed first. Everything below them is the evidence.**
Every number here was measured read-only against the 392 players in the rating pool, using the production evaluator.

| # | Decision | My recommendation |
|---|---|---|
| 1 | The tier ladder and the Elite volume floor | Capable ≥ .36 on 2.0+ attempts · **Proficient ≥ .38 on 2.5+** · Elite ≥ .40 on **2.5+** (today 3.0) |
| 2 | The spot-up PPP bump | Keep it, but raise it from 1.05 to **1.17** (the top quarter) and cap it at **Proficient** |
| 3 | Stabilize toward each player's own career 3P% (an add) | **Park** it; about one session; it does not rescue the anchors by itself |

Reply with the row numbers you accept, or the cut you want changed. "1, 2, park 3" is a complete answer.

---

## What the rule asks, in plain words

**Does he make catch-and-shoot threes?** — `catch_shoot_fg3_pct`, stabilized.
His catch-and-shoot three-point percentage, padded with 100 league-average attempts (.359). Padding pulls a short sample toward the middle: Luke Kennard's .487 on 203 attempts becomes .445; Klay Thompson's .389 on 393 becomes .383.

**Does he take enough of them?** — `catch_shoot_fg3a` per game.

**Does the possession pay off?** — `spotup_ppp`, points per spot-up possession. Today, 1.05 or better lifts a player one tier.

## What the stored rule does today

**It has no Proficient tier.** Proficient exists only as "Capable plus the bump".

**The bump is not a borderline bonus.** The median spot-up PPP is 1.063, so 1.05 fires for 137 of 246 qualifying shooters (56%). 13 players who shoot under .36 are Capable on the bump alone: Embiid, Porziņģis, Randle, Poole, …

**The Elite volume floor (3.0 a game) keeps out six .40+ shooters** who take 2.5–2.9: Kennard, Bane, Monk, Murray, Sexton, Watson.

## The distribution, among the 246 who pass the gate

| stat | p10 | p25 | p50 | p75 | p90 | max |
|---|---|---|---|---|---|---|
| C&S 3P%, stabilized | .335 | .351 | .372 | .389 | .406 | .445 |
| spot-up PPP | 0.91 | 0.99 | 1.06 | 1.17 | 1.24 | 1.56 |

Read as percentiles: Capable = the top 65% (.36 ≈ p35), Proficient = the top 37% (.38 ≈ p63), Elite = the top 15% (.40 ≈ p85).

## The options, measured

| option | ladder | bump | Elite | Proficient | Capable | None |
|---|---|---|---|---|---|---|
| **today** | .36 · — · .40/3.0 | 1.05, up to Elite | 25 | 99 | 50 | 218 |
| small change | .36 · .38 · .40/2.5 | 1.05, cap Proficient | 31 | 100 | 43 | 218 |
| **recommended** | .36 · .38 · .40/2.5 | **1.17, cap Proficient** | 31 | 65 | 66 | 230 |

| player | today | small change | **recommended** |
|---|---|---|---|
| Duncan Robinson | Elite | Elite | Elite |
| Desmond Bane | Proficient | Elite | **Elite** |
| Klay Thompson | Proficient | Proficient | Proficient |
| Khris Middleton | None | None | None |

**What the recommendation moves (59 of 392):**
- Proficient → Capable, 35: the bump no longer lifts a .36–.38 shooter at median PPP. Tobias Harris, Jaren Jackson Jr., Karl-Anthony Towns, … and 32 more.
- Capable → None, 12: the sub-.36 shooters the bump was carrying.
- To Elite, 6: Bane, Kennard, Monk, Murray, Sexton, Watson.

## Earlier hand-set tiers are not a yardstick here

Every option agrees with the 91 earlier hand-set tiers within one tier on 81–82 of them. They cannot separate the options.

## The add: stabilize toward the player's own history

The data is already stored (career attempts before this season). It moves low-volume shooters most: Klay goes from .383 to .394, still under .40. An evaluator change, about one session. Recommend: park it.

## What happens when you answer

1. I stage the chosen rule, read-only until commit.
2. I post the staged diff. You say "commit".
3. **Leave the review queue alone until the commit lands** (a few minutes).

## Caveats

- One regular season, no postseason. Every cut is calibrated to this season alone.
