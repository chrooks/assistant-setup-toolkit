# Cost Guardrails

> Why this file exists: in Sep–Oct 2026 one Claude Code session on hestia ran for 11 days at ~470K tokens of context per call, launched 19 multi-agent Workflows, and cost about $500 in extra usage on top of the Max subscription. None of it was visible until the invoices. These rules, plus the `cost-guard.js` and `spend-report.js` hooks, make that impossible to repeat quietly.

## How billing works (do not assume otherwise)

- The Max subscription has a 5-hour and a 7-day limit. When extra usage is on, work past the limit bills at API rates. The subscription does not cap spend; the extra-usage cap at claude.ai → Settings → Billing does. Chris set it to $50 on 2026-10-14.
- Cost per call scales with context. A call at 400K context costs about 40x a call at 10K context, even on cache reads.
- Workflows and subagents each pay their own context. A fan-out from a large session multiplies the bill.

## Session hygiene (the assistant's side)

- One task, one session. Finish with `/handoff`, then the user starts fresh. Never keep a session alive across days by compacting.
- Say the context size when it matters. At 120K tokens tell the user in one line to hand off. Above 250K the hook blocks new prompts.
- Prefer inline work over subagents. Spawn an Agent only when the task needs a separate context, and never above 200K.
- Workflows need a user opt-in in their own words ("ultracode", "use a workflow") in the last 2 hours, and a context under 80K. Quote the cost before launching: agents × expected turns.
- Never pick a `[1m]` model variant. The default model in settings is the standard window. If the user needs 1M for one task, they switch and switch back.
- Bash output is context. Pipe through `head`, `tail`, `grep`, or `wc` instead of dumping files or logs.
- No unattended loops without a cap. `/loop`, cron routines, and Remote Control sessions each need an end condition and a cost quote.

## What the hooks enforce

| Hook | Event | Enforces |
|---|---|---|
| `cost-guard.js` | UserPromptSubmit | Warns at 120K context, 24h session age, or a 1M model. Blocks prompts at 250K except `/handoff`, `/compact`, `/clear`, `/exit`, or "cost guard override". Records Workflow opt-ins. |
| `cost-guard.js` | PreToolUse `Workflow\|Agent` | Denies Workflow without a fresh opt-in or above 80K context. Denies Agent above 200K context. |
| `spend-report.js` | SessionStart | Estimates today, yesterday, and 7-day spend at list rates from local transcripts. Pushover alert when today passes $10. |
| status line | always | Shows context tokens, session cost, Max 5h/7d usage, and a red `OVERAGE` flag when the 7-day limit is spent. |

Kill switch for one session: `COST_GUARD=0`. Global: `touch ~/.claude/.cost-guard.off`. Say so to the user if you ever use one.

## Hestia

- A watchdog cron (`~/bin/claude-session-watchdog.sh`, every 30 min) kills Claude sessions older than 12 hours. Remote Control sessions from the phone are not free; close them.
- Cron jobs that call `claude -p` must set `--max-turns` and a model, and log their cost.
