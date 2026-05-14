# Local TODO.md Format

Use this format for project-root `TODO.md` when `/to-issues local` is active.

## Rules

- Keep each TODO brief: title under 80 characters, What to Build at 1-2 short sentences, and Acceptance Criteria at 2-5 items.
- Preserve user-written content outside the generated block.
- Replace only content between `<!-- to-issues:begin -->` and `<!-- to-issues:end -->`.
- Put In Progress and Outstanding TODOs at the top.
- Put Completed TODOs in the Historical Log at the bottom with only title, completed datetime, and completed Acceptance Criteria.
- Use exact checkbox notation: `[ ]` for outstanding, `[~]` for in progress, `[X]` for completed.
- Start every TODO and Acceptance Criteria item with `- [ ]`, `- [~]`, or `- [X]`.
- Use 2-space indents for fields under a TODO.
- Delimit TODO entries with `---` on its own line.
- Use repeatable field names exactly for In Progress and Outstanding TODOs: Type, Status, Blocked By, Existing Work Relation, Decision, Source.
- Keep Completed TODOs compact: inline the completed datetime on the title line and list completed Acceptance Criteria underneath.

## Status Values

- `[ ]` means Status: Outstanding.
- `[~]` means Status: In Progress.
- `[X]` means Status: Completed.

## Existing Work Relation Values

- None
- Duplicate
- Roll-In Target
- Blocked By
- Blocks
- Related
- Conflicts
- Supersedes

## TODO.md Shape

```md
# TODO

## To Issues

<!-- to-issues:begin -->

## In Progress / Outstanding TODOs

- [~] Short in-progress TODO title
  - Type: AFK
  - Status: In Progress
  - Blocked By: None - can continue immediately
  - Existing Work Relation: Related to existing TODO title
  - Decision: Continue current direction.
  - Source: Brief source reference, if available.

  #### What to Build

  Build the narrow end-to-end behavior needed for this TODO.

  #### Acceptance Criteria

  - [ ] Observable criterion
  - [ ] Verification command or manual check passes

---

- [ ] Short outstanding TODO title
  - Type: HITL
  - Status: Outstanding
  - Blocked By: Short in-progress TODO title
  - Existing Work Relation: Blocks existing TODO title
  - Decision: Needs human decision before implementation.
  - Source: Brief source reference, if available.

  #### What to Build

  Decide the narrow behavior or policy needed before implementation can start.

  #### Acceptance Criteria

  - [ ] Decision is recorded in this TODO
  - [ ] Follow-up AFK TODO is unblocked or updated

## Completed TODO Historical Log

- [X] Short completed TODO title - 2026-05-14 2:30 EST
  - [X] Observable criterion passed
  - [X] Verification command or manual check passed

<!-- to-issues:end -->
```
