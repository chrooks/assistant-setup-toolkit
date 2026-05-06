#!/usr/bin/env bash
# Stop hook: clears the session learning mode unless it was explicitly persisted.
#
# The pin file (~/.claude/.learning-mode.pin) is written by /mode <mode> --persist.
# If the pin file is absent, this hook deletes the learning-mode file so each
# new session starts fresh (Standard behavior by default).

set -euo pipefail

# Guard: always exit 0 so failures never block Claude Code shutdown
trap 'exit 0' ERR

MODE_FILE="${HOME}/.claude/learning-mode"
PIN_FILE="${HOME}/.claude/.learning-mode.pin"

# Only clear the mode file when the user has NOT pinned a persistent mode
if [ ! -f "$PIN_FILE" ]; then
  rm -f "$MODE_FILE"
fi

exit 0
