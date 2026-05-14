---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable issues on the project issue tracker using tracer-bullet vertical slices. Use when user wants to convert a plan into issues, create implementation tickets, or break down work into issues.
---

# To Issues

Break a plan into independently-grabbable issues using vertical slices (tracer bullets).

The issue tracker and triage label vocabulary should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

### 3. Run existing issue pass

Before drafting new issues, inspect the issue tracker for preexisting issues that may overlap, block, or depend on the incoming tasks.

Use the issue tracker commands from the project guidance. Prefer a broad issue list first, then fetch full bodies/comments for likely matches. Include open and recently closed issues when prior work may already cover the task.

For each incoming task, decide whether it is:

- **New issue**: distinct work that should get its own issue.
- **Roll into existing issue**: better as an acceptance criterion, checklist item, or comment on an existing issue.
- **Duplicate / already covered**: no new issue needed unless the existing issue needs clarification.
- **Blocked by existing issue**: cannot start until an existing issue lands.
- **Blocks existing issue**: an existing issue should wait for this work.
- **Related only**: context worth referencing, but not a dependency.
- **Conflicts / supersedes**: the proposed task changes direction from an existing issue and needs human approval.

Use exact issue references (`#123`) whenever available. If the tracker has no relevant issues, say that explicitly.

### 4. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

When a task should roll into an existing issue, do not draft it as a new issue by default. Instead, include it in the proposal as a roll-in target and ask the user whether to add a comment/checklist update to that issue.

### 5. Show dependency chart

Before asking for approval, show a compact dependency chart that includes:

- proposed new issues
- relevant existing issues
- roll-in targets
- blocking relationships
- non-blocking related relationships when useful

Use a readable text chart by default:

```text
#9 Existing blocker
└─ New: Retune Skill Tier values

#12 Existing related issue
↔ New: Player Archetypes

Roll into #11
└─ Task: Add landing-page status card
```

Use Mermaid only when the user's surface is likely to render it well. Keep labels short.

### 6. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **Existing issue relation**: duplicate, roll-in target, blocked by, blocks, related, or none
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any task roll into an existing issue instead of becoming a new issue?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 7. Publish the issues to the issue tracker

For each approved slice, publish a new issue to the issue tracker. Use the issue body template below. These issues are considered ready for AFK agents, so publish them with the correct triage label unless instructed otherwise.

Publish issues in dependency order (blockers first) so you can reference real issue identifiers in the "Blocked by" field.

For approved roll-ins, do not create a new issue. Add a comment to the target issue with the agreed checklist item(s), or summarize the update for the user if tracker mutation was not requested.

<issue-template>
## Parent

A reference to the parent issue on the issue tracker (if the source was an existing issue, otherwise omit this section).

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- A reference to the blocking ticket (if any)

Or "None - can start immediately" if no blockers.

## Related issues

- A reference to related, blocked, blocking, or superseded tickets (if any)

Omit this section if there are no related issues beyond "Blocked by".

</issue-template>

Do NOT close or modify any parent issue.
