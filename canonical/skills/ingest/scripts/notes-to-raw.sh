#!/usr/bin/env bash
#
# notes-to-raw.sh — Import an Apple Notes note into the LLM-Wiki raw-sources folder.
#
# Reads the vault location from ~/.claude/knowledge-config.json, pulls a note's
# body out of Apple Notes via AppleScript, converts HTML -> Markdown (pandoc if
# available, else textutil), and writes it to <vaultPath>/<rawDir>/<slug>.md.
#
# This is an *import* step only — it lands the note in raw-sources. Running the
# `ingest` skill afterward integrates it into the wiki.
#
# Usage:
#   notes-to-raw.sh "Exact Note Title"     # import one note by exact title
#   notes-to-raw.sh --list                 # list note titles to find the exact one
#
# Note: the first run triggers a one-time macOS Automation permission prompt
# (granting the terminal access to Notes). Approve it or the export fails.

set -euo pipefail

CONFIG="$HOME/.claude/knowledge-config.json"

die() { echo "notes-to-raw: $*" >&2; exit 1; }

command -v osascript >/dev/null 2>&1 || die "osascript not found (macOS only)."
command -v jq >/dev/null 2>&1 || die "jq not found. Install with: brew install jq"
[ -f "$CONFIG" ] || die "missing config: $CONFIG"

# --- List mode: print note titles so the caller can pick an exact match -------
if [ "${1:-}" = "--list" ]; then
  osascript -e 'tell application "Notes" to get name of every note' 2>/dev/null \
    | tr ',' '\n' | sed 's/^ *//' \
    || die "could not read Notes (grant Automation permission and retry)."
  exit 0
fi

TITLE="${1:-}"
[ -n "$TITLE" ] || die "usage: notes-to-raw.sh \"Exact Note Title\"  (or --list)"

VAULT="$(jq -r '.vaultPath' "$CONFIG")"
RAWDIR="$(jq -r '.rawDir // "raw-sources"' "$CONFIG")"
[ -n "$VAULT" ] && [ "$VAULT" != "null" ] || die "vaultPath missing in $CONFIG"
DEST_DIR="$VAULT/$RAWDIR"
[ -d "$DEST_DIR" ] || die "raw-sources dir not found: $DEST_DIR"

# --- Pull the note body (HTML) via AppleScript --------------------------------
# Returns the body of the first note whose name matches TITLE exactly.
BODY_HTML="$(osascript <<APPLESCRIPT 2>/dev/null || true
tell application "Notes"
  set matches to notes whose name is "$TITLE"
  if (count of matches) is 0 then return "__NOT_FOUND__"
  return body of item 1 of matches
end tell
APPLESCRIPT
)"

[ -n "$BODY_HTML" ] || die "could not read Notes — grant Automation permission (System Settings > Privacy & Security > Automation) and retry."
[ "$BODY_HTML" != "__NOT_FOUND__" ] || die "no note titled \"$TITLE\". Run with --list to see exact titles."

# --- HTML -> Markdown ---------------------------------------------------------
if command -v pandoc >/dev/null 2>&1; then
  BODY_MD="$(printf '%s' "$BODY_HTML" | pandoc -f html -t markdown_strict 2>/dev/null)"
else
  BODY_MD="$(printf '%s' "$BODY_HTML" | textutil -stdin -format html -convert txt -stdout 2>/dev/null)"
fi

# --- Slug + write -------------------------------------------------------------
SLUG="$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//')"
[ -n "$SLUG" ] || SLUG="apple-note"
TODAY="$(date +%F)"
DEST="$DEST_DIR/$SLUG.md"

cat > "$DEST" <<MD
---
type: source
title: "$TITLE"
source: apple-notes
date_imported: $TODAY
---

$BODY_MD
MD

echo "$DEST"
