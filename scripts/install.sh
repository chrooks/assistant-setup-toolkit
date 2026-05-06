#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOME_DIR="$HOME"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--claude] [--codex] [--dry-run]

Copy agent config directories from this repo to your home directory.

Flags:
  --claude    Copy canonical/ to ~/.claude/
  --codex     Copy .codex/ to ~/.codex/ and .agents/ to ~/.agents/
  --dry-run   Show what would be copied without doing it

At least one of --claude or --codex is required.
Both can be specified together.
EOF
  exit 1
}

# Parse flags
INSTALL_CLAUDE=false
INSTALL_CODEX=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --claude)  INSTALL_CLAUDE=true; shift ;;
    --codex)   INSTALL_CODEX=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help) usage ;;
    *)
      echo "Error: unknown flag '$1'" >&2
      usage
      ;;
  esac
done

if ! $INSTALL_CLAUDE && ! $INSTALL_CODEX; then
  echo "Error: specify at least one of --claude or --codex" >&2
  usage
fi

# Copy a source directory to a target, merging files without deleting extras
install_dir() {
  local src="$1"
  local dest="$2"
  local label="$3"

  if [ ! -d "$src" ]; then
    echo "Error: source directory not found: $src" >&2
    echo "  Run scripts/create-codex-dir.sh first if installing --codex" >&2
    return 1
  fi

  echo "Installing ${label}: ${src} -> ${dest}"

  if $DRY_RUN; then
    echo "  [dry-run] would rsync ${src}/ to ${dest}/"
    return 0
  fi

  # rsync merges into target, preserves permissions, shows changes
  rsync -av --itemize-changes "${src}/" "${dest}/"
  echo "Done: ${label} installed to ${dest}"
}

if $INSTALL_CLAUDE; then
  install_dir "${REPO_ROOT}/canonical" "${HOME_DIR}/.claude" "canonical -> ~/.claude"
fi

if $INSTALL_CODEX; then
  install_dir "${REPO_ROOT}/.codex" "${HOME_DIR}/.codex" ".codex"
  install_dir "${REPO_ROOT}/.agents" "${HOME_DIR}/.agents" ".agents"
fi

echo ""
echo "Install complete."
