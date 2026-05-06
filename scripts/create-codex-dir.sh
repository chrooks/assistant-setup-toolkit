#!/usr/bin/env bash

# Creates Codex-compatible project structure from canonical/ source.
#
# Mapping:
#   canonical/CLAUDE.md       -> .codex/AGENTS.md
#   canonical/PLAN.md         -> .codex/PLAN.md
#   canonical/skills/         -> .agents/skills/
#   canonical/commands/       -> skipped (no Codex equivalent)
#   canonical/hooks/          -> skipped (no Codex equivalent)
#   canonical/settings.*.json -> skipped (Codex uses .codex/config.toml)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/canonical"

log() {
  printf '%s\n' "$*"
}

sanitize_skill_frontmatter() {
  awk '
    BEGIN {
      in_frontmatter = 0
      frontmatter_delimiters = 0
    }

    function quote_value(value, escaped) {
      if (value ~ /^[[:space:]]*["'\''"]/ ) {
        return value
      }

      escaped = value
      gsub(/\\/, "\\\\", escaped)
      gsub(/"/, "\\\"", escaped)
      return "\"" escaped "\""
    }

    /^---[[:space:]]*$/ {
      frontmatter_delimiters++
      if (frontmatter_delimiters == 1) {
        in_frontmatter = 1
      } else if (frontmatter_delimiters == 2) {
        in_frontmatter = 0
      }

      print
      next
    }

    {
      if (in_frontmatter) {
        key = $0
        sub(/:.*/, "", key)

        if (key == "description" || key == "argument-hint") {
          value = $0
          sub(/^[^:]+:[[:space:]]*/, "", value)
          print key ": " quote_value(value)
          next
        }
      }

      print
    }
  '
}

# Rewrite text references from Claude conventions to Codex conventions.
rewrite_content() {
  local source="$1"

  if [ "$(basename "$source")" = "SKILL.md" ]; then
    sed \
      -e 's/\.claude/.codex/g' \
      -e 's/CLAUDE\.md/AGENTS.md/g' \
      -e 's/claude/codex/g' \
      -e 's/Claude/Codex/g' \
      "$source" | sanitize_skill_frontmatter
    return
  fi

  sed \
    -e 's/\.claude/.codex/g' \
    -e 's/CLAUDE\.md/AGENTS.md/g' \
    -e 's/claude/codex/g' \
    -e 's/Claude/Codex/g' \
    "$source"
}

# Copy a file with content rewriting, skipping if unchanged.
copy_rewritten() {
  local source="$1"
  local target="$2"
  local display_target="$3"
  local tmp_file

  tmp_file="$(mktemp "${TMPDIR:-/tmp}/create-codex-dir.XXXXXX")"

  rewrite_content "$source" > "$tmp_file"

  if [ -f "$target" ] && cmp -s "$tmp_file" "$target"; then
    rm -f "$tmp_file"
    log "Unchanged ${display_target}"
    return
  fi

  local verb="Copying"
  [ -f "$target" ] && verb="Updating"

  log "${verb} ${source#${REPO_ROOT}/} -> ${display_target}"

  mkdir -p "$(dirname "$target")"
  mv "$tmp_file" "$target"

  if [ -x "$source" ]; then
    chmod 755 "$target"
  else
    chmod 644 "$target"
  fi
}

main() {
  if [ ! -d "$SOURCE_DIR" ]; then
    log "Error: source directory not found: $SOURCE_DIR" >&2
    exit 1
  fi

  log "Creating Codex project structure from canonical/"

  # 1. CLAUDE.md -> .codex/AGENTS.md
  local codex_dir="${REPO_ROOT}/.codex"
  mkdir -p "$codex_dir"

  if [ -f "${SOURCE_DIR}/CLAUDE.md" ]; then
    copy_rewritten \
      "${SOURCE_DIR}/CLAUDE.md" \
      "${codex_dir}/AGENTS.md" \
      ".codex/AGENTS.md"
  fi

  # 2. Skills -> .agents/skills/ (each skill is a subdirectory with SKILL.md)
  local skills_dir="${SOURCE_DIR}/skills"
  local agents_dir="${REPO_ROOT}/.agents/skills"

  if [ -d "$skills_dir" ]; then
    mkdir -p "$agents_dir"
    log "Creating .agents/skills/"

    # Walk skill subdirectories (each contains SKILL.md + optional files)
    while IFS= read -r skill_dir; do
      local skill_name
      skill_name="$(basename "$skill_dir")"
      local target_skill_dir="${agents_dir}/${skill_name}"
      mkdir -p "$target_skill_dir"

      # Copy all files within the skill directory
      while IFS= read -r skill_file; do
        local rel_file="${skill_file#${skill_dir}/}"
        copy_rewritten \
          "$skill_file" \
          "${target_skill_dir}/${rel_file}" \
          ".agents/skills/${skill_name}/${rel_file}"
      done < <(find "$skill_dir" -type f -print | LC_ALL=C sort)
    done < <(find "$skills_dir" -mindepth 1 -maxdepth 1 -type d -print | LC_ALL=C sort)
  fi

  # 3. Log skipped directories
  for skipped in commands hooks; do
    if [ -d "${SOURCE_DIR}/${skipped}" ]; then
      log "Skipping canonical/${skipped}/ (no Codex equivalent)"
    fi
  done

  if ls "${SOURCE_DIR}"/settings*.json 1>/dev/null 2>&1; then
    log "Skipping canonical/settings*.json (Codex uses .codex/config.toml)"
  fi

  # 4. Copy PLAN.md if present -> .codex/PLAN.md
  if [ -f "${SOURCE_DIR}/PLAN.md" ]; then
    copy_rewritten \
      "${SOURCE_DIR}/PLAN.md" \
      "${codex_dir}/PLAN.md" \
      ".codex/PLAN.md"
  fi

  log "Done."
}

main "$@"
