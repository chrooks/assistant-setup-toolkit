# Installation Wizard — Clarifying Questions

> **Status:** Answered  
> **Feature:** A cross-platform setup wizard for installing this repo's Claude, Codex, hooks, skills, plugins, and assistant home files.  
> **Date:** 2026-05-06

> **Research note:** Claude Code discovers personal skills from `~/.claude/skills/`, project skills from `.claude/skills/`, and plugin-bundled skills from installed plugins. Claude web/Desktop custom skills are documented as ZIP uploads through Customize/Settings > Skills, with the ZIP containing the skill folder as its root. No reliable public desktop-app filesystem install path was found for automating Claude Desktop skill uploads, so desktop support should be treated as artifact generation plus guided next steps unless a supported API/path is later confirmed.

Please answer each question on the line below it. For follow-up questions, just ask in the chat.

---

## 1. Runtime & Entry Point

**Reference context:** `mattpocock/skills` uses `npx skills@latest add mattpocock/skills` as the first-run wizard: users pick skills and target coding agents, then run `/setup-matt-pocock-skills` inside their agent for project-local configuration. Its `.claude-plugin/plugin.json` is a simple manifest of installable skill directories, and local development can symlink skills into `~/.claude/skills`.

**Q1a: Should the wizard be implemented as Node + TypeScript + `tsx`, or should it stay dependency-free with Bash/PowerShell wrappers?**

> Why this matters: Node + `tsx` gives us one cross-platform implementation and a better interactive CLI, but it introduces a runtime/dependency requirement that fresh machines may not have.

Answer: Node + tsx, if you have claude code or codex then u have node

**Q1b: What command should users run as the primary install path?**

> Why this matters: This determines whether we add `package.json` scripts like `npm run setup`, keep `scripts/install.sh` and `scripts/install.ps1` as the public entry points, or support both.

Answer: give recommendation

Clarification: Recommend `npm run setup` as the friendly primary command after clone, backed by `tsx scripts/setup.ts`. Also support direct use via `npx tsx scripts/setup.ts` for people who do not want to install dependencies first. Flags should pass through after `--`, for example `npm run setup -- --codex --default --dry-run`.

**Q1c: Should the wizard be fully interactive, flag-driven, or both?**

> Why this matters: Interactive prompts are friendlier for a first setup, while flags make repeatable machine bootstrap easier.

Answer: both, for example, a --overwrite flag that tells it to overwrite preexisting  setup, --codex to install to codex

---

## 2. Install Targets

**Q2a: Which targets should the wizard support in its first version: Claude Code, Codex CLI, Claude Desktop, Codex Desktop, or all four?**

> Why this matters: CLI/home-directory installs are straightforward; desktop app installs may require OS-specific discovery paths and different skill/plugin formats.

Answer: Claude code and codex cli

**Q2b: For Claude Code, should the wizard install `.claude/` exactly as-is into `~/.claude/`, or should it selectively install files like `CLAUDE.md`, `PLAN.md`, hooks, commands, and skills?**

Answer: by default prompt user if they want default or custom installation. default ->install everything, custome -> go thru and mark what you want installed. --default flag passed to skip step and go w default

**Q2c: For Codex, should `.codex/` and `.agents/` be generated from `.claude/` every time before install, or should the wizard trust the checked-in `.codex/` and `.agents/` folders?**

> Why this matters: Generating avoids drift, but trusting checked-in output makes installs faster and more predictable if generated files are intentionally edited.

Answer: I want to have a single source of truth so i only have to update one thing when I edit something in the setup toolkit. avoid drift at all costs

---

## 3. Merge, Backup & Safety

**Q3a: When target files already exist in `~/.claude`, `~/.codex`, or `~/.agents`, should the wizard overwrite, merge, skip, or prompt per conflict?**

> Why this matters: These directories can contain personal config. The safest default is usually backup + merge, but that can make the wizard more verbose.

Answer: backup and merge by default, backup + overwrite when prompted or if --overwrite 

**Q3b: Should every non-dry-run install create a timestamped backup before changing assistant home directories?**

Answer: yes

**Q3c: Should symlink mode be supported in addition to copy mode?**

> Why this matters: Symlinks keep machines automatically synced to this repo, but they are more fragile across Windows/macOS and can surprise tools that expect real files.

Answer: Yes if possible

---

## 4. Skills & Plugins

**Q4a: Should the wizard call `scripts/get-skills.sh` / an equivalent downloader during setup, or only install skill artifacts that already exist under `artifacts/`?**

> Why this matters: Downloading gives fresh artifacts but requires network access; using checked-in artifacts makes offline installs possible.

Answer: get skills or equiv downloader

**Q4b: Which skills should be included by default?**

> Current repo signals include `commit`, `feature`, `handoff`, `mode`, `to-prd`, `grill-with-docs`, `setup-matt-pocock-skills`, and `find-skills`.

Answer: anything in skills dir (convert all commands to skills first) + mattpocock skills +ui/ux pro max + find-skills + everything claude code + codex-plugin-cc if claude code exists

**Q4c: What should "install plugins" mean for this repo: open/list links from `PLUGINS.md`, download plugin repositories, install Codex/Claude plugins if a local plugin system exists, or something else?**

> Why this matters: `PLUGINS.md` is currently a human checklist, not a machine-readable manifest.

Answer: ownload plugin repositories + install Codex/Claude plugins if a local plugin system exists

**Q4d: Should `PLUGINS.md` become a structured manifest, such as YAML or JSON, so the wizard can parse plugin names, URLs, and target assistants reliably?**

Answer: Yes YAML works

---

## 5. Desktop App Installation

**Q5a: What desktop app locations should the wizard detect on macOS and Windows for Claude Desktop and Codex Desktop?**

> Why this matters: The script can only safely install desktop-app skills if we know the canonical config locations and file formats.

Answer: no clue, web research this

**Q5b: If a desktop app is not installed or its config path is missing, should the wizard skip silently, warn, or offer to create the expected directory?**

Answer: warn

**Q5c: Do desktop app skill installs need zipped artifacts, raw `SKILL.md` folders, or another format?**

Answer: not sure, to do it on claude desktop i was using the skill zipped artificatcs,= and manually installing via the ui, but do web research to see if this is possible automatically

---

## 6. Verification & UX

**Q6a: What should the wizard verify after install?**

> Examples: files copied, hooks executable, generated Codex files current, skill zips present, assistant home directories discovered.

Answer: all the above

**Q6b: Should the wizard print a final "next steps" checklist tailored to the selected targets?**

Answer: yes

**Q6c: Should dry-run mode be mandatory in the first prompt before writing anything, or just available as an option?**

Answer: wym?

Clarification: This means whether the wizard should force users to preview changes before writing. Recommendation: make `--dry-run` available, but do not make it mandatory. Instead, show a clear install summary and ask for confirmation before the first write in interactive mode. In non-interactive flag mode, require explicit target flags and use backup-by-default for safety.

---

## 7. Testing Scope

**Q7a: What level of automated testing do you want for the wizard?**

> Why this matters: A cross-platform installer benefits from unit tests around path detection and copy/merge behavior, plus integration tests against temp directories.

Answer: what do you recommend

Clarification: Recommend unit tests for target selection, path resolution, manifest parsing, backup naming, and merge/overwrite decisions. Add integration tests that install into temporary fake home directories for Claude and Codex targets, including dry-run, default install, custom component selection, overwrite, and symlink modes where supported.

**Q7b: Should tests run on both macOS and Windows in CI, or is local cross-platform design enough for now?**

Answer: both 
