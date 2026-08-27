---
name: chrisify
description: Rewrite or draft prose in Chris's own voice, built from stylometric analysis of his authentic college writing (2019-2023). Use when the user says "chrisify this", "make this sound like me", "write this in my voice", "my voice", or wants AI-drafted prose to read as Chris rather than as a chatbot. Supports three registers — essay, speech, journal — plus a verify mode that measures a draft against his profile.
argument-hint: "<text-or-file> [essay|speech|journal] | verify <file> | rebuild"
upstream:
  repo: https://github.com/Hiro-Inagawa/write-like-me
  ref: 3878d9dbfb57a28ea414c891623b57612b6e1734
  license: MIT
  harvested: scripts/, references/, templates/, pipeline design
---

# Chrisify

Make prose read like Chris actually writes. The voice profile was measured from
~47k words of his authentic pre-ChatGPT college writing, mined into rules he
reviewed and approved, and is stored in `voices/chris/`.

Engine harvested from [write-like-me](https://github.com/Hiro-Inagawa/write-like-me)
(MIT — see `LICENSE-write-like-me`). Chrisify additions: Opinion DNA from the
brain's self-pages, per-register targets, and composition with the installed
`stop-slop` + `humanizer` skills.

## Apply mode (default)

Given text to write or rewrite:

1. Read `voices/chris/01-generative.md` — rules, register targets, exemplars.
2. Read `voices/chris/03-opinion-dna.md` — stances the writing argues from.
3. Pick the register: `essay` (default for formal/published prose), `speech`
   (spoken word, direct address), `journal` (personal reflection). The user can
   name one; otherwise infer from the destination and say which you picked.
4. Draft or rewrite. Hit the register's quantitative targets — they are targets,
   not vibes.
5. Scan against `voices/chris/02-corrective.md`. Fix every violation.
6. Then apply the `stop-slop` skill's rules (and `humanizer` for longer pieces)
   for the generic anti-AI pass — chrisify carries no duplicate ban list.
   Where a generic rule conflicts with the profile (e.g. stop-slop's "no em
   dashes" vs Chris's measured 1.4/1000w), **the profile wins**.

## Verify mode

`chrisify verify <file>` — falsifiable check of a draft:

```bash
python3 scripts/stylometry.py <file> --register candidate --output /tmp/candidate.json
python3 scripts/verify_voice.py /tmp/candidate.json voices/chris/measurements/clean-<register>.json
```

Reports each check pass/fail per `references/07-verification.md`. With
`faststylometry` installed it also prints a Burrows' Delta distance between the
draft and the corpus (lower = closer; ≲1.0 is a strong match for short texts).

## Rebuild mode

`chrisify rebuild` — re-run the pipeline when the corpus grows (new authentic
writing lands in `~/Documents/college-writing-corpus/` or a successor corpus):
re-measure per register (`scripts/stylometry.py`), re-mine rules per
`references/04-rule-mining.md`, and **stop for Chris's review** before touching
`voices/chris/` — the mined rules are taste, and taste is his side of the
Division of Responsibility. Refresh `03-opinion-dna.md` from the brain's
values/identity pages in the same pass.

## Boundaries

- Chris's voice only, for Chris's own use. Never build profiles of other people
  from writing they did not consent to analyze (`references/` covers ethics).
- The profile is calibrated to the three measured registers; flag drafts far
  outside them (poetry, legal docs) rather than forcing the targets.
