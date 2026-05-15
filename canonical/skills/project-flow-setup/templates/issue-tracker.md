# Issue Tracker

This repository treats GitHub issues as Issue records: the durable work items that `/to-issues`, `/roadmap`, `/execute`, and `/verification-loop` coordinate around.

## Issue Records

An issue record should describe one Vertical Slice that can be implemented and verified on its own. Prefer small issue records with clear acceptance criteria over broad tracking issues.

Use issue records for:

- Planned implementation slices.
- Follow-up work discovered during execution.
- Bug fixes with verification evidence.
- Parent issues that coordinate a group of Sub-issues.

## Sub-Issues

Use Sub-issues when a parent issue is too broad to execute directly.

Preferred behavior:

- Use native GitHub sub-issues when the repo has a proven `gh` command or documented process for them.
- If native sub-issues are unavailable, create normal issue records with a `Parent` section.
- Add a Parent issue comment that links the child issue records and explains the relationship.

Fallback child issue body:

```markdown
## Parent

Parent: #123 Parent issue title

## What to build

One narrow Vertical Slice.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

None - can start immediately.
```

## Verified Closure

Verified closure means the issue record has proof before it is closed.

Do not close issue records just because code changed.

Before closing, record verification evidence in a comment, then run:

```bash
gh issue close <issue-number> --comment "Verified with: <command or manual check>"
```

Good closure evidence includes:

- Test command and passing result.
- Typecheck or lint command and passing result.
- Manual browser smoke check.
- Commit, PR, release, or deploy reference.

Close parent issues only when the parent acceptance criteria are complete, not merely when Sub-issues exist.

## Update Rules

Use `/to-issues update <issue>` when:

- Acceptance criteria changed.
- A follow-up slice should be added as a checklist item or comment.
- A task should roll into an existing issue instead of becoming a new issue record.
- Metadata such as milestone, label, priority, Project field, blocker, or related issue needs to change.

Use `/to-issues close <issue>` when:

- The work is complete.
- Verification evidence is present.
- The closing comment can name the proof.

## GitHub CLI

Useful read commands:

```bash
gh issue list --state open --limit 100
gh issue view <issue-number> --comments
gh issue list --state closed --limit 30
```

Useful mutation commands after approval:

```bash
gh issue create --title "<title>" --body-file <file>
gh issue edit <issue-number> --add-label "<label>"
gh issue comment <issue-number> --body "<comment>"
gh issue close <issue-number> --comment "<verification evidence>"
```

Project commands usually need the `project` auth scope:

```bash
gh auth refresh -s project
```
