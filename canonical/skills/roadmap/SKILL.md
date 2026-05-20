---
name: roadmap
description: Choose, prioritize, sequence, and reshape issue-tracker work across open issues, sub-issues, Projects, milestones, labels, priorities, and blockers. Use when deciding what to pick up next, reviewing a Kanban board, milestone, roadmap, or backlog, triaging blocked work, or choosing between open issue records.
argument-hint: "[next|board|milestone|blocked|reprioritize] [issue|milestone|project]"
disable-model-invocation: false
---

# Roadmap

Use this Skill to choose, prioritize, sequence, and reshape work. It answers "What should I pick up next?" and keeps the issue tracker, Project board, milestones, priorities, and blockers coherent.

## Boundary

- `/roadmap` chooses, prioritizes, sequences, and reshapes work.
- `/to-issues` creates, updates, and closes issue records.
- `/scope` decides whether to execute, plan, or grill.

Do not create new issue records from `/roadmap`. If new work needs to be captured, recommend `/to-issues` with the exact source or target issue.

## Invocation forms

Parse arguments positionally from the user's invocation.

- `/roadmap` or `/roadmap next` -> recommend the next issue record to pick up.
- `/roadmap board [project]` -> review Kanban or Project status and suggest board moves.
- `/roadmap milestone <milestone>` -> review milestone health, priority, risk, and next slices.
- `/roadmap blocked` -> identify blocked work, missing dependencies, and unblock steps.
- `/roadmap reprioritize [scope]` -> propose priority, milestone, status, or dependency changes.

If the user asks "what should I pick up next?", "what is the next slice?", "what should move next?", or "what is highest priority?", infer `/roadmap next`.

## Process

### 1. Gather source-of-truth context

Read the project `CONTEXT.md` first when present, then the repo-local project-flow docs:

- `docs/agents/project-flow.md`
- `docs/agents/issue-tracker.md`
- `docs/agents/triage-labels.md`

If these docs are missing, recommend `/project-flow-setup audit` or `/project-flow-setup docs` before ranking work unless the user asks for a one-off answer. Then read any additional project planning docs or active ExecPlans.

Use live issue-tracker data when available. For GitHub-backed repos, prefer `gh` commands from the project guidance. Inspect open issues, recently closed issues when relevant, milestones, Project items, labels, assignees, blockers, parent/sub-issue relationships, and pull requests.

If the user named a specific Project, milestone, label, issue, or board column, scope the lookup there first.

### 2. Build the work map

Group work by:

- ready now
- in progress
- blocked
- needs scope or product decision
- dependency chain continuation
- milestone-critical
- stale, duplicate, or likely closeable

Track useful metadata:

- issue reference and title
- parent issue and sub-issue progress
- milestone
- Project status or Kanban column
- priority field or priority label
- blocker and blocked-by links
- recency and verification status
- expected next workflow: `/execute`, `/scope`, `/to-issues update`, or `/to-issues close`

### 3. Rank next candidates

Prefer work that is:

- unblocked and ready to execute
- part of an active dependency chain
- high priority or milestone-critical
- small enough to complete as a Vertical Slice
- already well specified with acceptance criteria
- likely to reduce uncertainty or unblock more work

Deprioritize work that is blocked, stale without evidence, too broad, missing acceptance criteria, or better handled by `/scope` first.

### 4. Recommend the next move

Answer with a short ranked list. For each candidate, include:

- **Issue**: rich issue reference
- **Why now**: priority, dependency, milestone, or risk reason
- **Next workflow**: `/execute`, `/scope`, `/to-issues update`, or `/to-issues close`
- **Confidence**: high, medium, or low
- **Caveat**: only if there is a real blocker or assumption

Always include one clear recommendation at the top. If nothing is ready, recommend the smallest unblock step.

### 5. Propose reshape actions

When board, milestone, or reprioritization changes would help, present them as proposed changes and wait for approval before mutating the issue tracker.

Useful reshape actions include:

- move issue records between Kanban columns
- set or change priority fields
- add or change milestones
- mark blockers or related issues
- move work into a parent/sub-issue hierarchy
- add comments that explain sequencing
- identify issue records that should be closed through `/to-issues close`

Do not mutate the issue tracker unless the user approves the proposed changes.

## Output shapes

### Next work

```
Recommended next:
- Issue: [#123 Short title](https://tracker/issue/123)
- Why now: unblocked P1 work that continues the active milestone dependency chain.
- Next workflow: `/execute #123`
- Confidence: high
```

### Board or milestone review

```
Board read:
- Ready: 3 issue records, 1 high-priority candidate
- Blocked: 2 issue records, both waiting on #120
- At risk: Milestone Beta has 4 open issue records and 1 unclear dependency

Proposed changes:
- Move #123 from Backlog to Ready.
- Add #125 to Milestone Beta.
- Ask `/to-issues update #126` to split the vague follow-up into sub-issues.
```

## Rules

- Use the project's Lexicon terms from `CONTEXT.md`.
- Prefer live issue-tracker truth over memory or stale summaries.
- Keep recommendations grounded in visible issue records, milestones, Project fields, and blockers.
- Do not create new issue records.
- Do not close issue records. Route closures through `/to-issues close`.
- Do not run implementation. Route ready work through `/execute`.
- Do not overfit to priority alone; include dependency and milestone context.
