#!/usr/bin/env bash
# claude-notify.sh — macOS banner + Pushover push when an assistant session
# finishes a turn (Stop) or needs your input (Notification).
#
# Canonical Assistant Source: edit here, then `npm run setup` (or the
# canonical-sync hook) projects this into each Assistant Home and wires it
# against Stop + Notification per canonical/hooks/wiring.yaml.
#
# Quiet-debounce (Stop / "done" only):
#   When a turn finishes, wait DEBOUNCE_SEC. If a new prompt arrives in that
#   window you're actively working — stay silent. Only ping after real silence
#   (you walked away). Activity is stamped by notify-activity.sh on
#   UserPromptSubmit. "needs-input" stays immediate: it's rarer, actionable,
#   and answering a permission prompt is not a UserPromptSubmit, so debouncing
#   it would misfire.
#
# Cross-assistant: reads JSON on stdin, degrades safely on missing fields, so
# the same script serves Claude Code and Codex CLI payloads.
#
# Pushover secrets are NOT stored here. They live in a private chmod-600 file
# the user creates once (surfaced as a Setup Wizard Next Step):
#   ~/.claude/secrets-pushover.env   with PUSHOVER_TOKEN= and PUSHOVER_USER=
# The Mac banner always fires; Pushover fires only when that file + both keys
# are present.
#
# Usage:
#   claude-notify.sh done          # Stop event (debounced)
#   claude-notify.sh needs-input   # Notification event (immediate)
#   claude-notify.sh __send "<title>" "<body>"   # internal: actually emit

set -euo pipefail

DEBOUNCE_SEC="${NOTIFY_DEBOUNCE_SEC:-45}"
SECRETS_FILE="${PUSHOVER_SECRETS_FILE:-$HOME/.claude/secrets-pushover.env}"
RUN_DIR="${NOTIFY_RUN_DIR:-$HOME/.claude/run}"
MODE="${1:-done}"

# --- Internal: emit the notification (banner + push) ---------------------
if [ "$MODE" = "__send" ]; then
  TITLE="${2:-Assistant}"
  BODY="${3:-Session update}"
  if command -v osascript >/dev/null 2>&1; then
    esc() { printf '%s' "$1" | sed 's/"/\\"/g'; }
    osascript -e "display notification \"$(esc "$BODY")\" with title \"$(esc "$TITLE")\" sound name \"Glass\"" >/dev/null 2>&1 || true
  fi
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
fi

# --- Read the hook payload (JSON on stdin) -------------------------------
PAYLOAD="$(cat 2>/dev/null || true)"
extract() {
  printf '%s' "$PAYLOAD" \
    | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
    | head -n1
}

CWD="$(extract cwd)"
[ -z "$CWD" ] && CWD="$PWD"
PROJECT="$(basename "$CWD")"
MSG="$(extract message)"

# Per-session key for the activity stamp. Prefer session_id; fall back to a
# stable hash of cwd so sessions in the same repo still get a key.
SESSION_ID="$(extract session_id)"
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="cwd-$(printf '%s' "$CWD" | cksum | cut -d' ' -f1)"
fi
ACT_FILE="$RUN_DIR/notify-$SESSION_ID.act"

case "$MODE" in
  needs-input)
    # Immediate — no debounce.
    exec bash "$0" __send "⏳ $PROJECT — needs you" "${MSG:-Assistant is waiting for your input}"
    ;;
  *)
    TITLE="✅ $PROJECT — done"
    BODY="${MSG:-Session finished responding}"
    BEFORE="$(cat "$ACT_FILE" 2>/dev/null || echo 0)"
    SELF="$0"
    # Background the wait so the hook returns immediately. After DEBOUNCE_SEC,
    # ping only if no newer activity stamp landed (you stayed away).
    (
      sleep "$DEBOUNCE_SEC"
      AFTER="$(cat "$ACT_FILE" 2>/dev/null || echo 0)"
      if [ "$AFTER" -le "$BEFORE" ]; then
        bash "$SELF" __send "$TITLE" "$BODY"
      fi
    ) >/dev/null 2>&1 &
    exit 0
    ;;
esac
