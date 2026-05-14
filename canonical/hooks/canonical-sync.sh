#!/usr/bin/env bash
# PostToolUse hook: auto-propagate canonical/ edits to Target Projections.
#
# When a Write or Edit touches a file under canonical/, runs the Setup
# Wizard in quiet mode to keep Assistant Homes in sync with the
# Canonical Assistant Source. Only triggers inside the toolkit repo.
#
# Wire via canonical/hooks/wiring.yaml — the Setup Wizard registers it
# into ~/.claude/settings.json and ~/.codex/hooks.json automatically.
#
# Disable for a session: CANONICAL_SYNC=0 in the environment.
# Disable globally: touch ~/.claude/.canonical-sync.off

set -euo pipefail

# Guard: never block tool completion on hook failure
trap 'exit 0' ERR

# Disable via env var
if [ "${CANONICAL_SYNC:-1}" = "0" ]; then
  exit 0
fi

# Disable via flag file
if [ -f "${HOME}/.claude/.canonical-sync.off" ]; then
  exit 0
fi

# Read hook input from stdin to extract the file path.
# PostToolUse hooks receive JSON on stdin with tool_input.file_path.
INPUT="$(cat)"
FILE_PATH="$(echo "$INPUT" | grep -o '"file_path"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"file_path"\s*:\s*"\([^"]*\)".*/\1/')"

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only trigger when the edited file is under a canonical/ directory
case "$FILE_PATH" in
  */canonical/*)
    ;;
  *)
    exit 0
    ;;
esac

# Resolve the repo root from the file path (parent of canonical/)
REPO_ROOT="${FILE_PATH%%/canonical/*}"

# Only run if this looks like the toolkit repo (has manifests/install.yaml)
if [ ! -f "$REPO_ROOT/manifests/install.yaml" ]; then
  exit 0
fi

# Run Setup Wizard in quiet mode, all targets, default install, no fetch
cd "$REPO_ROOT"
npm run setup -- --claude --codex --default --no-fetch --quiet 2>/dev/null || true

exit 0
