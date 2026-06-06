---
name: scope
description: Size up a task and pick the right workflow — /plan, /grill-me, or /execute.
user-invocable: true
---

# Triage

Size up a request before starting work. Present three options and let the user pick.

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

Present exactly three options with a one-line rationale for each, tailored to the specific request:

```
1. /plan — [why this fits: concrete steps, enforcement mechanism, test strategy]
2. /grill-me — [why this fits: fuzzy scope, unstated assumptions, needs sharpening]
3. /execute — [why this fits: ready to do now using the right Skill workflow]
```

For **/execute**, state that you will invoke the `execute` Skill, which reads
the user-level `## Right Skill, Right Job` section and starts the selected
workflow.

### Step 3: Recommend

State which option you recommend and why, in one sentence. Wait for the user to pick.

### Step 4: Execute

Once the user picks, invoke the corresponding Skill. For `/execute`, invoke the
`execute` Skill.

## Rules

- Do not start implementing before the user picks.
- If the user says "just do it" or similar, treat it as `/execute`.
- If the user already specified a workflow (e.g., typed `/plan`), do not triage — just run it.
- Keep the presentation concise. No walls of text.
