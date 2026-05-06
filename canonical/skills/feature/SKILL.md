---
name: feature
description: Full-cycle feature development: codebase discovery → clarifying questions → implementation plan → TDD subagent → code review → manual verification → commit. Run with your feature description as the argument.
argument-hint: "<description of feature to build>"
disable-model-invocation: true
---

# Feature Development Workflow

Orchestrates the complete feature development lifecycle so you only need one command. The workflow pauses at human decision points and resumes when you're ready.

## When to Activate

When the user wants to implement a non-trivial feature end-to-end.

## How to Invoke

```
/feature <description of what you want to build> [--skip-qs]
```

Example: `/feature franchise cornerstone picker — let users select their franchise player and assemble an 8-man rotation`

Pass `--skip-qs` to skip Phases 1 & 2 and go straight to plan generation.

---

## Overview of Phases

| Phase | What happens | Ends with |
|-------|-------------|-----------|
| 1. Discovery | Scan repo, generate questions, write to file | STOP — user answers questions |
| 2. Q&A Loop | Resolve follow-up questions | STOP — user confirms "continue" |
| 3. Plan | Generate implementation plan doc | STOP — user approves plan |
| 4. Implement | TDD subagent → tests pass | STOP — user manually verifies |
| 5. Bugs & Commit | Fix reported bugs, commit on approval | Done |

---

## Phase 1: Discovery & Questions

**Goal:** Surface all ambiguities before writing a single line of code.

> If the user passed `--skip-qs`, complete steps 1–3 (acknowledge, scan, derive slug), then skip directly to Phase 3. Do not write a questions file.

### Steps

1. **Acknowledge** the feature request in one sentence.

2. **Scan the repository** for context relevant to this feature:
   - Existing related files: components, routes, models, services, hooks
   - Adjacent features that share data, state, or UI
   - Patterns already established (naming, file organization, test setup, API conventions)
   - Potential conflicts, dependencies, or migration needs
   - Any user-provided reference projects or prior implementations worth borrowing from

3. **Derive a feature slug** in kebab-case from the feature name (e.g. "franchise cornerstone picker" → `franchise-cornerstone-picker`).

4. **Create the output directory** if it doesn't exist:
   ```bash
   mkdir -p feature_requests
   ```

5. **Write a questions file** to `feature_requests/<feature-slug>-questions.md`. Use this exact structure:

```markdown
# <Feature Name> — Clarifying Questions

> **Status:** Awaiting answers  
> **Feature:** <one-line description>  
> **Date:** <today's date>

Please answer each question on the line below it. For follow-up questions, just ask in the chat.

---

## 1. <Category Name>

**Q1a: <Question text>**

> Why this matters: <brief explanation of what this decision affects>

Answer: 

**Q1b: <Question text>**

Answer: 

---

## 2. <Category Name>
...
```

   Typical question categories: Data & Backend, UI & Layout, Business Logic & Edge Cases, Performance, Design & Polish, Testing Scope. Only include categories relevant to this feature.

   For each question, add "Why this matters:" context when the tradeoff isn't obvious — like the lazy-load vs. upfront-load question in the players route example.

   If the user provided a reference project or prior implementation in their prompt, include a question about how closely to mirror it and note what can be reused.

6. **Summarize** what you found during the repo scan (3–5 bullets: relevant existing files, patterns to follow, key unknowns).

7. **Tell the user:**
   > "Questions written to `feature_requests/<feature-slug>-questions.md`. Open it, fill in your answers at your own pace, then come back and type **continue** (or just ask any follow-up questions you have)."

**STOP — wait for the user to respond before doing anything else.**

---

## Phase 2: Q&A Loop

If the user asks a follow-up question or wants clarification on a question:

1. Answer the follow-up directly in the conversation.
2. Update the questions file — add a "Clarification:" note below the relevant question with your answer.
3. If the follow-up resolves a question, note that the answer is now settled.

Repeat until the user confirms all questions are answered or says "continue."

Once all questions have answers, confirm:
> "All questions answered. Ready to generate the implementation plan — type **plan** to proceed, or let me know if you want to adjust anything first."

**STOP — wait for the user.**

---

## Phase 3: Implementation Plan

**Goal:** A doc comprehensive enough that an implementation agent can work from it alone.

### Steps

1. Read the completed `feature_requests/<feature-slug>-questions.md` file.

2. Read `~/.claude/PLAN.md` for the ExecPlan skeleton and requirements. Write the plan to `feature_requests/<feature-slug>-plan.md` following that skeleton exactly. Fill in every section — do not leave placeholder text.

3. Present a **brief summary** of the plan to the user (5–10 bullets, not the whole doc).

4. Tell the user:
   > "Plan written to `feature_requests/<feature-slug>-plan.md`. Review it and type **implement** to begin TDD, or tell me what you'd like to change."

**STOP — wait for plan approval.**

---

## Phase 4: Implementation

**Goal:** TDD implementation via subagent, followed by code review. Your context window is not used for coding — a fresh subagent handles it.

### Steps

1. **Launch a general-purpose subagent** with this briefing (fill in the actual paths):

   > You are implementing a feature for this codebase. Read the implementation plan at `feature_requests/<feature-slug>-plan.md` before writing any code.
   >
   > Follow TDD strictly:
   > 1. Write ALL tests first (unit, integration, E2E as specified in the plan) — RED
   > 2. Run the tests — they should fail
   > 3. Implement the feature to make the tests pass — GREEN
   > 4. Run the tests again — they should all pass
   > 5. Refactor for clarity — IMPROVE
   >
   > Follow the codebase's existing patterns. Before implementing any file, read 1–2 adjacent files to understand naming, structure, and conventions.
   >
   > Do not stop until all tests pass. If a test is failing due to an environment issue (missing dependency, config), fix that rather than skipping the test.
   >
   > When done, report: (a) files created/modified, (b) test results summary, (c) any deviations from the plan and why.

   Use `isolation: "worktree"` if available, so the implementation is in a clean branch.

2. **After the implementation subagent completes**, launch the **code-reviewer agent** with:
   > Review all changed files from the feature implementation. Fix any CRITICAL or HIGH risk issues directly. For MEDIUM and LOW risk issues, write them to `feature_requests/<feature-slug>-plan.md` under the "Code Review Findings" section (do not fix them unless critical to correctness).

3. **After both agents complete**, report back to the user:

   ```
   ## Implementation Complete

   ### What was built
   - <file-by-file summary>

   ### Acceptance criteria status
   - [x] Criterion 1 — met
   - [x] Criterion 2 — met
   - [ ] Criterion 3 — not yet verifiable (requires manual check)

   ### How to verify manually
   <copy the Manual Verification Steps from the plan, with any updates based on actual implementation>

   ### Code review findings
   <summary of Medium/Low risks logged to the plan doc>
   ```

**STOP — wait for the user to manually verify and report any bugs.**

---

## Phase 5: Bugs & Commit

### Bug Fixes

If the user reports bugs:
1. Read the relevant files before attempting a fix.
2. Fix the bug directly (or spawn a targeted subagent for complex regressions).
3. Re-run the affected tests.
4. Confirm the fix with the user.

Repeat until the user is satisfied.

### Commit

When the user approves:

1. Run `git status` and `git diff` to review what changed.
2. Stage only the feature-related files. Do **not** stage: `.env`, unrelated changes, or files flagged as risky by the code reviewer.
3. Show the user the staged file list and proposed commit message before committing.
4. Use conventional commits format:
   ```
   feat: <short description>

   <optional body: what changed and why, referencing plan doc>
   ```
5. Commit only after the user confirms.

---

## Phase Shortcuts

These let you re-enter the workflow mid-stream (e.g. after reopening Claude):

| You type | What happens |
|----------|-------------|
| `--skip-qs` flag at invocation | Skip Phases 1 & 2 entirely, go straight to plan |
| `skip questions` | Same as above but mid-conversation — skip to Phase 3 using best-effort context |
| `plan` | Start Phase 3 (assumes questions file exists and is answered) |
| `implement` | Start Phase 4 (assumes plan file exists and is approved) |
| `commit` | Jump straight to Phase 5 commit step |
| `status` | Report which phase the current feature is in based on existing docs files |

---

## File Conventions

| File | Path | Purpose |
|------|------|---------|
| Questions | `docs/<slug>-questions.md` | Discovery output, answered by developer |
| Plan | `docs/<slug>-plan.md` | Implementation spec, code review findings |

Both files are gitignored and stay local — they are working documents for your session, not committed alongside the feature.
