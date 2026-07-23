# Throughline template

This file is the template the `/dev` Conductor copies when it creates a new
Throughline. A Throughline is the durable on-disk control file for one piece of
work: it records where the work sits in its lifecycle and survives conversation
compaction. Instances live in the **target project** at
`feature_requests/<slug>-throughline.md`, never in this toolkit.

When creating an instance, copy everything below the line, replace the
`<...>` placeholders, drop fields you cannot fill yet (the Conductor fills them
as stages run), and keep the inline `#` comments only if useful — they are not
required by any parser.

---

---
devos_version: 2                 # template/contract version; bump only on a breaking field change
project: <project-name>          # the target project directory name, e.g. chrooked-pokedex
issue: <issue-number-or-null>    # tracker issue this work maps to, or null for ad-hoc work
slug: <kebab-slug>               # short identifier; also names the file: <slug>-throughline.md
stage: kickoff                   # kickoff|scope|grill|plan|implement|prove|assess|close
autonomy: gated                  # gated|afk — gated stops at every gate; afk auto-advances mechanical gates, halts only at a design decision, assess, or failure
grillable: null                  # true|false|null — scope stamps this
tier: null                       # light|heavy|null — scope emits this
effort: null                     # low|medium|high|null — scope emits this
bounces: 0                       # assess back-edge counter; soft threshold 3 → Conductor escalates
next_action: /scope              # the explicit next command the Conductor should run
acceptance_criteria: []          # filled at plan; each entry: {id, statement, proof_method, status}
                                 #   id: ac1, ac2, ...
                                 #   statement: human-readable behavior to prove
                                 #   proof_method: how prove-it will check it (e.g. "playwright: type query, assert row count drops")
                                 #   status: pending|pass|fail|needs-human
status: in_progress              # in_progress|done|abandoned
---

## Decision Ledger

Grill appends one entry per resolved Meaningful Decision: the question, the
choice, and a one-line rationale. This is the running record of why the work is
shaped the way it is.

## Plan Walkthrough

Plan writes the human-facing walkthrough here: the approach, the acceptance
criteria with their proof methods, and anything the human approved.

## Work Log

The Conductor writes the `files_changed` from each dispatched work sub-agent
here — one dated line per implement or prove pass, listing the paths touched.
This is the running record of what changed, kept separate from the proof
evidence below. Example shape:

- 2026-06-14 implement — src/table/controls.tsx, src/table/useSort.ts

## Proof Ledger

prove-it writes one line per acceptance criterion: the id, the statement, a
proposed status, and the concrete evidence. The human renders the final verdict
in the assess stage. Example shape:

- ac1 search filters rows — PASS — playwright: typed "char", rows 1010 -> 6

## Assessment Log

The Conductor writes one dated entry per assessment verdict at the assess
stage: which ACs the human passed, which bounced back, the human's reason, and
the resulting `bounces` count. This is the durable trail the loop guard quotes
when work gets stuck. Example shape:

- 2026-06-15 assess — passed ac1, ac2; bounced ac3 ("sort wrong on ties") — bounces now 1
