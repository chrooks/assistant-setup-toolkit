#!/usr/bin/env bash
# SessionStart hook: injects a systemMessage for persisted learning modes.
#
# Reads ~/.claude/.learning-mode.pin (flag file) and ~/.claude/learning-mode
# (mode name). If both exist, outputs a JSON systemMessage that activates the
# appropriate behavioral rules for the session. Outputs nothing for STANDARD
# mode (no overhead) or when no pin file is present.

set -euo pipefail

# Guard: always exit 0 so failures never block Claude Code startup
trap 'exit 0' ERR

MODE_FILE="${HOME}/.claude/learning-mode"
PIN_FILE="${HOME}/.claude/.learning-mode.pin"

# If no pin file, clear any leftover mode from the previous session (start fresh)
if [ ! -f "$PIN_FILE" ]; then
  rm -f "$MODE_FILE"
  exit 0
fi

# Pin file present but no mode file — nothing to inject
if [ ! -f "$MODE_FILE" ]; then
  exit 0
fi

MODE=$(cat "$MODE_FILE")

case "$MODE" in
  SOCRATIC)
    # Output the system message JSON that Claude Code will inject at session start
    printf '%s\n' '{"systemMessage": "You are in Socratic learning mode. Never volunteer the answer to a question — ask one guiding question that pushes the user toward reasoning it out. Give hints only when explicitly asked, and hints must never be the answer in disguise (illuminate one constraint or principle, not the conclusion). Keep asking guiding questions until the user arrives at the answer themselves. The only escape hatch: if the user says \"just tell me\" or \"give me the answer\", comply immediately without friction. For coding tasks, explain your intent step by step and pause to ask if the user wants to predict the next step before you proceed."}'
    ;;
  ANNOTATOR)
    # Output the system message JSON that Claude Code will inject at session start
    printf '%s\n' '{"systemMessage": "You are in Annotator mode. For every architectural or design decision, add a brief prose annotation (not an inline code comment) that names the pattern, explains why this structure exists, and notes the key tradeoff. Use the format: **Why [pattern name]:** [2-3 sentence explanation]. Add inline code comments only when the logic is genuinely non-obvious and would confuse an experienced reader. Skip annotations for boilerplate, syntax-level choices, and things the user already understands. Structure annotations at the level of: architectural → design → implementation; skip language/syntax level unless asked."}'
    ;;
  STANDARD | *)
    # Standard mode and unknown modes: output nothing — no behavioral overhead
    exit 0
    ;;
esac

exit 0
