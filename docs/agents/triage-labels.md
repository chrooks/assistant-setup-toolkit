# Triage Labels

This repository uses labels for taxonomy and GitHub Project fields for status, priority, size, and execution mode.

Project commands may require the GitHub CLI project scope:

```bash
gh auth refresh -s project
```

## Project Fields

Recommended Project fields:

```text
Status: Inbox, Backlog, Ready, In Progress, Blocked, Review, Done
Priority: P0, P1, P2, P3
Size: XS, S, M, L
Mode: AFK, HITL
```

Use fields this way:

- Status tracks where an issue record sits on the board.
- Priority tracks relative urgency and importance.
- Size tracks expected implementation effort.
- Mode tracks whether work is safe for autonomous execution or needs human interaction.

## Status

- Inbox: captured, not yet triaged.
- Backlog: valid work, not ready to start.
- Ready: clear, unblocked, and executable.
- In Progress: actively being implemented.
- Blocked: waiting on a dependency, decision, access, or external event.
- Review: implemented and awaiting review, PR prep, or final verification.
- Done: complete and closed with verification evidence.

## Priority

- P0: urgent, correctness or release blocking.
- P1: high-value work that should be pulled soon.
- P2: useful work with no immediate deadline.
- P3: opportunistic cleanup or low-priority improvement.

## Size

- XS: small, isolated change.
- S: one focused Vertical Slice.
- M: a few coordinated files or one moderate workflow.
- L: broad work that probably needs Sub-issues.

## Mode

- AFK: an agent can execute after reading the issue record and repo docs.
- HITL: requires human input, design review, product choice, credentials, or manual decision.

## Labels

Recommended label families:

- `type:feature`
- `type:bug`
- `type:docs`
- `type:refactor`
- `type:test`
- `needs-scope`
- `needs-decision`
- `blocked`

Prefer Project fields over labels for priority and status when a Project is available. Labels should help filtering and routing, not become a second board.
## One category, one state

Labels split into two families, and an issue record carries **exactly one
category** and **at most one state**:

- **Category** — `type:feature`, `type:bug`, `type:docs`, `type:refactor`,
  `type:test`. Exactly one. Zero means the record was never classified; two
  means nobody decided what it is.
- **State** — `needs-scope`, `needs-decision`, `blocked`. At most one, because
  they are mutually exclusive claims about what the record is waiting on. An
  issue that is both `blocked` and `needs-decision` is telling two stories.

Skills that read the tracker (`/roadmap`, `/to-issues`) **flag a violation and
ask** rather than proceeding on a guess. A silent pick is how a record with two
states gets ranked as though it had one.

Readiness is a Project `Status`, not a label — `/scope` sets `Status: Ready`
once it stamps a clean verdict, so the board reflects a judgement that was
otherwise stranded in local working state.

