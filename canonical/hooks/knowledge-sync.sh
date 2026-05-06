#!/usr/bin/env bash
# PostToolUse hook: copies knowledge/ files to configured Obsidian vault.
# Also callable manually (no stdin) for ad-hoc sync via /sync-knowledge.
#
# Hook mode: reads PostToolUse JSON from stdin, checks if the written file
#            is inside a knowledge/ directory, copies it to vault if so.
# Manual mode: detects TTY stdin, copies all .md files from cwd/knowledge/.

set -euo pipefail

# Guard: always exit 0 so hook failures never block Claude Code
trap 'exit 0' ERR

CONFIG="${HOME}/.claude/knowledge-config.json"

# Guard: config file must exist
if [ ! -f "$CONFIG" ]; then
  echo "[knowledge-sync] WARNING: config not found at $CONFIG — skipping sync" >&2
  exit 0
fi

# Guard: jq is required to parse config and hook JSON
if ! command -v jq &>/dev/null; then
  echo "[knowledge-sync] WARNING: jq not found — install jq to enable knowledge sync" >&2
  exit 0
fi

# Read config values, expanding ~ to $HOME
VAULT_PATH=$(jq -r '.vaultPath' "$CONFIG" | sed "s|~|${HOME}|g")
KNOWLEDGE_DIR=$(jq -r '.knowledgeDir' "$CONFIG")

if [ -z "$VAULT_PATH" ] || [ -z "$KNOWLEDGE_DIR" ]; then
  echo "[knowledge-sync] WARNING: invalid config — vaultPath or knowledgeDir missing" >&2
  exit 0
fi

# Determine mode: TTY stdin = manual scan; pipe stdin = PostToolUse hook
if [ -t 0 ]; then
  # ── Manual mode ──────────────────────────────────────────────────────────
  # Called by /sync-knowledge; scan all .md files in cwd/knowledge/
  KNOWLEDGE_FOLDER="$(pwd)/${KNOWLEDGE_DIR}"

  if [ ! -d "$KNOWLEDGE_FOLDER" ]; then
    echo "[knowledge-sync] No knowledge/ folder found at $KNOWLEDGE_FOLDER — nothing to sync"
    exit 0
  fi

  # Ensure vault destination directory exists
  mkdir -p "$VAULT_PATH"

  # Copy all markdown files; || true so missing glob doesn't abort
  shopt -s nullglob
  files=("${KNOWLEDGE_FOLDER}"/*.md)
  if [ ${#files[@]} -eq 0 ]; then
    echo "[knowledge-sync] No .md files found in $KNOWLEDGE_FOLDER"
    exit 0
  fi

  cp "${files[@]}" "$VAULT_PATH/"
  echo "[knowledge-sync] Synced ${#files[@]} file(s): $KNOWLEDGE_FOLDER → $VAULT_PATH"

else
  # ── Hook mode ─────────────────────────────────────────────────────────────
  # Receive PostToolUse JSON from stdin; copy only if file is inside knowledge/
  INPUT=$(cat)

  # Extract tool_input.file_path from hook payload
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)

  if [ -z "$FILE_PATH" ]; then
    # Not a Write event with a file_path — nothing to do
    exit 0
  fi

  # Only act when the file lives inside a knowledge/ directory
  if [[ "$FILE_PATH" == *"/${KNOWLEDGE_DIR}/"* ]]; then
    mkdir -p "$VAULT_PATH"
    cp "$FILE_PATH" "$VAULT_PATH/"
    echo "[knowledge-sync] Synced $(basename "$FILE_PATH") → $VAULT_PATH" >&2
  fi
fi

exit 0
