#!/usr/bin/env bash
# UserPromptSubmit hook: DevOS per-turn steering.
#
# Keeps a DevOS run alive across turns. If the current project has an active
# Throughline (a file matching feature_requests/*-throughline.md with
# `status: in_progress`), this re-injects a one-line reminder of the current
# stage and next action on every user turn. A skill is a one-shot injected
# prompt, so over a long session or after compaction the agent can forget a run
# is active; this hook fires every turn (guaranteed by the harness, not the
# model) and re-anchors it. It fires ONLY when an active Throughline exists, so
# it adds no noise otherwise.
#
# This is the same proven pattern as lexicon-reminder.sh in this directory.
#
# Wire it in ~/.claude/settings.json (Claude Code):
#
#   { "hooks": { "UserPromptSubmit": [
#     { "hooks": [ { "type": "command", "command": "bash ~/.claude/hooks/devos-steering.sh" } ] }
#   ] } }
#
# Disable for a session: CLAUDE_DEVOS_STEERING=0 in the environment.
# Disable globally: touch ~/.claude/.devos-steering.off or ~/.codex/.devos-steering.off
#
# Verify it is firing: set CLAUDE_DEVOS_STEERING_DEBUG=1 to append a timestamped
# breadcrumb to ~/.claude/devos-steering.log on each invocation. Injected
# UserPromptSubmit context is not persisted to the session transcript, so this
# log is the durable way to confirm the hook ran and which outcome it took.

set -euo pipefail

# Guard: never block prompt submission on hook failure
trap 'exit 0' ERR

PAYLOAD="$(cat 2>/dev/null || true)"

# Opt-in breadcrumb so we can confirm the hook fired without relying on the
# transcript (which never records injected hook context).
debug_log() {
  [ "${CLAUDE_DEVOS_STEERING_DEBUG:-0}" = "1" ] || return 0
  local dir="${HOME}/.claude"
  mkdir -p "$dir" 2>/dev/null || return 0
  printf '%s\t%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$(pwd)" "$1" \
    >> "$dir/devos-steering.log" 2>/dev/null || true
}

# Disable via env var
if [ "${CLAUDE_DEVOS_STEERING:-1}" = "0" ]; then
  exit 0
fi

# Disable via flag file
if [ -f "${HOME}/.claude/.devos-steering.off" ]; then
  exit 0
fi
if [ -f "${HOME}/.codex/.devos-steering.off" ]; then
  exit 0
fi

# Find an active Throughline in the current project.
shopt -s nullglob
THROUGHLINES=( "$(pwd)"/feature_requests/*-throughline.md )
shopt -u nullglob

ACTIVE=""
for f in "${THROUGHLINES[@]}"; do
  # Read only the frontmatter (text between the first two --- lines).
  FM="$(awk 'NR>1 && /^---[[:space:]]*$/{exit} NR>1{print} /^---[[:space:]]*$/{if(!seen){seen=1}}' "$f" 2>/dev/null || true)"
  if printf '%s' "$FM" | grep -q '^status:[[:space:]]*in_progress[[:space:]]*$'; then
    ACTIVE="$f"
    break
  fi
done

# No active run: stay silent.
if [ -z "$ACTIVE" ]; then
  debug_log "silent: no active throughline"
  exit 0
fi

# Extract slug, stage, and next_action from the active Throughline's frontmatter.
FM="$(awk 'NR>1 && /^---[[:space:]]*$/{exit} NR>1{print} /^---[[:space:]]*$/{if(!seen){seen=1}}' "$ACTIVE" 2>/dev/null || true)"
get_field() { printf '%s' "$FM" | grep -m1 "^$1:" | sed -E "s/^$1:[[:space:]]*//" | sed -E 's/[[:space:]]*$//' || true; }
SLUG="$(get_field slug)"
STAGE="$(get_field stage)"
NEXT="$(get_field next_action)"
[ -n "$SLUG" ] || SLUG="$(basename "$ACTIVE" | sed -E 's/-throughline\.md$//')"

REMINDER="DevOS run active: ${SLUG} — stage=${STAGE}, next=${NEXT}. The Throughline at ${ACTIVE} is the source of truth; continue the run with /dev (the Conductor). Read the Throughline before acting, do the current stage's work, then advance stage and next_action."

json_string() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '"%s"' "$value"
}

REMINDER_JSON="$(json_string "$REMINDER")"

# Codex displays UserPromptSubmit additionalContext as hook context in the
# transcript, so this hook stays quiet there (it is wired for claude-code only
# in wiring.yaml). Claude Code keeps the flat additionalContext shape.
if printf '%s' "$PAYLOAD" | grep -q '"turn_id"[[:space:]]*:'; then
  debug_log "silent: codex turn_id (active=${SLUG} stage=${STAGE})"
  exit 0
else
  debug_log "fired: ${SLUG} stage=${STAGE} next=${NEXT}"
  printf '{"suppressOutput":true,"additionalContext":%s}\n' "$REMINDER_JSON"
fi

exit 0
