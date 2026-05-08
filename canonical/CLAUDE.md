# Development Conversation Guidelines

## Terminology Usage
- If a  `<CURRENT_PROJECT_DIR>/CONTEXT.md` file exists, treat it as the source-of-truth for our shared vocabulary in our converations.
-  The shared terminology in `CONTEXT.md` serves as a contract for domain-related semantics between you, the agent, and me, the human.
- Be VERY strict about using the vocabulary when applicable instead of other similar word or terms.
- Whenever you use a vocabulary word in conversation, define it. Do this until I tell you explicitly that I don't need the definition repeated anymore. Don't be afraid to be annoying/verbose about these terms. The goal is for us to get comfortable using the terminology.

## Ground Answers in Truth
- If a question asks something specific, and you're not sure of the exact answer, ground your answer in truth by doing a web search, or checking Context7 MCP for reliable sources of truth.
  - Good examples include:
    - Tutorials with specific instructions - ex: "How do I get my database connection url from the Supabase dashboard"
    - Working with unfamiliar libraries - ex: "How do I train an agent with poke-api Python library"
    - Recalling specific numbers, figures, and facts - ex: "What is Lebron James averaging in the playoffs right now?"
    - Answering a question that requires expert knowledge - ex: "How can I best make my UI feel rewarding to use from a HCI, UI/UX, psychology standpoint"

## ExecPlans
- When writing complex features or significant refactors, or just generally need to plan something out, use an ExecPlan (as described in `~/.claude/PLAN.md`) as a source of record for that plan. Put that plan in `<CURRENT_PROJECT_DIR>/feature_requests/<kebab-case-plan-slug>-plan.md`

## Using the Right Skill for the Right Job
ALWAYS:
- Use the `/impeccable` family of skills for design/frontend work.
- Use `/tdd` when implementing a feature, especially if its testable logic. 
- Use `/verification-loop` after implementing a feature.
- Use `/commit` when its time to commit work to version control.
- Use `/diagnose` for fixing difficult bugs.
> `/tdd` + `/verification-loop` + `/commit` is a VERY common workflow when implementing.
Otherwise, iff no other skill has been invoked for a request, use  `/find-skill` to choose the best, most relevant skill for the task. 

## Code Style Preferences
- **ALWAYS** give React/HTML elements human-communicatable `id` tags I can use in conversation.
- Refer to linter configurations and .editorconfig, if present
- Text files should always end with an empty line

## Preferred Tech Stack

Primary languages and frameworks across projects:
- **Frontend**: TypeScript, React, Next.js
- **Backend**: Python (Flask/FastAPI), TypeScript (Node.js)
- **Database**: PostgreSQL (via Supabase), SQLite locallys

For language-specific rules, import them in the project-level CLAUDE.md:
- Python projects: `@~/.claude/rules/python/`
- TypeScript projects: `@~/.claude/rules/typescript/`

## Philosophy

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious

### Simplicity

- **Single responsibility** per function/class
- **Avoid premature abstractions**
- **No clever tricks** - choose the boring solution
- If you need to explain it, it's too complex


## Technical Standards

### Architecture Principles

- **Composition over inheritance** - Use dependency injection
- **Interfaces over singletons** - Enable testing and flexibility
- **Explicit over implicit** - Clear data flow and dependencies
- **Test-driven when possible** - Never disable tests, fix them

### Error Handling

- **Fail fast** with descriptive messages
- **Include context** for debugging
- **Handle errors** at appropriate level
- **Never** silently swallow exceptions

## Project Integration

### Learn the Codebase

- Find similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible
- Follow existing test patterns

### Tooling

- Use project's existing build system
- Use project's existing test framework
- Use project's formatter/linter settings
- Don't introduce new tools without strong justification

## Rules

@~/.claude/rules/common/coding-style.md
@~/.claude/rules/common/git-workflow.md
@~/.claude/rules/common/security.md
@~/.claude/rules/common/agents.md
@~/.claude/rules/common/development-workflow.md

## MCP Tool Use

- AGAIN, Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask

## Important Reminders

**NEVER**:
- Use `--no-verify` to bypass commit hooks
- Disable tests instead of fixing them
- Commit code that doesn't compile
- Make assumptions - verify with existing code

**ALWAYS**:
- Commit working code incrementally
- Update plan documentation as you go
- Learn from existing implementations
- Stop after 3 failed attempts and reassess
