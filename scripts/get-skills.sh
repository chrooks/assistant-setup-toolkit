#!/usr/bin/env bash
# ---
# name: get-skills
# description: Download agent skills and package each skill as a Claude.ai-ready zip.
# capabilities:
#   - Downloads default skills from mattpocock/skills when run without arguments.
#   - Downloads specific mattpocock/skills entries by path, such as engineering/to-prd.
#   - Downloads GitHub skill folders from /tree/<branch>/<path> URLs when they contain SKILL.md.
#   - Writes each skill to artifacts/<skill-name>/SKILL.md.
#   - Writes each uploadable archive to artifacts/<skill-name>.zip.
# inputs:
#   - No arguments: downloads DEFAULT_SKILLS.
#   - Relative skill paths: resolved under mattpocock/skills/skills.
#   - GitHub tree URLs: resolved to the matching raw SKILL.md.
# outputs:
#   - artifacts/<skill-name>/SKILL.md
#   - artifacts/<skill-name>.zip
# ---
#
# Downloads skills and zips them correctly for upload to Claude.ai.
#
# Usage:
#   ./scripts/get-skills.sh
#   ./scripts/get-skills.sh engineering/to-prd engineering/grill-with-docs
#   ./scripts/get-skills.sh productivity/<skill-name> misc/<skill-name>
#   ./scripts/get-skills.sh https://github.com/vercel-labs/skills/tree/main/skills/find-skills

set -euo pipefail

BASE_URL="https://raw.githubusercontent.com/mattpocock/skills/refs/heads/main/skills"
OUT_DIR="/Users/cdbrooks/Development/Software/Repositories/code-assistant-context/artifacts"
DEFAULT_SKILLS=(
  "engineering/to-prd"
  "engineering/grill-with-docs"
)

if [ "$#" -eq 0 ]; then
  SKILLS=("${DEFAULT_SKILLS[@]}")
else
  SKILLS=("$@")
fi

mkdir -p "$OUT_DIR"

for skill_path in "${SKILLS[@]}"; do
  if [[ "$skill_path" =~ ^https://github\.com/([^/]+)/([^/]+)/tree/([^/]+)/(.*)$ ]]; then
    github_owner="${BASH_REMATCH[1]}"
    github_repo="${BASH_REMATCH[2]}"
    github_branch="${BASH_REMATCH[3]}"
    github_path="${BASH_REMATCH[4]}"
    skill_name="$(basename "$github_path")"
    skill_url="https://raw.githubusercontent.com/$github_owner/$github_repo/refs/heads/$github_branch/$github_path/SKILL.md"
  else
    skill_name="$(basename "$skill_path")"
    skill_url="$BASE_URL/$skill_path/SKILL.md"
  fi

  skill_dir="$OUT_DIR/$skill_name"

  mkdir -p "$skill_dir"

  echo "📥 Downloading $skill_path..."
  curl -fsSL "$skill_url" -o "$skill_dir/SKILL.md"

  echo "🗜️  Zipping $skill_name..."
  (
    cd "$OUT_DIR"
    zip -qr "$skill_name.zip" "$skill_name/"
  )
done

echo "✅ Done! Files saved to $OUT_DIR"
for skill_path in "${SKILLS[@]}"; do
  echo "   → $(basename "$skill_path").zip"
done
open "$OUT_DIR"
