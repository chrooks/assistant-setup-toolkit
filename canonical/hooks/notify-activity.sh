#!/usr/bin/env bash
# notify-activity.sh — stamp "you're actively working in this session" on every
# UserPromptSubmit. claude-notify.sh reads this stamp to decide whether to stay
# quiet (you're here) or ping (you walked away). See claude-notify.sh.
#
# Canonical Assistant Source: edit here; projected to each Assistant Home by
# the Setup Wizard / canonical-sync hook per canonical/hooks/wiring.yaml.

set -euo pipefail

RUN_DIR="${NOTIFY_RUN_DIR:-$HOME/.claude/run}"
PAYLOAD="$(cat 2>/dev/null || true)"

extract() {
  printf '%s' "$PAYLOAD" \
    | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
    | head -n1
}

CWD="$(extract cwd)"
[ -z "$CWD" ] && CWD="$PWD"
SESSION_ID="$(extract session_id)"
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="cwd-$(printf '%s' "$CWD" | cksum | cut -d' ' -f1)"
fi

mkdir -p "$RUN_DIR"
date +%s > "$RUN_DIR/notify-$SESSION_ID.act" 2>/dev/null || true

exit 0
