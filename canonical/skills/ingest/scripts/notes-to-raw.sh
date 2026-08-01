#!/usr/bin/env bash
#
# notes-to-raw.sh — Import an Apple Notes note into the LLM-Wiki raw-sources folder.
#
# Reads the vault location from ~/.claude/knowledge-config.json, pulls a note's
# body out of Apple Notes via AppleScript, converts HTML -> Markdown (pandoc if
# available, else textutil), and writes it to <vaultPath>/<rawDir>/inbox/<slug>.md.
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

# Select by id when given. Titles are not unique in Apple Notes — two notes can
# share one, and selecting by title silently exports whichever comes first. Ids
# are unique, and they survive titles containing quotes.
NOTE_ID=""
TITLE=""
if [ "${1:-}" = "--id" ]; then
  NOTE_ID="${2:-}"
  [ -n "$NOTE_ID" ] || die "usage: notes-to-raw.sh --id <note-id>"
else
  TITLE="${1:-}"
  [ -n "$TITLE" ] || die "usage: notes-to-raw.sh \"Exact Note Title\"  (or --id <id>, --list)"
fi

VAULT="$(jq -r '.vaultPath' "$CONFIG")"
RAWDIR="$(jq -r '.rawDir // "raw-sources"' "$CONFIG")"
[ -n "$VAULT" ] && [ "$VAULT" != "null" ] || die "vaultPath missing in $CONFIG"
# Imports land in inbox/ — that's what marks them not-yet-ingested, and it's
# where the inbox walk looks. Writing to rawDir root hides them from the drain.
[ -d "$VAULT/$RAWDIR" ] || die "raw-sources dir not found: $VAULT/$RAWDIR"
DEST_DIR="$VAULT/$RAWDIR/inbox"
mkdir -p "$DEST_DIR"

# --- Pull the note via AppleScript --------------------------------------------
# Returns id, then title, then body, separated by a marker line the body will not
# contain. Fetching the id even in title mode lets the writer below tell "the
# same note again" from "a different note with the same title".
SEP="__NOTES_TO_RAW_FIELD__"
# The selector is interpolated into AppleScript source, so escape backslashes
# first, then quotes — a note titled  He said "hi"  would otherwise not parse.
if [ -n "$NOTE_ID" ]; then
  ESCAPED="${NOTE_ID//\\/\\\\}"; ESCAPED="${ESCAPED//\"/\\\"}"
  SELECTOR="notes whose id is \"$ESCAPED\""
  WANTED="note with id $NOTE_ID"
else
  ESCAPED="${TITLE//\\/\\\\}"; ESCAPED="${ESCAPED//\"/\\\"}"
  SELECTOR="notes whose name is \"$ESCAPED\""
  WANTED="note titled \"$TITLE\""
fi

RAW="$(osascript <<APPLESCRIPT 2>/dev/null || true
tell application "Notes"
  set matches to $SELECTOR
  if (count of matches) is 0 then return "__NOT_FOUND__"
  set n to item 1 of matches
  return (id of n) & "$SEP" & (name of n) & "$SEP" & (body of n)
end tell
APPLESCRIPT
)"

[ -n "$RAW" ] || die "could not read Notes — grant Automation permission (System Settings > Privacy & Security > Automation) and retry."
[ "$RAW" != "__NOT_FOUND__" ] || die "no $WANTED. Run with --list to see exact titles."

NOTE_ID="${RAW%%"$SEP"*}"
REST="${RAW#*"$SEP"}"
TITLE="${REST%%"$SEP"*}"
BODY_HTML="${REST#*"$SEP"}"

# --- HTML -> Markdown ---------------------------------------------------------
# Apple Notes uses U+2028/U+2029 (LINE/PARAGRAPH SEPARATOR) for soft breaks, and
# both survive the HTML conversion. Editors flag them as unusual line
# terminators and plenty of markdown tooling does not treat them as breaks at
# all, so normalise them to real newlines on the way through.
normalise() { perl -CSD -pe 's/[\x{2028}\x{2029}]/\n/g'; }

if command -v pandoc >/dev/null 2>&1; then
  BODY_MD="$(printf '%s' "$BODY_HTML" | pandoc -f html -t markdown_strict 2>/dev/null | normalise)"
else
  BODY_MD="$(printf '%s' "$BODY_HTML" | textutil -stdin -format html -convert txt -stdout 2>/dev/null | normalise)"
fi

# --- Slug + write -------------------------------------------------------------
SLUG="$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//')"
[ -n "$SLUG" ] || SLUG="apple-note"
TODAY="$(date +%F)"
DEST="$DEST_DIR/$SLUG.md"

# Two notes sharing a title slug to the same filename, so the second would erase
# the first. Every export records its note_id; if the file on disk belongs to a
# different note, fall back to a suffixed name. The suffix comes from the id
# rather than a counter so re-exporting the same note keeps overwriting one file
# instead of piling up -2, -3, -4 on every run.
EXISTING_ID="$(sed -n 's/^note_id: //p' "$DEST" 2>/dev/null | head -1)"
if [ -e "$DEST" ] && [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "$NOTE_ID" ]; then
  DEST="$DEST_DIR/$SLUG-${NOTE_ID##*/}.md"
fi
# An existing file with NO note_id was written before ids were recorded, not by
# a different note. Overwriting it upgrades it in place; treating it as a
# stranger instead forks every previously exported note into a second copy.

# " is the frontmatter string delimiter; a title containing one must not end it.
YAML_TITLE="${TITLE//\"/\\\"}"

cat > "$DEST" <<MD
---
type: source
title: "$YAML_TITLE"
source: apple-notes
note_id: $NOTE_ID
date_imported: $TODAY
---

$BODY_MD
MD

echo "$DEST"
