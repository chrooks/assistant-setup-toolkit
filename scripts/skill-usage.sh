#!/usr/bin/env bash
# skill-usage.sh — audit Claude Code Skill invocations vs installed Skills.
#
# Output dir: toolkit/artifacts/skill-usage/
#   used.txt        — sorted unique Skills ever invoked across all transcripts (with counts)
#   installed.txt   — sorted unique Skills currently installed
#   unused.txt      — installed minus used
#   summary.txt     — counts + top-20 + suggested disable candidates
#
# Re-run any time. Reads ~/.claude/projects/**/*.jsonl transcripts.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/artifacts/skill-usage"
mkdir -p "$OUT"

PROJECTS_DIR="${CLAUDE_PROJECTS_DIR:-$HOME/.claude/projects}"
SKILLS_USER="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
PLUGIN_MARKETPLACES="$HOME/.claude/plugins/marketplaces"

if [[ ! -d "$PROJECTS_DIR" ]]; then
  echo "error: no Claude projects dir at $PROJECTS_DIR" >&2
  exit 1
fi

# --- USED: count Skill tool invocations across all transcripts -------------
find "$PROJECTS_DIR" -name "*.jsonl" -print0 \
  | xargs -0 cat 2>/dev/null \
  | grep -o '"name":"Skill"[^}]*"skill":"[^"]*"' \
  | grep -o '"skill":"[^"]*"' \
  | sed 's/"skill":"//; s/"$//' \
  | sort \
  | uniq -c \
  | sort -rn > "$OUT/used.txt"

# --- INSTALLED: user-level + plugin marketplace Skills ---------------------
{
  [[ -d "$SKILLS_USER" ]] && ls -1 "$SKILLS_USER" 2>/dev/null
  if [[ -d "$PLUGIN_MARKETPLACES" ]]; then
    for ns_dir in "$PLUGIN_MARKETPLACES"/*/skills; do
      [[ -d "$ns_dir" ]] || continue
      ns=$(basename "$(dirname "$ns_dir")")
      ls -1 "$ns_dir" 2>/dev/null | sed "s|^|${ns}:|"
      # also emit unnamespaced form — Skill tool accepts both
      ls -1 "$ns_dir" 2>/dev/null
    done
  fi
} | sort -u > "$OUT/installed.txt"

# --- UNUSED: installed minus used ------------------------------------------
used_names=$(awk '{print $2}' "$OUT/used.txt" | sort -u)
comm -23 "$OUT/installed.txt" <(printf "%s\n" "$used_names") > "$OUT/unused.txt"

# --- SUMMARY ---------------------------------------------------------------
installed_count=$(wc -l < "$OUT/installed.txt" | tr -d ' ')
used_count=$(printf "%s\n" "$used_names" | grep -c . || true)
unused_count=$(wc -l < "$OUT/unused.txt" | tr -d ' ')

{
  echo "Claude Code Skill usage audit — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Transcripts scanned: $(find "$PROJECTS_DIR" -name '*.jsonl' | wc -l | tr -d ' ')"
  echo
  echo "Installed: $installed_count"
  echo "Ever used: $used_count"
  echo "Unused:    $unused_count  ($(( unused_count * 100 / (installed_count == 0 ? 1 : installed_count) ))% of installed)"
  echo
  echo "--- Top 20 used ---"
  head -20 "$OUT/used.txt"
  echo
  echo "--- Suggested disable candidates (unused, sample 50) ---"
  head -50 "$OUT/unused.txt"
  echo
  echo "Full lists: $OUT/{used,installed,unused}.txt"
} > "$OUT/summary.txt"

cat "$OUT/summary.txt"
