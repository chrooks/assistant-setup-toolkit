# sync-self reference — allow-list & redaction rules

This is the privacy [Boundary](~/.codex/LEXICON.md) for the self-profile. The profile is
installed into every harness and (in the Codex case) inlined into `AGENTS.md`, so what
crosses this boundary matters. When in doubt, leave it out — the brain is one query away.

## Read allow-list (read ONLY these)

The `selfPages` entries from `~/.codex/knowledge-config.json`, resolved under
`<vaultPath>/<wikiDir>/`. A typical allow-list holds four pages:

- an identity page — identity, day job, background
- a trajectory page — North Star, sequence, direction
- `learning-goals.md`
- `values.md`

## The allow-list is the binding guard

Read only the allowed pages. Anything outside them is out of scope regardless of where
it lives — so a sensitive note filed in the wiki root is excluded by default, not by luck.

**Do not follow `[[wikilinks]]`.** The allowed pages embed links to other pages (faith,
inner life, monthly journal notes, and so on). Treat every `[[...]]` as opaque text and
never open the target. Chasing wikilinks is the main way the allow-list leaks.

## Never read (belt-and-suspenders for if the allow-list is bypassed)

- Anything under any `_SENSITIVE/` path (therapy, health) — hard rule, no exceptions.
- Monthly journal notes: `jan-2026-notes.md`, `feb-…`, `mar-…`, `apr-…`, `may-…`, etc.
- Personal, taste, and creative pages: inner life, faith, aspirations, backlog,
  songwriting, creative projects, gaming, music taste, sports takes, and the like.

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

Categories, not a filled-in answer. This spec lives in a public repository, so it names
*what to look for* in the source pages — the pages themselves supply the content.

- **Identity:** self-description of craft and medium, who the work is for, field of study.
- **Trajectory:** the long-term goal, the sequence toward it, current main project,
  breadth versus specialization.
- **How they work and learn:** working method with assistants, how they learn new
  material, goal-setting cadence, the skills they are actively building.
- **Values:** what software should do for people, what they build against, whose stories
  they want told, and a pointer to the Lexicon (`~/.codex/LEXICON.md`) for the design
  ethos — do not duplicate it.
- **Communication:** prose register, Lexicon discipline, and how they prefer work sized.

The same rule as the redact list applies in reverse: keep the *shape* here and let the
allow-listed pages carry the specifics. A worked example belongs in the shipped
`PROFILE.md`, which is gitignored, never in this spec.

## Output shape

Five sections: **Who they are · North Star and trajectory · How they work and learn · Values and
how to advise them · How to communicate with them.** Roughly 35–80 lines.
