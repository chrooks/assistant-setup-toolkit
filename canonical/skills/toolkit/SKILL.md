---
name: toolkit
description: Change how the assistants behave — create, update, or remove a skill, rule, instruction, hook, machine rule, or external source in the Canonical Assistant Source, then install it. Routes a plain-English request to the right artifact kind so the user never has to name it. Use when the user says "from now on", "always", "never", "every time you", "make a skill for", "add a rule", "encode this", "stop doing X", "remove that rule", or otherwise describes a durable change to assistant behavior.
argument-hint: "[create|update|remove|check] [canonical|project|machine <name>] <what you want>"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebFetch
---

# Toolkit

One router for every change to the toolkit. The user describes a behavior; this Skill works out which piece of machinery the request actually wants, writes it in the right place, and installs it.

Side-effectful — it writes to `canonical/` and runs the Setup Wizard — but deliberately **model-invocable**, because extension decisions should get this guidance without anyone typing a command.

## Fire on intent to change behavior, not on discussion about the toolkit

This is the trigger discriminator and both halves matter.

**Fire** when the user is describing a *durable* change to how an assistant behaves. The tell is a permanence phrase: "from now on", "always", "never", "every time you", "make a skill for", "add a rule", "encode this", "stop doing", "remove that".

**Do not fire** on questions *about* the toolkit — "how does the Setup Wizard decide which files to install?", "what does safe-merge do?", "which skills do I have?". Those are answered normally. A model-invocable Skill that writes files hijacks the conversation when it fires on a question.

When it is genuinely ambiguous, ask one short question rather than guessing. Writing an unwanted file is more expensive than one clarifying line.

## The routing table

| The ask | Destination | Branch |
|---|---|---|
| A repeatable multi-step workflow | a **Skill** in `canonical/skills/<name>/` | [authoring-skill.md](authoring-skill.md) |
| A convention tied to a file type or directory | a `paths:`-gated **rule** in `canonical/rules/<area>/` | [authoring-rule.md](authoring-rule.md) |
| A universal conversational rule | a section in `canonical/INSTRUCTIONS.md` — an **instruction** | [authoring-instruction.md](authoring-instruction.md) |
| A behavior that must fire 100% of the time | **both** an instruction *and* a **hook** in `canonical/hooks/` | [authoring-instruction.md](authoring-instruction.md) + [authoring-hook.md](authoring-hook.md) |
| A fact true only on one machine | a **machine rule** in `canonical/machines/<name>/rules.md` | [authoring-rule.md](authoring-rule.md) |
| Somebody else's published work worth pulling in | an **external source** in `manifests/install.yaml` | [authoring-manifest.md](authoring-manifest.md) |
| "Has upstream changed?" for a Skill copied or wrapped from elsewhere | the **drift check** over `upstream:` frontmatter blocks | [checking-upstream.md](checking-upstream.md) |

Worked examples of asks paired with their destination live in [routing-fixtures.md](routing-fixtures.md). Read it when a request does not obviously match a row.

### Belt and suspenders: some asks are two artifacts

A behavior that **must** fire every time is an instruction *and* a hook. The instruction tells the model what to do; the hook makes the runtime enforce it when the model forgets. Producing only the instruction is the common failure — it leaves a "100% of the time" promise resting on model compliance.

The discriminator is a **question put to the user**, never an inference: *"Should this be enforced even when I forget, or is guidance enough?"* Enforced → write both. Guidance is enough → instruction only.

Ask before writing, not after. The answer changes how many files land.

### Not routed here

**Sub-agents.** The Setup Wizard walks `hooks`, `commands`, `skills`, `rules`, and `config` under `canonical/` — there is no `canonical/agents/`. Adding one is a new component kind and its own piece of work. Say so rather than improvising a location.

**MCP servers.** Live external tool or data access is an MCP server. It is **registered per machine** — route the user to `claude mcp add` or `/mcp`; there is no canonical artifact that installs one.

But a server the toolkit expects to exist still gets **recorded** in `manifests/install.yaml` as `kind: mcp-server` (see `playwright-mcp`, `context7`, `chrome-devtools-mcp`). Those entries install nothing — the wizard reports them as *manual (MCP)* and surfaces the command in Next Steps, so a fresh machine learns what it is missing. Registering without recording means the next machine never finds out.

## Scope — always stated, never inferred

| Scope | Lands in | Reaches |
|---|---|---|
| **canonical** (default) | `canonical/…` | every machine, every project |
| **project** | `./.claude/…` and `./.agents/…` | this repository only |
| **machine `<name>`** | `canonical/machines/<name>/…` | only that machine class (ADR-0003) |

**Never infer scope from the machine the session is running on.** Working on the work laptop does not make a change machine-scoped. Doing so would silently fragment the toolkit. Default to canonical; take a narrower scope only when the user names one, and say which scope you used in the completion report.

Machine names are the directory names under `canonical/machines/`. Check what exists before writing to a new one.

## Verbs

**create** — the artifact does not exist yet. Gather what the branch needs, write it, install.

**update** — the artifact exists. Read it first, apply the change in place, preserve the `name:` slug and everything not being changed, install.

**check** — nothing is being changed yet; the ask is whether somebody else's work has moved. Run the drift report and read it:

    npm run check-upstream

It reports and never writes. A hit worth acting on becomes a **update** on that Skill, and the Skill's `ref` is advanced afterwards. See [checking-upstream.md](checking-upstream.md).

**remove** — deleting from `canonical/` does nothing on its own; the installed copies in `~/.claude/` and `~/.codex/` survive until pruned.

Removal gates on **one** confirmation that names the blast radius:

> Removing `<artifact>` deletes it from N Assistant Homes and touches M referencing files. Proceed?

Name the real counts — grep for inbound references first. The subsequent prune is not gated separately; one informative gate is proportionate for git-tracked, recoverable deletions.

## Install — a canonical edit is inert until the wizard runs

Run from the toolkit repository root. This is not optional; it is the step that makes the change real.

    npm run sync

For a **remove**, prune instead — `sync` uses overwrite, which leaves the orphaned directory behind in each Assistant Home:

    npm run setup -- --claude --codex --default --write prune --yes

Report what the wizard printed, not what you expected it to print.

## When a decision turns on a documented detail, fetch the docs

Most routing needs no documentation at all — deciding "this is a rule, not a Skill" is a judgment call. Fetch only when a decision actually turns on a schema, lifecycle, or CLI detail you are unsure of. Three sources, in order of breadth:

- **[Agent Skills open standard](https://github.com/agentskills/agentskills)** — anything cross-runtime: `SKILL.md` shape, frontmatter, progressive disclosure, `.agents/skills/` discovery.
- **[Claude Code docs](https://docs.claude.com/en/docs/claude-code)** — Claude-only surfaces: hooks, plugins, settings, Claude-specific frontmatter.
- **[Codex docs](https://developers.openai.com/codex)** — Codex-only surfaces: `AGENTS.md` precedence, the `codex_hooks` feature flag, `agents/openai.yaml` MCP declaration.

Never guess at a schema. A wrong field name installs silently and fails at runtime.

## Completion criteria

Before reporting done:

- [ ] The artifact kind was chosen from the routing table, and a belt-and-suspenders ask was put to the user when the request said "always" or "every time"
- [ ] Scope was stated explicitly and appears in the report
- [ ] The file exists at the destination the branch names
- [ ] The Setup Wizard ran — `sync` for create/update, `prune` for remove — and its output was read
- [ ] For a remove, the installed copy is actually gone from `~/.claude/skills/` (or the matching directory)
