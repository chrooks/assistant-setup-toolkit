---
name: skill-orchestrate
description: Orchestrate sequential agent chains with skill injection per agent. Use when running multi-agent workflows where each agent needs specific skill context (e.g. /impeccable for design, /tdd for testing). Supports preset profiles (frontend, fullstack, backend, design) and custom agent:skill mappings.
argument-hint: "<profile|custom> \"<task>\" [agent:/skill ...]"
disable-model-invocation: true
---

# Skill Orchestrate

Run sequential agent chains where each agent gets skill-enriched prompts and passes structured handoff documents to the next agent.

## Quick Start

```bash
# Preset profiles
/skill-orchestrate frontend "Add dashboard with filters"
/skill-orchestrate design "Landing page for new product"
/skill-orchestrate fullstack "Add user authentication"
/skill-orchestrate backend "Build payment processing API"

# Preset + override one agent's skill
/skill-orchestrate fullstack "Add payment flow" security-reviewer:/security-review

# Fully custom chain
/skill-orchestrate custom "architect:/impeccable, tdd-guide:/tdd, code-reviewer:/code-review" "Redesign nav"
```

## Profiles

### frontend

| Agent | Skill | Purpose |
|-------|-------|---------|
| architect | /impeccable | Design-driven architecture |
| tdd-guide | /tdd | Test-first implementation |
| code-reviewer | /impeccable | Craft + quality gate |

### design

| Agent | Skill | Purpose |
|-------|-------|---------|
| architect | /design-an-interface | Divergent concept exploration |
| tdd-guide | /make-interfaces-feel-better | Micro-interaction polish |
| code-reviewer | /impeccable | Final craft + intentionality |

### fullstack

| Agent | Skill | Purpose |
|-------|-------|---------|
| architect | /impeccable | Design-driven architecture |
| tdd-guide | /tdd | Test-first implementation |
| code-reviewer | /code-review | Quality gate |
| security-reviewer | _(default)_ | Security audit |

### backend

| Agent | Skill | Purpose |
|-------|-------|---------|
| architect | _(default)_ | System architecture |
| tdd-guide | /tdd | Test-first implementation |
| code-reviewer | /code-review | Quality gate |
| security-reviewer | _(default)_ | Security audit |

## Execution Workflow

Follow these steps exactly for each invocation.

### Step 1: Parse Arguments

Parse the user's message after `/skill-orchestrate`:

1. First token = profile name (`frontend`, `design`, `fullstack`, `backend`) or `custom`
2. Quoted string = task description
3. Remaining tokens = inline overrides as `agent-name:/skill-name` pairs

If `custom`: second token is a quoted comma-separated list of `agent:/skill` pairs, third token is the task description.

### Step 2: Resolve Agent Chain + Skill Map

1. Look up profile from the table above to get agent chain and default skill mappings
2. Apply any inline overrides (replace skill for specified agent)
3. For `custom`: build chain from the provided pairs

### Step 3: Load Skill Content

For each agent that has a mapped skill:

1. Find the skill's SKILL.md in search roots (in order):
   - `./.claude/skills/<skill-name>/SKILL.md`
   - `~/.claude/skills/<skill-name>/SKILL.md`
2. Read the full SKILL.md content
3. If skill not found, warn and continue with agent's default behavior

### Step 4: Execute Chain Sequentially

For each agent in the chain, spawn using the **Agent** tool with:

- `subagent_type`: the agent name from the chain
- `description`: `"[skill-orchestrate] <agent-name> — <task-summary>"`
- `prompt`: constructed as follows:

```
## Skill Context

The following skill defines how you should approach this work:

<skill SKILL.md content here>

## Task

<task description>

## Handoff from Previous Agent

<handoff document from previous agent, or "First agent in chain — no prior handoff." if first>

## Output Requirements

When complete, produce a structured handoff document with these sections:

### HANDOFF: <your-agent-name> -> <next-agent-name>

#### Context
Summary of what was done and key decisions made.

#### Findings
Key discoveries, patterns identified, or issues found.

#### Files Modified
List of files created or changed with one-line descriptions.

#### Open Questions
Unresolved items the next agent should address.

#### Recommendations
Suggested next steps for the next agent.
```

Wait for each agent to complete before spawning the next. Pass the handoff document from each agent's result to the next agent's prompt.

### Step 5: Final Report

After all agents complete, output a summary:

```markdown
## Skill-Orchestrate Complete

**Profile**: <profile or custom>
**Task**: <task description>

### Agent Chain
| # | Agent | Skill | Status |
|---|-------|-------|--------|

### Summary
<2-3 sentence overview of what was accomplished>

### Files Changed
<aggregated list>

### Open Items
<any unresolved items from final handoff>

### Recommendation
SHIP | NEEDS WORK | BLOCKED
```

## Adding Custom Profiles

To add a profile, edit this SKILL.md and add a new table under ## Profiles following the same format. Each row needs: Agent, Skill (or "default"), Purpose.

## Edge Cases

- **Agent not found**: Skip with warning, continue chain
- **Skill not found**: Warn, run agent without skill injection
- **Agent fails**: Report failure in final summary, continue to next agent
- **Empty task**: Ask user for task description before proceeding
- **Inline override for agent not in profile chain**: Append that agent to end of chain with the specified skill
