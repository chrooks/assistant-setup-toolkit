---
name: sync-self
description: "Re-distill Chris's self-profile from the brain into the toolkit's canonical/PROFILE.md — read only the allow-listed self-pages, distill the lean professional core, diff against the current profile, and write only on explicit approval. Use when the user says \"sync self\", \"refresh my profile\", \"update PROFILE.md\", or after meaningful changes to the brain's self-pages."
disable-model-invocation: false
---

# Sync Self

Keep the always-on self-profile fresh. The brain (the LLM-Wiki knowledge base) is the
source of truth for who Chris is; the toolkit's `canonical/PROFILE.md` is a distilled,
lean projection of it that the Setup Wizard installs into every harness. This skill is the
**inverse of `sync-projects`**: it reads the brain and regenerates the profile.

`canonical/PROFILE.md` is **gitignored and local-only** — it may hold detail that must
never enter the toolkit's git history. So this skill enforces a privacy [Boundary](~/.codex/CONTEXT.md)
and **never writes without explicit approval**. The full allow-list and redaction rules live
in `reference.md` next to this file — read it before distilling.

## Step 0 — Resolve paths

Read `~/.codex/knowledge-config.json` for `vaultPath` and `wikiDir`, and for `profileTarget`
(the absolute path to the toolkit's `canonical/PROFILE.md`).

```bash
cat ~/.codex/knowledge-config.json
```

If `profileTarget` is missing, ask the user for the path to their toolkit's
`canonical/PROFILE.md` before continuing. Do not guess.

## Step 1 — Read ONLY the allow-listed self-pages

Read exactly these four pages under `<vaultPath>/<wikiDir>/` and nothing else:

- `chris.md` — identity, day job (generalized), background
- `chris-trajectory.md` — North Star, sequence, builder-with-range
- `learning-goals.md` — what he's learning, recurring interests
- `values.md` — values and the design ethos (points at the Lexicon)

**The allow-list is the binding guard.** Read those four files and nothing else — whatever
lives outside them is out of scope no matter where it sits. Two reinforcing rules:

- **Do not follow `[[wikilinks]]`.** The allowed pages link to other pages (e.g.
  `[[chris-faith]]`, `[[chris-inner-life]]`, `[[jan-2026-notes]]`). Treat every `[[...]]` as
  opaque text — never open the page it points to. Chasing links is how the allow-list leaks.
- **Never read anything under a `_SENSITIVE/` path** (therapy, health) — belt-and-suspenders
  for if the allow-list is ever bypassed. Also never read the monthly notes or the
  taste/creative/personal pages.

If an allowed page mentions sensitive detail inline, do not carry it forward. See
`reference.md` for the complete allow-list, never-read list, and redaction rules.

## Step 2 — Distill the lean professional core

Produce a candidate profile in the same shape as the current `profileTarget`:
**Who he is · North Star and trajectory · How he works and learns · Values and how to advise
him · How to communicate with him.**

Apply the redaction rules from `reference.md`. In particular: **no employer name, no specific
company name** anywhere; no health, financial, family, faith, or taste detail; and reference
the Lexicon (`~/.codex/CONTEXT.md`) for the design ethos rather than re-deriving it. **Do not
enumerate the withheld categories in the profile** — naming what's hidden advertises its shape.
Refer to anything out of scope generically (e.g. "anything not covered here lives in the
brain, consulted on demand"), never as a list of the redacted topics. Keep it lean — roughly
35–80 lines. Higher-signal lines that change how an assistant reasons or talks
earn their place; biographical trivia does not.

## Step 3 — Diff, then write only on approval

- Read the current `profileTarget` and show the user a **diff** between it and your candidate.
- **Never write without explicit approval.** Wait for the user to accept (or `sync-self confirm`).
- **Unattended runs:** if there is no interactive approval channel (e.g. a cron/background
  run), stop after surfacing the diff and **abort without writing**. Never treat a timeout,
  silence, or no-reply as approval.
- On approval, write the candidate to `profileTarget`. After writing, do not quote or
  reproduce the raw brain-page content in any later output.

## Step 4 — Project to the harnesses

After writing, offer to push it the rest of the way:

```bash
cd <toolkit repo root> && npm run sync
```

That installs the refreshed profile into `~/.codex/PROFILE.md` and inlines it (plus the
Lexicon) into `~/.codex/AGENTS.md`.

## Scheduling

A weekly routine runs this skill in **propose-only** mode: it regenerates the candidate,
shows the diff, and notifies Chris for approval — it never writes `canonical/PROFILE.md`
unattended. Running it here on demand does the same distillation now.
