# Cost Guardrails

> Why this file exists: in Sep–Oct 2026 Claude Code sessions on hestia cost about $500 of real money. Root cause: hestia's `~/.bashrc` exported `ANTHROPIC_API_KEY`, so every Orca, VS Code Remote-SSH, and shell-launched session there billed the Console org at full API rates with zero Max coverage. One of those sessions ran 11 days at ~320K tokens of context per call and launched 19 multi-agent Workflows. None of it was visible until the invoices. These rules, plus the `cost-guard.js` and `spend-report.js` hooks, make that impossible to repeat quietly.

## How billing works (do not assume otherwise)

- Two separate bills exist. The Max subscription (claude.ai) covers sessions logged in with OAuth, up to its 5-hour and 7-day limits, then extra usage if enabled. The Console org (console.anthropic.com) bills any session that finds `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` in its environment, at full API rates, from the first token. Claude Code prefers the key over the login when both exist.
- The Console monthly spend limit defaulted to $200,000. Chris set it to $50 on 2026-10-14. The error "You have reached your specified API usage limits" is that cap working.
- Never export an Anthropic key in a shell profile. Apps that need one read it from their own `.env`. A key in the environment is a billing bug, and the cost guard blocks the session until the user types "api key ok".
- Cost per call scales with context. A call at 400K context costs about 40x a call at 10K context, even on cache reads.
- Workflows and subagents each pay their own context. A fan-out from a large session multiplies the bill.

## Session hygiene (the assistant's side)

- One task, one session. A 🟢 closes the unit of work. The next prompt that opens a new scope does not start here: say so in one line, write the `/handoff` for it, and stop; the user continues in a fresh session. A correction, proof, or commit of what just shipped continues in place, as does a prompt that says "same scope". The hook fires this once per 🟢 at any context size, on any billing. It is a scope delimiter, not a cost control. Never keep a session alive across days by compacting.
- Say the context size only where context costs money. On an API-billed session the hook blocks new prompts above 250K. On a subscription session the cost is quota, which the status line already shows: the hook says one line once above 250K and never blocks. Do not raise context on your own.
- Prefer inline work over subagents. Spawn an Agent only when the task needs a separate context, and never above 200K.
- Workflows need a user opt-in in their own words ("ultracode", "use a workflow") in the last 2 hours, and a context under 80K. Quote the cost before launching: agents × expected turns.
- Never pick a `[1m]` model variant. The default model in settings is the standard window. If the user needs 1M for one task, they switch and switch back.
- Bash output is context. Pipe through `head`, `tail`, `grep`, or `wc` instead of dumping files or logs.
- No unattended loops without a cap. `/loop`, cron routines, and Remote Control sessions each need an end condition and a cost quote.

## What the hooks enforce

| Hook | Event | Enforces |
|---|---|---|
| `cost-guard.js` | UserPromptSubmit | Blocks every prompt when `ANTHROPIC_API_KEY` is set unless the prompt says "api key ok". After a 🟢 turn, tells the assistant once that the next prompt is a new scope unless it corrects, proves, or commits what shipped: write the `/handoff` and stop (silent mid-work; any context size, any billing). API-billed only: blocks prompts at 250K except `/handoff`, `/compact`, `/clear`, `/exit`, or "cost guard override". Subscription: one line once per session above 250K, no block. Warns on 24h session age or a 1M model. Records Workflow opt-ins. |
| `cost-guard.js` | PreToolUse `Workflow\|Agent` | Denies Workflow without a fresh opt-in or above 80K context. Denies Agent above 200K context. |
| `spend-report.js` | SessionStart | Checks who pays for this session first: an API key or `apiKeyHelper` means the Console org, otherwise the claude.ai login. Records the mode per session and reports API-billed spend (real charges) apart from the subscription-covered estimate (list-rate value of Max sessions). Pushover alert and the $50-cap warning fire on the API-billed bucket only. |
| status line | always | Shows context tokens, session cost, Max 5h/7d usage, and a red `OVERAGE` flag when the 7-day limit is spent. |

Kill switch for one session: `COST_GUARD=0`. Global: `touch ~/.claude/.cost-guard.off`. Say so to the user if you ever use one.

## Hestia

- A watchdog cron (`~/bin/claude-session-watchdog.sh`, every 30 min) kills Claude sessions older than 12 hours. Remote Control sessions from the phone are not free; close them.
- Cron jobs that call `claude -p` must set `--max-turns` and a model, and log their cost.
