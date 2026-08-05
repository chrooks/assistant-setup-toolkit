# Migration notes — 2026-07-25 restructure

Three renames landed on `main` (commits `22392aa`…`f7751c7`). server is fully
migrated. **Each other machine (pc, pc-wsl, mac, work) must do the steps below
once after pulling.** Delete this file when every machine has migrated.

## What changed

- Machine profiles: `canonical/rules/machines/<name>.md` and
  `canonical/skills/machines/<machine>/` → **`canonical/machines/<name>/`**
  (`rules.md` + `skills/<skill>/`). Install paths unchanged.
- Work docs: `feature_requests/` → **`.tasks/<issue#>-<slug>/`** folders
  (`throughline.md`, `plan.md`, related docs). Gitignored; skills add the
  ignore entry themselves. The devos-steering hook still reads legacy
  `feature_requests/*-throughline.md` until repos migrate.
- Canonical sources are target-neutral: `canonical/CLAUDE.md` →
  **`canonical/INSTRUCTIONS.md`** (still installs as `~/.claude/CLAUDE.md`,
  projects to Codex `AGENTS.md`); `CONTEXT.md` → **`LEXICON.md`** at both
  levels (global installs as `~/.claude/LEXICON.md`; project files named
  `LEXICON.md`, legacy `CONTEXT.md` still honored).
- `/handoff` writes files only when needed, to `.claude/handoffs/`
  (`.codex/handoffs/` on Codex) — `.cowork/` is gone.
- `/project-flow-setup` is now model-invocable (its `disable-model-invocation`
  flag is gone) and `/roadmap` and `/to-issues` run it inline when a repo lacks
  project-flow docs, instead of recommending it. No manual step — but step 2
  below is required, or these machines keep the old "recommend" wording.
- Visual-skill output consolidated: `.table-exports/`, `.diagram-exports/`, and
  `.figure-exports/` → **`.exports/<kind>/`**. One `.gitignore` entry
  (`.exports/`) now covers every visual skill, in any repo.

## Per-machine steps after `git pull`

1. **Move the local machine rule** (untracked, so git didn't move it):

   ```bash
   mv canonical/rules/machines/<name>.md canonical/machines/<name>/rules.md
   rmdir canonical/rules/machines 2>/dev/null
   ```

   Work laptop also moves its local machine skills, if any:

   ```bash
   mv canonical/skills/machines/work/* canonical/machines/work/skills/ 2>/dev/null
   rm -rf canonical/skills/machines
   ```

2. **Re-sync the install** (safe-merge skips existing files — overwrite is required):

   ```bash
   npm run setup -- --claude --default --write overwrite   # add --codex where installed
   ```

3. **Delete stale live copies** (sync never prunes):

   ```bash
   rm -f ~/.claude/CONTEXT.md ~/.codex/CONTEXT.md
   ```

4. **Any repo with old export dirs** (they are generated output — deleting is
   also fine):

   ```bash
   for k in table diagram figure; do
     [ -d ".$k-exports" ] && mkdir -p .exports && mv ".$k-exports" ".exports/$k"
   done
   ```

   Then replace the three `.gitignore` lines with the single entry `.exports/`.

5. **Optional, per repo, whenever convenient:** migrate `feature_requests/`
   docs into `.tasks/<slug>/` folders (`<file>-plan.md` → `<slug>/plan.md`,
   `<file>-throughline.md` → `<slug>/throughline.md`) and add `.tasks/` to the
   repo's `.gitignore`. Active runs keep working either way via the hook's
   legacy fallback.
