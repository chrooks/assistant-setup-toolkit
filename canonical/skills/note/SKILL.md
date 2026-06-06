---
name: note
description: "Quick project-local scratchpad. Add, list, and clear zero-friction notes that live with the project. Use when the user invokes /note or wants a lightweight jot space that is not a task tracker."
---

# /note — Project Scratchpad

Quick notes that live with the project. Zero friction. Not a task tracker, a scratchpad.

## Commands

| Command | Action |
|---|---|
| `/note <text>` | Add a note |
| `/note` | Show all notes |
| `/note done <number>` | Remove note by line number |
| `/note clear` | Clear all notes (confirm first) |

## Storage

- **File**: `.claude/notes.md` in the project root
- **Format**: `- [YYYY-MM-DD] <text>`, newest first (prepend)
- **Scope**: Project-scoped, not global

## Routing

1. **Has arguments, first word is NOT `done`/`clear`/`list`**: treat everything after `/note` as the note text. Prepend to file.
2. **No arguments**: read and display the file as a numbered list.
3. **First word is `done`**: second argument is the line number to remove.
4. **First word is `clear`**: confirm, then truncate.

## Behavior

### Adding a note (`/note fix the auth bug`)

1. Read `.claude/notes.md` (create if missing).
2. Prepend `- [YYYY-MM-DD] fix the auth bug` to the file (newest on top).
3. Output one line: `noted (#N total)` where N is the new count.
4. No confirmation prompt. No verbose output.

### Showing notes (`/note`)

1. Read `.claude/notes.md`.
2. If empty or missing: output `No notes.`
3. Otherwise display as numbered list:
   ```
   1. [2026-05-08] fix the auth bug
   2. [2026-05-08] ask about RuleSet naming
   3. [2026-05-07] check salary cap math
   ```

### Removing a note (`/note done 2`)

1. Read the file.
2. Remove line 2.
3. Write remaining lines back.
4. Output: `removed. (N remaining)`

### Clearing all (`/note clear`)

1. Ask: `Clear all N notes?`
2. On confirm: truncate file.
3. Output: `cleared.`

## Context Window Positioning

The notes file must be **re-read on every `/note` invocation**. LLM attention is strongest at the top and bottom of the context window (U-shaped). By reading the file fresh each time, notes stay in the recency attention zone rather than decaying into the forgotten middle.

Do NOT rely on the file being loaded once at session start. Re-read it.

## File Creation

If `.claude/notes.md` doesn't exist on first `/note <text>`, create it. No scaffold needed — just the note line.
