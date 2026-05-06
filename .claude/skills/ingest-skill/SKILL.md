---
name: ingest-skill
description: Ingest a Skill into the Canonical Assistant Source. Accepts a path to an existing SKILL.md or a natural language description of a new skill to create. Places the result in canonical/skills/<skill-name>/SKILL.md.
argument-hint: "<path-to-SKILL.md | description of new skill>"
disable-model-invocation: true
---

# Ingest Skill

Add or update a Skill in the Canonical Assistant Source (`canonical/skills/`).

## Usage

```
/ingest-skill path/to/some/SKILL.md
/ingest-skill a skill that audits npm dependencies for known vulnerabilities
```

## Instructions

### Step 1 — Determine Input Type

Inspect `$ARGUMENTS`:

- If it resolves to a file path that exists on disk (contains `/` or `\`, or ends in `.md`), **AND** the file actually exists when you read it → **Path Mode**.
- Otherwise → **Description Mode**.

### Step 2a — Path Mode (existing Skill file)

1. Read the file at the given path.
2. Extract the skill name:
   - Parse YAML frontmatter for the `name` field.
   - If no frontmatter or no `name`, derive the name from the parent directory of the file (e.g., `some-skill/SKILL.md` → `some-skill`). If the file itself is not named `SKILL.md`, use the filename stem.
   - Normalize to kebab-case.
3. Validate structure: the file should have YAML frontmatter and a markdown body. If it looks malformed, warn the user and ask whether to proceed.
4. Check if `canonical/skills/<skill-name>/SKILL.md` already exists:

   **Does not exist:**
   - Create `canonical/skills/<skill-name>/SKILL.md` with the source content.
   - If the source skill directory contains additional files (scripts, resources, templates), copy those into `.claude/skills/<skill-name>/` as well.

   **Already exists:**
   - Show the user a side-by-side or unified diff between the existing and incoming skill.
   - Ask whether to:
     - **(a) Replace** — overwrite the existing skill entirely with the incoming one.
     - **(b) Merge** — let the user specify which sections to update (e.g., keep existing frontmatter but replace Instructions).
     - **(c) Cancel** — abort without changes.
   - Do NOT overwrite without explicit confirmation.

5. Confirm: `Skill '<skill-name>' ingested into Canonical Assistant Source at canonical/skills/<skill-name>/SKILL.md`

### Step 2b — Description Mode (new Skill)

1. Check that the `/write-a-skill` skill is available. If not, tell the user:
   > `/write-a-skill` is not installed. Either install it or create `canonical/skills/<skill-name>/SKILL.md` manually.
2. Delegate to `/write-a-skill` with the description from `$ARGUMENTS` as context.
3. When `/write-a-skill` produces a SKILL.md draft, extract the skill name from its frontmatter.
4. Write the generated file to `canonical/skills/<skill-name>/SKILL.md`.
5. If `/write-a-skill` produced additional resource files, place them alongside the SKILL.md.
6. Confirm: `New skill '<skill-name>' created in Canonical Assistant Source at canonical/skills/<skill-name>/SKILL.md`

### Step 3 — Post-Ingest Checklist

After either mode completes:

- Remind the user that **Target Projections** (`.codex/`, `.agents/`) will pick up the new skill on the next Setup Wizard run.
- If the skill has dependencies, prerequisites, or required MCP servers, note them.
- Suggest: `Run /commit to commit the new skill.`

## Guardrails

- Never overwrite an existing skill without explicit user confirmation.
- Preserve all frontmatter fields from the source skill; do not strip or reformat unless the format is invalid.
- Skill names must be kebab-case.
- Skill directory structure must be `canonical/skills/<skill-name>/SKILL.md` — never place SKILL.md files at other depths.
- Use domain terminology from `CONTEXT.md`: **Skill**, **Canonical Assistant Source**, **Target Projection**, **Toolkit Component**.
