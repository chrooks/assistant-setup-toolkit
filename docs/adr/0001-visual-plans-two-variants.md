# 0001 — Visual plans: pristine upstream skills, two config-only Variants

Date: 2026-07-10
Status: accepted

## Context

The user wants BuilderIO's `/visual-plan` and `/visual-recap` skills without depending
on the hosted `plan.agent-native.com` database. Two machine classes with different
constraints: the work laptop blocks adding MCP servers entirely; the personal
devices (Mac, PC, WSL) reach server over the tailnet. The Plan app itself is MIT
(`templates/plan` in BuilderIO/agent-native) and self-hostable, and the skills
already branch on `AGENT_NATIVE_PLANS_MODE=local-files` for a no-MCP path.

## Decision

1. **Skills stay byte-identical to upstream.** The vendored copies in
   `canonical/skills/visual-{plan,recap}` are never forked. All flavor behavior
   rides on config the skills already respect: the env var, the MCP entry, and a
   short per-machine note.
2. **Two Variants, chosen at Setup Wizard time,** recorded as plain data on the
   `SetupProfile` (`visual-plans: local-files | self-hosted | none`) — never as
   branching outside the profile — so the future per-device preset system absorbs
   the choice with zero migration.
   - `local-files` (work): no MCP entry at all; `AGENT_NATIVE_PLANS_MODE=local-files`;
     authoring via local MDX + `plan local check/serve/verify`. The hosted-UI
     page-load over the local bridge is the default render path; a fully local
     Plan app (`PLAN_LOCAL_DIR` → `/local-plans/<slug>`) is the documented
     fallback if the company proxy blocks it — not pre-built (YAGNI).
   - `self-hosted` (personal): Plan app deployed on the home server per the homelab house
     pattern — Docker container (TREK precedent: prod build, read-only,
     cap-drop), data under `/srv/compose/plan/` (restic-backed for free),
     `127.0.0.1` bind fronted by a reverse proxy at the operator's own origin,
     reachable LAN + tailnet via existing split-DNS. MCP entry points at
     `<origin>/_agent-native/mcp`, where `<origin>` comes from the
     `TOOLKIT_PLAN_ORIGIN` environment variable. One local account,
     signups closed (Karakeep posture); no dev twin; no Cloudflare tunnel
     (private infra).
3. **The global CLAUDE.md hosted-mode note flips in the same verified commit**
   that proves the server instance works from the Mac — no window where
   instructions contradict reality.

## Consequences

- Upstream sync stays a copy, not a merge — BuilderIO iterates fast (600+
  published versions) and we inherit improvements cheaply.
- The work laptop carries zero MCP config, so there is nothing for the company
  block to fight.
- Plan data on server lands in the existing backup and HTTPS story without new
  machinery; the cost is the homelab deploy ritual (inventory row, runbook,
  backup-path check) owned in the homelab repo, not here.
- If the skills' config Seams ever disappear upstream, revisit the no-fork rule.
