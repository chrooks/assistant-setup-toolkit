#!/usr/bin/env bash
# UserPromptSubmit hook: per-turn completion-status (Quick Recap) reminder.
#
# Re-injects a short nudge to end work-completing turns with a single
# 🟢/🟡/🔴 status line. This is the per-turn anti-drift guard that complements
# the full convention in ~/.claude/CLAUDE.md, which only loads at session start.
#
# Scope: ONLY turns that complete a unit of work (edits, commits, file/config
# changes, a built or wired feature). Pure Q&A and explanation skip it.
#
# Wire it in ~/.claude/settings.json (Claude Code):
#
#   { "hooks": { "UserPromptSubmit": [
#     { "hooks": [ { "type": "command", "command": "bash ~/.claude/hooks/quick-recap-reminder.sh" } ] }
#   ] } }
#
# Codex CLI displays UserPromptSubmit additionalContext in the transcript, so
# canonical/hooks/wiring.yaml intentionally does not wire this hook for Codex.
#
# Disable for a session: CLAUDE_QUICK_RECAP_REMINDER=0 in the environment.
# Disable globally: touch ~/.claude/.quick-recap-reminder.off

set -euo pipefail

# Guard: never block prompt submission on hook failure
trap 'exit 0' ERR

PAYLOAD="$(cat 2>/dev/null || true)"

# Disable via env var
if [ "${CLAUDE_QUICK_RECAP_REMINDER:-1}" = "0" ]; then
  exit 0
fi

# Disable via flag file
if [ -f "${HOME}/.claude/.quick-recap-reminder.off" ]; then
  exit 0
fi
if [ -f "${HOME}/.codex/.quick-recap-reminder.off" ]; then
  exit 0
fi

# Per-turn nudge, not a rulebook. Telegraphic, imperative, full rules live once
# in CLAUDE.md (loaded at start) so they are not re-paid every turn.
# ponytail: short on purpose — re-injected every single turn.
REMINDER='Quick-recap reminder: if this turn completes a unit of work (edits, commits, file/config changes, a built or wired feature), END the response with one status line — 🟢 finished / 🟡 non-routine follow-up remains, name it / 🔴 blocked on user input. Under 100 chars, at the very end, nothing after it (no ---, no spacer). Pure Q&A or explanation: skip the line.'

json_string() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '"%s"' "$value"
}

REMINDER_JSON="$(json_string "$REMINDER")"

# Codex displays UserPromptSubmit additionalContext as hook context in the
# transcript, so this hook stays quiet there. Claude Code keeps the flat
# additionalContext shape.
if printf '%s' "$PAYLOAD" | grep -q '"turn_id"[[:space:]]*:'; then
  exit 0
else
  printf '{"suppressOutput":true,"additionalContext":%s}\n' "$REMINDER_JSON"
fi

exit 0
