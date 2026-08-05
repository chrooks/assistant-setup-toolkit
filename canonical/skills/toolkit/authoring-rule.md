# Branch: rule

The request is a convention tied to a file type, a directory, or one machine. It becomes a rule under `canonical/rules/`.

Rules have **no line budget**. That is the whole reason this branch exists: a convention that would cost scarce space in `canonical/INSTRUCTIONS.md` costs nothing here, because a `paths:`-gated rule only loads when a matching file is in play.

## Pick the directory

| Directory | Holds | Gate |
|---|---|---|
| `canonical/rules/common/` | cross-language conventions | mixed — see below |
| `canonical/rules/python/` | Python conventions | `**/*.py`, `**/*.pyi` |
| `canonical/rules/typescript/` | TypeScript and Node conventions | `**/*.ts`, `**/*.tsx` |
| `canonical/rules/react/` | React and component conventions | `**/*.tsx`, `**/*.jsx` |
| `canonical/rules/web/` | browser, CSS, and design-surface conventions | `**/*.css`, `**/*.html`, and friends |
| `canonical/machines/<name>/rules.md` | facts true on one machine only | the `machine` Variant (ADR-0003) |

Language directories are unambiguous — a Python convention goes in `python/`. The judgment call is `common/`, which holds both flavors described next.

Machine rules are a different shape: one `rules.md` per machine class, not a directory of topic files, and gated by the resolved `machine` Variant rather than by globs. They carry operational constraints — network posture, service discipline, local resource paths — and are gitignored on purpose, so they never leave the machine. Edit them in place; do not create topic files beside them.

## The two flavors, and the trap between them

**Path-gated.** The file opens with a `paths:` frontmatter block listing globs. It loads automatically when the model touches a matching file, and costs nothing otherwise. This is the default and the reason to prefer a rule over an instruction.

    ---
    paths:
      - "**/*.py"
      - "**/*.pyi"
    ---
    # Python Coding Style

**Always-on.** The file has no frontmatter at all, and is pulled in by an `@` import line in `canonical/INSTRUCTIONS.md`:

    @~/.claude/rules/common/git-workflow.md

**The trap runs the opposite way from what you would expect.** `paths:` is an opt-in *gate*, not a switch that turns loading on. A rule with no `paths:` block loads into **every session, unconditionally** — whether or not anything imports it. There is no such thing as a dead rule file. An ungated rule you forgot about is not inert; it is permanently live.

Verified 2026-08-05: ten ECC-era rule files with no frontmatter and no `@` import loaded into every session for months, while `~/.claude/CLAUDE.md` never mentioned them. Two sessions hunted for the hook injecting them. There is no hook — this is native Claude Code behavior, and the frontmatter is the only thing that scopes it.

The `@` import does a different job: it carries the rule to **Codex**, which reads the projected file but does not glob-gate it. On Claude the file would load either way.

The current state is a clean invariant worth preserving — exactly four rules have no `paths:` block, and those are exactly the four imported from `INSTRUCTIONS.md`: `common/resource-index.md`, `common/coding-style.md`, `common/git-workflow.md`, `common/development-workflow.md`. Every other rule under `canonical/rules/` is path-gated. `tests/setup/toolkit-skill.test.ts` enforces this — add an ungated rule and the suite fails.

So: **write `paths:` unless you intend the rule to load in every session, everywhere.** An always-on rule costs context in every session, which makes it an instruction-budget decision wearing a rule's clothing — read [authoring-instruction.md](authoring-instruction.md) before choosing that branch.

## Gate on the right axis

Gate on **what the file is**, not on **what the task is**. A convention about writing Python belongs on `**/*.py`. A procedure for recording a demo video does not belong on `**/*.tsx` — the trigger for that work is a person deciding to record a demo, not a component file being opened, and a task-shaped rule on a file-type gate fires constantly and irrelevantly.

If you cannot name the file type the rule is about, it is probably a Skill or an instruction, not a rule.

Watch the stacking cost too. Gates compose: opening one `.tsx` file currently pulls `typescript/`, `react/`, and `web/` together — sixteen files, roughly 12k tokens. That layering is intentional, but every broad gate you add is paid on every matching file, forever.

## Glob syntax

Standard glob matching against the repository-relative path. Prefix with `**/` so the rule fires at any depth, not only at the root.

- `"**/*.py"` — every Python file, anywhere
- `"**/migrations/**"` — everything under any directory named `migrations`
- `"**/*.test.*"` — test files regardless of language

List several globs rather than trying to write one clever pattern. `common/database.md` gates on five — `**/*.sql`, `**/migrations/**`, `**/supabase/**`, `**/prisma/**`, `**/drizzle/**` — because a database convention should fire on any of them and no single glob covers the set.

## Create

1. Choose the directory and the flavor from above.
2. Choose the filename by topic, matching what already exists in that directory: `coding-style.md`, `testing.md`, `security.md`, `patterns.md`, `hooks.md`. Reuse an existing filename when the convention belongs to that topic — **add a section to the existing file rather than creating a near-duplicate one.** Sprawl is the failure mode here.
3. Write the `paths:` block, then the body.
4. When the rule extends a `common/` counterpart, open with the established pointer line so the relationship is explicit:

       > This file extends [common/coding-style.md](../common/coding-style.md) with Python specific content.

5. Install with `npm run sync`.

## Update

Read the file first, edit the section in place, preserve the `paths:` block unless the change is specifically about which files the rule covers. Then `npm run sync`.

## Remove

Confirm the blast radius once, per the router's `remove` verb. Grep for inbound references — rules cross-link each other with relative markdown links, and `common/` rules are frequently pointed at from language directories. Then prune:

    npm run setup -- --claude --codex --default --write prune --yes

If the rule was always-on, delete its `@` import line from `canonical/INSTRUCTIONS.md` in the same change. An import pointing at a deleted file is a broken load, not a no-op.

## Codex parity

Rules project to `.codex/rules/` as markdown, and the Claude → Codex rewrite retargets `@~/.claude/rules/…` imports to `~/.codex/rules/…` automatically. Do not hand-write Codex paths.

`paths:` gating is Claude Code progressive enhancement. Codex reads the projected file but does not glob-gate it, so a rule whose body only makes sense for one language should say which language it is about in its first line — that sentence is what carries it on the target that ignores the frontmatter.
