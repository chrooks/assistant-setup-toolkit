---
description: Capture a concept from the current conversation into an Obsidian-compatible knowledge file.
---

# /capture — Capture a Learning Concept

Saves a concept from the current conversation to `<project>/knowledge/<concept>.md` (gitignored), then auto-syncs to your configured Obsidian vault.

## Usage

```
/capture <concept name>
```

**Arguments:** `$ARGUMENTS`

---

## Instructions for Claude

The concept name is: `$ARGUMENTS`

### Step 1 — Derive the filename

Convert the concept name to kebab-case:
- Lowercase all letters
- Replace spaces and special characters with hyphens
- Strip leading/trailing hyphens

Example: `"Dependency Injection"` → `dependency-injection.md`

### Step 2 — Determine the knowledge directory

The target directory is `<cwd>/knowledge/` where `<cwd>` is the current working directory.

Use the Bash tool to get cwd and construct the path:
```bash
echo "$(pwd)/knowledge"
```

### Step 3 — Ensure knowledge/ is gitignored

Use the Bash tool to check whether `knowledge/` appears in `.gitignore`:
```bash
grep -qx 'knowledge/' .gitignore 2>/dev/null && echo "present" || echo "absent"
```

If absent (and a `.gitignore` exists or the directory is a git repo), use the Write tool or Bash tool to append `knowledge/` to `.gitignore`:
```bash
echo 'knowledge/' >> .gitignore
```

### Step 4 — Create the knowledge directory if needed

```bash
mkdir -p "$(pwd)/knowledge"
```

### Step 5 — Check if the file already exists

Use the Bash tool:
```bash
[ -f "$(pwd)/knowledge/<concept-slug>.md" ] && echo "exists" || echo "new"
```

### Step 6a — If the file is NEW: create with full template

Use the Write tool to create `<cwd>/knowledge/<concept-slug>.md` with the following template, **fully populated from the current conversation context**:

```markdown
---
tags: [claude-code, learning]
date: <today's date as YYYY-MM-DD>
session: <project name — last component of the cwd path>
---

# <Concept Name>

## What It Is

<Plain-language explanation — 2-4 sentences, no jargon. Synthesize from the conversation.>

## Context It Arose In

<Narrative summary of the conversation or task where this concept came up, 2-4 sentences.
Include a verbatim excerpt as a blockquote if it crystallizes the concept.>

> "<Verbatim quote from the exchange that best captures the key insight>"

## Key Tradeoffs

| Option | Pros | Cons |
|--------|------|------|
| <option 1> | <pros> | <cons> |
| <option 2> | <pros> | <cons> |

## Follow-Up Questions Worth Exploring

- <Question 1 worth exploring further>
- <Question 2 worth exploring further>
- <Question 3 worth exploring further>
```

Populate ALL fields by synthesizing from the current conversation. Do not leave placeholder text — generate real content.

### Step 6b — If the file EXISTS: append a new dated section

Read the existing file content, then use the Write tool to rewrite it with a new section appended at the end:

```markdown

---

## Revisited: <today's date as YYYY-MM-DD>

### What It Is (updated)

<Updated or additional explanation from this conversation.>

### Context

<Narrative of why this concept came up again.>

> "<Verbatim quote from this exchange>"

### New Tradeoffs or Nuances

<Any additional tradeoffs or nuances surfaced in this session.>

### New Follow-Up Questions

- <New question 1>
- <New question 2>
```

### Step 7 — Confirm to the user

After writing the file, respond:

```
Captured to knowledge/<concept-slug>.md → will sync to vault.
```

If this was an append (file existed), add:
```
(Appended new section to existing file — original content preserved.)
```

The PostToolUse hook will automatically copy the file to your configured Obsidian vault at `~/Documents/Obsidian/Claude Code/` (or the path in `~/.claude/knowledge-config.json`).
