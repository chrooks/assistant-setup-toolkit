# 0004 — Resource Index: canonical rule with machine-local extensions

Date: 2026-07-25
Status: accepted

## Context

Agents on any machine should always know the user's durable resources exist —
the brain, the toolkit, the Lexicon, the profile — what each is for, and how
to reach it *from here*. Access paths differ per machine (server has a local
vault clone; the work laptop may only reach the brain via claude.ai), the
repo is public, and machine rule files are local-only per ADR-0003.

## Decision

1. **One canonical, versioned Resource Index** at
   `canonical/rules/common/resource-index.md`, imported from CLAUDE.md so it
   is always in context (and inlined into Codex `AGENTS.md` by projection).
   It lists each shared resource with a fixed entry shape: what it is, what
   it's for, all known access modes, and "Local access: see machine context".
2. **Machine rule files carry the local half**: a "Resource access" section
   stating which access mode is live locally and at what path. They may also
   add **machine-local entries** — resources only that machine knows about
   (e.g. a work-only second brain) — invisible to every other machine.
3. **A versioned template** (now `canonical/machines/TEMPLATE.md` — moved with
   the machine-profile restructure, see ADR-0003 amendment 2026-07-25; was
   `canonical/rules/machines/TEMPLATE.md`,
   gitignore-excepted) is the copy source for hand-creating machine files.
   When the `machine` Variant is set but the machine file is missing on
   disk, the Setup Wizard prints a Next Steps nudge to create it.

## Consequences

- Descriptions are edited once and ship everywhere; only paths live per
  machine. A machine with no Variant still learns what exists and that
  claude.ai can reach the brain.
- Machine-scoped resources (hearth knowledge, the claude-history archive)
  live in that machine's file, not the canonical index — the public repo
  never learns about them.
- Requires the machine rule to actually load in Codex; fixed alongside this
  (see ADR-0003 amendment: projection inlines the machine-Variant rule into
  `AGENTS.md`).
- Skill routing stays in CLAUDE.md ("Right Skill, Right Job"); the index
  points at it rather than duplicating it.
