---
name: prep-demo
description: Prepare a focused demo, explanation, or walkthrough plan from audience, prior context, current work, and available time. Use when the user asks to prep a demo, plan a walkthrough, explain recent work, rehearse a presentation, or turn project progress into a timed demonstration.
argument-hint: "<demo topic or audience/context/time notes>"
disable-model-invocation: false
---

# Prep Demo

Prepare a clear, timed demonstration or walkthrough that fits the audience and the moment.

## Inputs

Parse arguments positionally from the user's invocation (works on both Claude Code and Codex CLI — do not rely on `$ARGUMENTS` substitution alone). The entire arg string is a free-form topic/audience/context/time seed matching `argument-hint`. Use it as the starting frame; do not require structure.

Then infer from the user's message and local context when possible:

- Audience: who is watching, their technical depth, and what they care about.
- What they last saw: their most recent known state of the work.
- What has changed: the work to demonstrate, explain, or walk through.
- Time available: hard limit and preferred depth.
- Desired outcome: decision, feedback, approval, alignment, education, or confidence.

If the four core inputs are missing, ask for them in this compact form:

```md
Audience:
What they've last seen:
What you've been working on:
How much time you have:
```

Ask no more than one follow-up unless the demo would be materially wrong without the answer.

## Process

1. Define the demo promise in one sentence.
   - State what the audience should understand, believe, or decide by the end.
   - Keep it concrete enough to test against the final outline.

2. Choose the right shape:
   - **Tour**: show existing surfaces and how they relate.
   - **Before/after**: contrast what changed since the audience last saw it.
   - **Narrated implementation**: explain design choices, Boundaries, Contracts, and risks.
   - **Decision demo**: frame tradeoffs and ask for a specific decision.
   - **Feedback demo**: show the thinnest useful Vertical Slice and ask targeted questions.

3. Build a timed arc:
   - Opening: orient the audience and name the demo promise.
   - Context: bridge from what they last saw to what changed.
   - Walkthrough: show the work in the order the audience will naturally understand it.
   - Evidence: include verification, screenshots, tests, metrics, or code references when useful.
   - Ask: end with the exact feedback, decision, or next step needed.

4. Add speaker notes:
   - Use plain language for non-technical audiences.
   - Use code paths, Contracts, and tradeoffs for technical audiences.
   - Avoid explaining every implementation detail; keep detail available for questions.

5. Prepare recovery paths:
   - Identify the one thing most likely to fail during the demo.
   - Add a fallback explanation, screenshot, command output, or static artifact.
   - Name known limitations honestly without letting them dominate the walkthrough.

## Output Format

Return a concise plan:

```md
## Demo Promise
<one sentence>

## Shape
<Tour | Before/after | Narrated implementation | Decision demo | Feedback demo>

## Audience Fit
<how to pitch the depth and language>

## Timed Walkthrough
- 0:00-0:30 — <opening>
- 0:30-2:00 — <section>
- ...

## Show
- <surface, file, command, artifact, or story beat>

## Say
- <speaker note>

## Ask
- <specific decision, feedback, or next step>

## Backup
- <fallback if live demo fails>
```

For demos with ≤3 minutes total time, collapse the output to `Demo Promise`, `Shape`, `Timed Walkthrough`, `Ask`, and `Backup`.

## Guardrails

- Fit the plan to the available time; cut scope before compressing everything.
- Lead with audience value, then implementation detail.
- Prefer one coherent path over a feature inventory.
- Use project Lexicon terms when available.
- Do not over-script; give the user a runnable arc and crisp talking points.
- When code or project state matters, inspect the repo before naming files, tests, or completed work.
