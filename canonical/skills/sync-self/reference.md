# sync-self reference — allow-list & redaction rules

This is the privacy [Boundary](~/.codex/CONTEXT.md) for the self-profile. The profile is
installed into every harness and (in the Codex case) inlined into `AGENTS.md`, so what
crosses this boundary matters. When in doubt, leave it out — the brain is one query away.

## Read allow-list (read ONLY these)

Under `<vaultPath>/<wikiDir>/`:

- `chris.md`
- `chris-trajectory.md`
- `chris-learning-goals.md`
- `chris-values.md`

## The allow-list is the binding guard

Read only the four allowed pages. Anything outside them is out of scope regardless of where
it lives — so a sensitive note filed in the wiki root is excluded by default, not by luck.

**Do not follow `[[wikilinks]]`.** The allowed pages embed links to other pages (e.g.
`[[chris-faith]]`, `[[chris-inner-life]]`, `[[jan-2026-notes]]`). Treat every `[[...]]` as
opaque text and never open the target. Chasing wikilinks is the main way the allow-list leaks.

## Never read (belt-and-suspenders for if the allow-list is bypassed)

- Anything under any `_SENSITIVE/` path (therapy, health) — hard rule, no exceptions.
- Monthly journal notes: `jan-2026-notes.md`, `feb-…`, `mar-…`, `apr-…`, `may-…`, etc.
- Personal/taste/creative pages: `chris-inner-life`, `chris-faith`, `chris-aspirations`,
  `chris-backlog`, `chris-songwriting`, `chris-creative-projects`, `chris-gaming`,
  `chris-music-taste`, `chris-basketball-takes`, `chris-pokemon-team`.

## Redact (exclude even when an allowed page mentions it)

Always redact from the distilled profile:

- **Employer name and any specific company names.** Generalize: "a large company",
  "frontier AI labs / sports organizations / consumer-tech and media companies". No real
  names — the profile is demoed at work and (for Codex) inlined into committed-adjacent files.
- **Career-sensitive internals** — any detail about internal org structure, team names,
  reporting/manager relationships, compensation, performance, promotion status, or intent to
  change roles (including "wants to leave" / "exploring opportunities" phrasing). Soften to a
  neutral direction.
- **Relationship and family** — partner names, relationship history, and interpersonal
  conflict; family member names and details.
- **Health and mental health**, and **grief**.
- **Finances** — tithes, salary, accounts, figures.
- **Faith specifics** — beliefs, church, sermon themes.
- **Taste rankings and creative writing** — music/games/basketball lists, lyrics, bucket list.

**Do not enumerate the withheld categories in the profile itself.** Naming the hidden topics
("faith, health, grief, family, taste…") advertises the shape of what's private — itself a
small leak. The profile should refer to out-of-scope material generically, e.g. "anything not
covered here lives in the brain, consulted on demand." The category list belongs here in the
spec, never in the shipped profile.

## Keep (the high-signal core)

- **Identity:** creative technologist whose medium is software; builds for people; CS major,
  African Studies minor.
- **Trajectory:** NBA front office via basketball software; the four-step sequence; current
  main project Cornerstone; builder with range.
- **How he works and learns:** vibe engineer; immersion learning; Huberman 12-week cycles;
  "allow yourself to be bad first"; communicating concepts clearly; judging assistant output;
  the recurring rabbit holes.
- **Values:** help people grow rather than depend; anti-dark-pattern; stories of the unheard;
  a pointer to the Lexicon (`~/.codex/CONTEXT.md`) for the design ethos — do not duplicate it.
- **Communication:** clean colloquial prose; strict Lexicon use; builder's incrementalism.

## Output shape

Five sections: **Who he is · North Star and trajectory · How he works and learns · Values and
how to advise him · How to communicate with him.** Roughly 35–80 lines.
