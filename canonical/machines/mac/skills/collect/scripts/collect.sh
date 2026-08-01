#!/usr/bin/env bash
#
# collect.sh — pull this Mac's Apple Notes and Voice Memos into the brain's
# raw-sources inbox. Collection only; never touches the wiki.
#
# Usage:
#   collect.sh                      # everything modified since the last run
#   collect.sh --since 2026-07-01   # explicit window (required on first run)
#   collect.sh --dry-run            # list what would be pulled, write nothing
#   collect.sh --notes-only | --memos-only
#
set -euo pipefail

CONFIG="$HOME/.claude/knowledge-config.json"
STATE_DIR="$HOME/.config/collect"
STATE="$STATE_DIR/last-run"

die() { echo "collect: $*" >&2; exit 1; }
note() { echo "collect: $*"; }

command -v osascript >/dev/null 2>&1 || die "osascript not found — this runs on macOS only."
command -v jq >/dev/null 2>&1 || die "jq not found (brew install jq)."

SINCE=""; DRY=0; DO_NOTES=1; DO_MEMOS=1
while [ $# -gt 0 ]; do
  case "$1" in
    --since) SINCE="${2:-}"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --notes-only) DO_MEMOS=0; shift ;;
    --memos-only) DO_NOTES=0; shift ;;
    -h|--help) sed -n '3,12p' "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

# --- Resolve the vault --------------------------------------------------------
[ -f "$CONFIG" ] || die "no $CONFIG — can't find the vault."
VAULT="$(jq -r '.vaultPath' "$CONFIG")"
RAWDIR="$(jq -r '.rawDir // "raw-sources"' "$CONFIG")"
[ -n "$VAULT" ] && [ "$VAULT" != "null" ] || die "vaultPath missing in $CONFIG"
[ -d "$VAULT" ] || die "vault not found at $VAULT — is LiveSync set up on this Mac?"
INBOX="$VAULT/$RAWDIR/inbox"
mkdir -p "$INBOX"

# --- Watermark ----------------------------------------------------------------
# Epoch seconds. --since wins and does not consume the watermark.
if [ -n "$SINCE" ]; then
  # Anchor at midnight — BSD date fills unspecified fields from *now*, so a bare
  # "%Y-%m-%d" would silently cut off at the current time of day and skip that
  # morning's items.
  CUTOFF="$(date -j -f "%Y-%m-%d %H:%M:%S" "$SINCE 00:00:00" "+%s" 2>/dev/null)" \
    || die "--since must be YYYY-MM-DD (got: $SINCE)"
elif [ -f "$STATE" ]; then
  CUTOFF="$(cat "$STATE")"
else
  die "no watermark yet — pass --since YYYY-MM-DD on the first run, or it would export everything."
fi
note "collecting items modified since $(date -r "$CUTOFF" '+%Y-%m-%d %H:%M')"

FAILED=0
COLLECTED=0

# --- Apple Notes --------------------------------------------------------------
# List name + modification epoch, tab-separated, then filter in bash. Export of
# each changed note is delegated to the ingest Skill's notes-to-raw.sh so there
# is exactly one HTML->Markdown converter in the toolkit.
if [ "$DO_NOTES" = 1 ]; then
  # id first, title last: a title may contain a tab, and `read` puts every
  # leftover field into the final variable, so only the title can absorb one.
  NOTES_TSV="$(osascript <<'APPLESCRIPT' 2>/dev/null || true
set out to ""
tell application "Notes"
  repeat with n in notes
    set out to out & (id of n) & tab & ((modification date of n) as «class isot» as string) & tab & (name of n) & linefeed
  end repeat
end tell
return out
APPLESCRIPT
)"

  if [ -z "$NOTES_TSV" ]; then
    echo "collect: could not read Notes — grant Automation permission (System Settings > Privacy & Security > Automation) and retry." >&2
    FAILED=1
  else
    NOTE_SCRIPT="$HOME/.claude/skills/ingest/scripts/notes-to-raw.sh"
    [ -f "$NOTE_SCRIPT" ] || die "expected $NOTE_SCRIPT (from the ingest Skill) — run the Setup Wizard."
    while IFS=$'\t' read -r ID ISO NAME; do
      [ -n "${ID:-}" ] || continue
      # ISO looks like 2026-07-30T14:22:01; strip the T for BSD date.
      MOD="$(date -j -f "%Y-%m-%d %H:%M:%S" "${ISO/T/ }" "+%s" 2>/dev/null || echo 0)"
      [ "$MOD" -gt "$CUTOFF" ] || continue
      # Export by id, not title: Apple Notes titles are not unique, and passing a
      # title would export whichever note matched first — twice — and drop the
      # other. notes-to-raw.sh suffixes the filename when slugs collide.
      if [ "$DRY" = 1 ]; then
        echo "  would pull note: $NAME"
      else
        if bash "$NOTE_SCRIPT" --id "$ID" >/dev/null; then
          echo "  note: $NAME"
        else
          echo "collect: failed to export note: $NAME" >&2
          FAILED=1
          continue
        fi
      fi
      COLLECTED=$((COLLECTED + 1))
    done <<< "$NOTES_TSV"
  fi
fi

# --- Voice Memos --------------------------------------------------------------
# The container has moved between macOS releases; probe the known locations.
if [ "$DO_MEMOS" = 1 ]; then
  MEMO_DIR=""
  for CANDIDATE in \
    "$HOME/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings" \
    "$HOME/Library/Application Support/com.apple.voicememos/Recordings" \
    "$HOME/Library/Application Support/AudioRecordings"
  do
    [ -d "$CANDIDATE" ] && { MEMO_DIR="$CANDIDATE"; break; }
  done

  if [ -z "$MEMO_DIR" ]; then
    echo "collect: no Voice Memos directory found — skipping memos. (Checked the known macOS locations; if yours differs, add it to this script.)" >&2
  elif ! ls "$MEMO_DIR" >/dev/null 2>&1; then
    # The directory exists but won't open: that container is TCC-protected, and
    # `test -d` passes while every read fails. Distinguish it from "not found",
    # or a permissions problem reads as "you have no voice memos".
    echo "collect: found $MEMO_DIR but cannot read it — grant Full Disk Access to this terminal (System Settings > Privacy & Security > Full Disk Access), then retry." >&2
    FAILED=1
  else
    note "voice memos from: $MEMO_DIR"
    while IFS= read -r SRC; do
      [ -n "$SRC" ] || continue
      # Filter by mtime here rather than with find -newermt: BSD find rejects
      # the @epoch form, and failed silently enough to report zero memos.
      [ "$(stat -f %m "$SRC")" -gt "$CUTOFF" ] || continue
      BASE="$(basename "$SRC")"
      STAMP="$(date -r "$SRC" '+%Y-%m-%d')"
      SLUG="$(printf '%s' "${BASE%.*}" | tr '[:upper:]' '[:lower:]' \
        | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//')"
      DEST="$INBOX/$STAMP-${SLUG:-memo}.m4a"
      if [ "$DRY" = 1 ]; then
        echo "  would pull memo: $BASE -> $(basename "$DEST")"
      elif [ -e "$DEST" ]; then
        continue   # already collected in an earlier run
      else
        cp -p "$SRC" "$DEST" && echo "  memo: $(basename "$DEST")" || { FAILED=1; continue; }
      fi
      COLLECTED=$((COLLECTED + 1))
    done < <(find "$MEMO_DIR" -maxdepth 1 -name '*.m4a')
  fi
fi

# --- Watermark advance --------------------------------------------------------
# Only on a clean, non-dry run that covered both sources: a partial failure must
# not let the next run skip what it missed, and a --notes-only/--memos-only run
# would move the mark past items on the side it never looked at.
#
# An explicit --since DOES advance the mark. It has to: the first run has no
# watermark and refuses to run without --since, so anything else deadlocks. Once
# a run collects everything from its window up to now, "now" is the honest mark
# however that window was chosen.
if [ "$DRY" = 0 ] && [ "$FAILED" = 0 ] && [ "$DO_NOTES" = 1 ] && [ "$DO_MEMOS" = 1 ]; then
  mkdir -p "$STATE_DIR"; date +%s > "$STATE"
elif [ "$FAILED" = 1 ]; then
  echo "collect: some items failed — watermark NOT advanced, so the next run retries them." >&2
fi

echo
if [ "$DRY" = 1 ]; then
  note "dry run — $COLLECTED item(s) would land in $INBOX"
else
  note "collected $COLLECTED item(s) into $INBOX"
  [ "$COLLECTED" -gt 0 ] && note "next: run /ingest to file them."
fi
exit 0
