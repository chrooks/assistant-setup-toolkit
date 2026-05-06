# CodeAssistantContext Repo Guidance

This repository stores portable assistant configuration, scripts, prompts, and packaged skill artifacts. Keep changes small, explicit, and compatible with copying or symlinking these files into assistant-specific config directories.

## Skill Packaging Helper

- Use `./scripts/get-skills.sh` when a task needs to download agent skills and create Claude.ai-uploadable zip files.
- With no arguments, it downloads the repo's default skills from `mattpocock/skills` and writes each skill to `artifacts/<skill-name>/SKILL.md` plus `artifacts/<skill-name>.zip`.
- It accepts one or more `mattpocock/skills` paths, such as `engineering/to-prd` or `engineering/grill-with-docs`.
- It also accepts GitHub skill-folder URLs in the form `https://github.com/<owner>/<repo>/tree/<branch>/<path-to-skill>`, such as `https://github.com/vercel-labs/skills/tree/main/skills/find-skills`.
- Example usage:
  ```bash
  ./scripts/get-skills.sh
  ./scripts/get-skills.sh engineering/to-prd
  ./scripts/get-skills.sh https://github.com/vercel-labs/skills/tree/main/skills/find-skills
  ```

## Editing Notes

- Text files should end with an empty line.
- Prefer updating the relevant assistant-specific config in place rather than duplicating large instruction blocks.
- Keep generated skill outputs under `artifacts/`.
