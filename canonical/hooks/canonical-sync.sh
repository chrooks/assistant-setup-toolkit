#!/usr/bin/env bash
# PostToolUse hook: auto-propagate canonical/ edits to Target Projections.
#
# When a Write or Edit touches a file under this repo's canonical/, runs
# the Setup Wizard in quiet mode to keep Assistant Homes and Target
# Projections in sync with the Canonical Assistant Source.
#
# Wire via canonical/hooks/wiring.yaml — the Setup Wizard registers it as a
# project-level hook in .claude/settings.json and .codex/hooks.json.
#
# Disable for a session: CANONICAL_SYNC=0 in the environment.
# Disable for this project: touch .canonical-sync.off

set -euo pipefail

# Guard: never block tool completion on hook failure
trap 'exit 0' ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Disable via env var
if [ "${CANONICAL_SYNC:-1}" = "0" ]; then
  exit 0
fi

# Disable via flag file. Keep the legacy Assistant Home flag as a fallback
# for users who already rely on it.
if [ -f "$REPO_ROOT/.canonical-sync.off" ] || [ -f "${HOME}/.claude/.canonical-sync.off" ]; then
  exit 0
fi

# Read hook input from stdin to extract the file path.
# PostToolUse hooks receive JSON on stdin with tool_input.file_path.
INPUT="$(cat)"
FILE_PATH="$(echo "$INPUT" | grep -o '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"\([^"]*\)".*/\1/')"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only trigger when the edited file is under this repo's canonical/ directory.
case "$FILE_PATH" in
  "$REPO_ROOT"/canonical/*|canonical/*)
    ;;
  *)
    exit 0
    ;;
esac

# Only run if this looks like the toolkit repo (has manifests/install.yaml)
if [ ! -f "$REPO_ROOT/manifests/install.yaml" ]; then
  exit 0
fi

# Run Setup Wizard in quiet mode, all targets, default install, no fetch
cd "$REPO_ROOT"
npm run setup -- --claude --codex --default --no-fetch --quiet --overwrite 2>/dev/null || true

exit 0
