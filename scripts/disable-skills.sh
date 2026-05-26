#!/usr/bin/env bash
# disable-skills.sh — park (or restore) user-level Claude Code Skills.
#
# "Disables" Skills by moving their directory from ~/.claude/skills/<name>
# to ~/.claude/skills-disabled/<name>. Reversible. Does NOT touch plugin
# Skills — those are disabled via settings.json enabledPlugins.
#
# Usage:
#   disable-skills.sh disable [list-file]   — park Skills listed in list-file
#   disable-skills.sh restore [list-file]   — move back from skills-disabled
#   disable-skills.sh status                — show what's parked
#
# Default list-file: toolkit/artifacts/skill-usage/disable-list.txt
# Lines beginning with # are ignored. Blank lines ignored. Trailing whitespace
# is trimmed.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_LIST="$ROOT/artifacts/skill-usage/disable-list.txt"

SKILLS_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
PARK_DIR="${CLAUDE_SKILLS_PARK_DIR:-$HOME/.claude/skills-disabled}"

mode="${1:-status}"
list_file="${2:-$DEFAULT_LIST}"

case "$mode" in
  disable)
    [[ -f "$list_file" ]] || { echo "error: list file not found: $list_file" >&2; exit 1; }
    mkdir -p "$PARK_DIR"
    moved=0 missing=0 already=0
    while IFS= read -r name; do
      name="${name%%#*}"           # strip inline comments
      name="${name#"${name%%[![:space:]]*}"}"
      name="${name%"${name##*[![:space:]]}"}"
      [[ -z "$name" ]] && continue

      src="$SKILLS_DIR/$name"
      dst="$PARK_DIR/$name"

      if [[ -d "$dst" ]]; then
        already=$((already+1)); continue
      fi
      if [[ ! -d "$src" ]]; then
        missing=$((missing+1)); continue
      fi
      mv "$src" "$dst"
      moved=$((moved+1))
    done < "$list_file"
    echo "parked: $moved   already parked: $already   not found at user level: $missing"
    echo "park dir: $PARK_DIR"
    ;;

  restore)
    [[ -f "$list_file" ]] || { echo "error: list file not found: $list_file" >&2; exit 1; }
    restored=0 missing=0
    while IFS= read -r name; do
      name="${name%%#*}"
      name="${name#"${name%%[![:space:]]*}"}"
      name="${name%"${name##*[![:space:]]}"}"
      [[ -z "$name" ]] && continue

      src="$PARK_DIR/$name"
      dst="$SKILLS_DIR/$name"

      if [[ ! -d "$src" ]]; then
        missing=$((missing+1)); continue
      fi
      if [[ -d "$dst" ]]; then
        echo "warn: $name already exists at user level, skipping" >&2
        continue
      fi
      mv "$src" "$dst"
      restored=$((restored+1))
    done < "$list_file"
    echo "restored: $restored   not in park dir: $missing"
    ;;

  status)
    if [[ -d "$PARK_DIR" ]]; then
      parked_count=$(find "$PARK_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
      active_count=$(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
      echo "active user Skills:  $active_count  ($SKILLS_DIR)"
      echo "parked user Skills:  $parked_count  ($PARK_DIR)"
    else
      active_count=$(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
      echo "active user Skills:  $active_count  ($SKILLS_DIR)"
      echo "parked user Skills:  0  (park dir does not exist yet)"
    fi
    ;;

  *)
    cat <<USAGE
usage: $(basename "$0") <disable|restore|status> [list-file]

  disable [list-file]   move Skills listed in list-file out of ~/.claude/skills
  restore [list-file]   move them back
  status                show counts of active vs parked Skills

list-file defaults to: $DEFAULT_LIST
USAGE
    exit 2
    ;;
esac
