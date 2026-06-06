#!/usr/bin/env bash
# claude-notify.sh — fire a macOS banner + Pushover push when an assistant
# session finishes a turn (Stop) or needs your input (Notification).
#
# Canonical Assistant Source: edit here, then `npm run setup` projects this
# into each Assistant Home (~/.claude/hooks/, ~/.codex/hooks/) and wires it
# against the Stop and Notification events per canonical/hooks/wiring.yaml.
#
# Cross-assistant: reads JSON on stdin and degrades safely on missing fields,
# so the same script works for Claude Code and Codex CLI hook payloads.
#
# Pushover secrets are NOT stored here. They live in a private, chmod-600 file
# the user creates once (surfaced as a Setup Wizard Next Step):
#   ~/.claude/secrets-pushover.env   with PUSHOVER_TOKEN= and PUSHOVER_USER=
# The Mac banner always fires; the Pushover push fires only when that file and
# both keys are present.
#
# Usage: claude-notify.sh <event-label>
#   event-label: "done" (Stop) | "needs-input" (Notification)

set -euo pipefail

EVENT_LABEL="${1:-done}"
SECRETS_FILE="${PUSHOVER_SECRETS_FILE:-$HOME/.claude/secrets-pushover.env}"

# --- Read the hook payload (JSON on stdin) -------------------------------
PAYLOAD="$(cat 2>/dev/null || true)"

# Cheap, jq-free extraction of a top-level string field.
extract() {
  printf '%s' "$PAYLOAD" \
    | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
    | head -n1
}

CWD="$(extract cwd)"
[ -z "$CWD" ] && CWD="$PWD"
PROJECT="$(basename "$CWD")"

# Notification events carry a human-readable message; surface it when present.
MSG="$(extract message)"

case "$EVENT_LABEL" in
  needs-input)
    TITLE="⏳ $PROJECT — needs you"
    BODY="${MSG:-Assistant is waiting for your input}"
    ;;
  *)
    TITLE="✅ $PROJECT — done"
    BODY="${MSG:-Session finished responding}"
    ;;
esac

# --- macOS banner --------------------------------------------------------
if command -v osascript >/dev/null 2>&1; then
  esc() { printf '%s' "$1" | sed 's/"/\\"/g'; }
  osascript -e "display notification \"$(esc "$BODY")\" with title \"$(esc "$TITLE")\" sound name \"Glass\"" >/dev/null 2>&1 || true
fi

# --- Pushover push -------------------------------------------------------
if [ -f "$SECRETS_FILE" ]; then
  # shellcheck disable=SC1090
  . "$SECRETS_FILE"
  if [ -n "${PUSHOVER_TOKEN:-}" ] && [ -n "${PUSHOVER_USER:-}" ]; then
    curl -s --max-time 8 \
      --form-string "token=$PUSHOVER_TOKEN" \
      --form-string "user=$PUSHOVER_USER" \
      --form-string "title=$TITLE" \
      --form-string "message=$BODY" \
      https://api.pushover.net/1/messages.json >/dev/null 2>&1 || true
  fi
fi

exit 0
