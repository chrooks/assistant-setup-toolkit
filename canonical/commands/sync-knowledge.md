---
description: Manually sync all knowledge/ files in the current project to your configured Obsidian vault.
---

# /sync-knowledge — Manual Vault Sync

Copies all `.md` files from `<current-project>/knowledge/` to the configured Obsidian vault path.

## Usage

```
/sync-knowledge
```

No arguments required. Operates on the current working directory.

---

## Instructions for Claude

Run the knowledge sync script in manual mode using the Bash tool:

```bash
bash ~/.claude/hooks/knowledge-sync.sh
```

The script detects that it is being called without piped stdin (TTY mode) and will:
1. Read the vault path and knowledge directory name from `~/.claude/knowledge-config.json`
2. Look for all `.md` files in `<cwd>/knowledge/`
3. Copy them to the configured vault path
4. Print a confirmation message

After the Bash tool returns, relay the script's output to the user verbatim so they can see which files were synced and where.

If the script reports that `jq` is not installed, inform the user:
```
knowledge-sync requires jq. Install it with: brew install jq
```

If there is no `knowledge/` folder in the current directory, the script will say so — relay that message to the user.
