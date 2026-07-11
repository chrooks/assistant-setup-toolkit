---
name: loop-audit
description: Mine the Claude Code history archive on hestia for recurring human guidance — corrections and instructions Chris has had to give more than once — and turn each approved finding into a drafted (never auto-applied) toolkit change. Use at 12-week cycle boundaries, when the user invokes /loop-audit, or asks to audit his loops / interventions / ways of working.
user-invocable: true
---

# Loop Audit

Analyze the cross-device Claude Code history archive for **recurring human
guidance** — anything Chris has had to say to the harness more than once, in one
session or across many — and convert each finding he approves into a drafted
harness change. The goal is loop engineering: fewer interventions per unit of
shipped work, cycle over cycle.

Design record: `feature_requests/loop-audit-design-frame.md` and
`feature_requests/loop-audit-plan.md` in the toolkit repo.

## Boundaries (non-negotiable)

- The archive at `/srv/claude-history/` is **read-only input**.
- Draft fixes; **never apply them**. No file outside `artifacts/loop-audit/`
  changes without Chris approving that specific change. Applying an approved
  draft happens through the normal commit flow, as a separate explicit step.
- Approval is **per finding** — never offer "apply all".

## Process

### Step 1 — Guard

Verify `/srv/claude-history` exists. If it does not, stop: this skill runs on
hestia only, where the archive lives. Say so and name the runbook (hearth
`docs/runbooks/15-claude-history-collection.md`).

### Step 2 — Extract

From the toolkit repo (`~/projects/toolkit`), run:

    npm run loop-audit:extract

Note the printed stats (transcripts scanned/in-window, turns kept, sessions,
per-device counts) — they become the report's Coverage section verbatim. The
corpus lands at `artifacts/loop-audit/corpus.jsonl`, one JSON object per human
turn: `device`, `project`, `sessionId`, `timestamp`, `cwd`, `gitBranch`, `text`.
Default window is 84 days; pass `-- --days N` to override when Chris asks.

### Step 3 — Detect

Read the corpus in chunks (group by project; a chunk of a few hundred turns per
read is fine — the whole corpus is only a few thousand turns). Cluster turns
that express the **same guidance said more than once**. What counts:

- Mid-session corrections ("no, use the shared helper", "stop, that's the
  wrong file") that recur in kind across sessions.
- The same instruction, preference, or reminder given in multiple sessions or
  projects.

What does NOT count — discard, don't report:

- Voice-transcription self-corrections ("actually wait, scratch that").
- One-off task instructions (the normal content of the work itself).
- Repeated *skill invocations* — workflow mechanics, not guidance (the
  extractor already drops most of this).
- Anything already codified in CLAUDE.md, the rules, or a memory — check
  before reporting; a fix that already shipped is not a finding.
- Findings rejected in a prior run — read earlier reports in
  `artifacts/loop-audit/` and discard clusters recorded there as rejected.

Accumulate candidate clusters across chunk reads, then rank once at the end.

Rank clusters by (occurrence count × breadth across projects/devices) and keep
the top **five at most**. Fewer honest findings beat five padded ones.

### Step 4 — Report

Write `artifacts/loop-audit/<YYYY-MM-DD>-report.md` with exactly these
sections, then present it conversationally:

- `## Coverage` — the extraction stats verbatim, plus the window dates. Never
  understate what was skipped.
- `## Baseline` — human turns per session (turns ÷ sessions), overall and per
  device. The CLI stats only give the overall session count; compute per-device
  sessions from distinct `device`+`sessionId` pairs in the corpus. This is the
  cycle-over-cycle trend metric; name the previous report's number when one
  exists in `artifacts/loop-audit/`.
- `## Findings` — for each: a one-line statement of the recurring guidance,
  the occurrence count, the devices/projects it spans, **at least two quoted
  turns** with their transcript paths
  (`/srv/claude-history/<device>/projects/<project>/<sessionId>.jsonl`), and
  the proposed fix-shape (rule / memory / skill edit / hook).

### Step 5 — Approval loop

Walk findings one at a time. For each one Chris approves, draft the concrete
change — a diff to `canonical/` or a memory-file draft — and include an
approximate recurring context cost line: `~N tokens recurring cost` where
N = ceil(characters ÷ 4), labeled approximate. Present the draft; do not write
it into the tree unless Chris explicitly says to apply it. For each finding he
rejects, note the rejection in the report so future runs don't re-raise it.

### Step 6 — Close

Restate what was drafted vs. applied, and that applying goes through the
normal commit flow. A **shrinking findings list across cycles is success** —
report that trend when visible, not just the findings.
