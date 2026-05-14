---
name: scope
description: Size up a task and pick the right workflow — /plan, /grill-me, /to-prd, or /execute.
user-invocable: true
---

# Triage

Size up a request before starting work. Present four options and let the user pick.

## When to Use

- User gives an open-ended feature, change, or refactor request.
- Scope or approach is unclear.
- You are unsure which workflow fits.

## Process

### Step 1: Understand the request

Read the user's ask. Identify:
- What they want done.
- How much context you already have (files read, prior conversation, codebase familiarity).
- Whether the task has testable logic, UI, architecture, or is purely mechanical.

### Step 2: Present the options

Present exactly four options with a one-line rationale for each, tailored to the specific request:

```
1. /plan — [why this fits: concrete steps, enforcement mechanism, test strategy]
2. /grill-me — [why this fits: fuzzy scope, unstated assumptions, needs sharpening]
3. /to-prd — [why this fits: full product spec needed, multiple stakeholders]
4. /execute — [why this fits: ready to do now using the right Skill workflow]
```

For **/execute**, state which workflow(s) you would use by invoking the
`## Using the Right Skill for the Right Job` section from the user-level
assistant instructions:

- Read `~/.claude/CLAUDE.md` when running in Claude Code.
- Use `/tdd` for testable logic.
- Use `/impeccable` for design/frontend work.
- Use both when the task spans logic and UI.
- If no other Skill has been invoked, use `/find-skill` to choose the best
  workflow before starting.

### Step 3: Recommend

State which option you recommend and why, in one sentence. Wait for the user to pick.

### Step 4: Execute

Once the user picks, invoke the corresponding Skill. For `/execute`, invoke the
`## Using the Right Skill for the Right Job` section from the user-level
assistant instructions, then start work with the selected Skill workflow.

## Rules

- Do not start implementing before the user picks.
- If the user says "just do it" or similar, treat it as `/execute`.
- If the user already specified a workflow (e.g., typed `/plan`), do not triage — just run it.
- Keep the presentation concise. No walls of text.
