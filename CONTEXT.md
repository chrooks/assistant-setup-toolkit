# Assistant Setup Toolkit

A portable collection of instructions, skills, hooks, manifests, and installers that configures coding assistants consistently across machines.

## Language

**Assistant Setup Toolkit**:
A portable collection of instructions, skills, hooks, manifests, and installers that configures coding assistants consistently across machines.
_Avoid_: dotfiles, config repo, plugin repo

**Assistant Home**:
A user-level install destination owned by, or discovered by, an assistant.
_Avoid_: config folder, dot directory, install path

**Assistant Target**:
A supported assistant runtime that the toolkit can configure.
_Avoid_: app, platform, client

**Assistant Payload**:
A selected set of toolkit files prepared for installation into an Assistant Home.
_Avoid_: config, stuff, files, bundle

**Toolkit Component**:
A user-selectable part of the toolkit that can be included in an Assistant Payload.
_Avoid_: module, package, asset

**Skill**:
A portable agent instruction package rooted at `SKILL.md` that teaches an assistant a specialized workflow.
_Avoid_: command, plugin

**Plugin**:
An installable assistant extension that may bundle skills, metadata, tools, or app-specific integration files.
_Avoid_: skill, link, repo

**Installation Manifest**:
A structured source list that tells the setup wizard which external skills and plugins are available to fetch or install.
_Avoid_: plugin list, checklist, registry

**Setup Wizard**:
The interactive and flag-driven installer that turns selected Assistant Targets and Toolkit Components into installed Assistant Payloads.
_Avoid_: installer, bootstrap script, setup script

**Safe Merge**:
The default install behavior that backs up existing Assistant Homes and copies selected payload files without deleting unrelated existing files.
_Avoid_: merge, copy, normal install

**Overwrite Install**:
An explicit install behavior that backs up existing Assistant Homes and replaces conflicting selected payload files without deleting unrelated existing files.
_Avoid_: force install, clean install

**Prune Install**:
An explicit install behavior that backs up existing Assistant Homes, installs the selected payload, and removes toolkit-owned files that are no longer selected or no longer present in the source.
_Avoid_: overwrite, reset, wipe

**Install Receipt**:
A timestamped machine-readable record of toolkit-owned files written during a Setup Wizard run.
_Avoid_: lockfile, manifest, state file

**Skill Artifact**:
A generated ZIP package of a Skill prepared for manual upload to a desktop or web assistant.
_Avoid_: skill, plugin, bundle

**Target Projection**:
A generated target-specific view of canonical toolkit files.
_Avoid_: conversion, copy, sync

**Canonical Assistant Source**:
The toolkit directory whose files are edited directly and used to generate target projections.
_Avoid_: source directory, template, upstream

**External Source**:
A remote repository or URL that provides skills, plugins, or other toolkit components for the Setup Wizard to fetch.
_Avoid_: dependency, package, plugin

**MCP Server**:
An external tool server that an assistant can connect to for runtime capabilities through the Model Context Protocol.
_Avoid_: plugin, skill, extension

**Setup Profile**:
A named selection of Assistant Targets, Toolkit Components, write behavior, and fetch options that the Setup Wizard can run repeatably.
_Avoid_: preset, config, recipe

**Default Install**:
The Setup Profile that installs all applicable Toolkit Components for the selected Assistant Targets using Safe Merge.
_Avoid_: full install, standard install

**Custom Install**:
A Setup Profile built interactively by selecting Assistant Targets and Toolkit Components.
_Avoid_: partial install, manual install

**Fetch Step**:
The Setup Wizard phase that downloads or updates External Sources before building Assistant Payloads or Skill Artifacts.
_Avoid_: install, sync, clone

**Verification Step**:
The Setup Wizard phase that checks files, permissions, generated projections, receipts, and artifacts after an install or dry run.
_Avoid_: tests, validation, audit

**Next Steps**:
A target-specific post-install checklist printed by the Setup Wizard for actions it cannot or should not automate.
_Avoid_: instructions, summary, todo

## Relationships

- The **Assistant Setup Toolkit** installs assistant-specific configuration into one or more **Assistant Homes**.
- The **Assistant Setup Toolkit** configures one or more **Assistant Targets**.
- An **Assistant Target** may have one or more **Assistant Homes**.
- The **Setup Wizard** builds an **Assistant Payload** for each selected **Assistant Target**.
- A default **Assistant Payload** includes everything relevant for that **Assistant Target**.
- A custom **Assistant Payload** includes only the components selected by the user.
- **Toolkit Components** include instructions, plans, hooks, skills, commands, settings, and manifests.
- A **Skill** is a **Toolkit Component**.
- A **Plugin** may contain one or more **Skills**.
- A GitHub repository can be a plugin source, a skill source, or both; the manifest decides how the wizard treats it.
- Zipped skill artifacts are for manual desktop upload, not the canonical source of a **Skill**.
- The **Installation Manifest** can include skill sources, plugin sources, MCP server sources, target compatibility, default selection, and install notes.
- `PLUGINS.md` is currently a human checklist; it should become or be paired with an **Installation Manifest** before plugin installation is automated.
- The **Setup Wizard** reads the **Installation Manifest**.
- The **Setup Wizard** builds an **Assistant Payload** for each selected **Assistant Target**.
- The **Setup Wizard** backs up Assistant Homes before writing to them.
- The **Setup Wizard** can run in dry-run mode without writing.
- The **Setup Wizard** uses **Safe Merge** by default.
- `--overwrite` selects **Overwrite Install**.
- `--prune` selects **Prune Install**.
- **Safe Merge**, **Overwrite Install**, and **Prune Install** all create backups before writing.
- **Prune Install** only removes toolkit-owned files, proven by an install receipt from a previous install.
- The **Setup Wizard** writes an **Install Receipt** after a successful non-dry-run install.
- An **Install Receipt** belongs to one **Assistant Home** and records the installed **Assistant Target**, selected **Assistant Payload**, timestamp, and toolkit-owned file list.
- Toolkit-owned files are files previously written by the **Setup Wizard** and recorded in an **Install Receipt**.
- A **Skill Artifact** is derived from a **Skill**.
- A **Skill Artifact** is not the canonical source of a **Skill**.
- The **Setup Wizard** may generate **Skill Artifacts** even when it cannot automate desktop app installation.
- `artifacts/<skill-name>.zip` is a **Skill Artifact**.
- `canonical/` is the **Canonical Assistant Source** for shared assistant instructions and skills.
- `.codex/` and `.agents/` are **Target Projections** for Codex CLI.
- **Target Projections** are derived from the **Canonical Assistant Source**.
- The **Setup Wizard** regenerates **Target Projections** before installing Codex payloads to avoid drift.
- Changes should be made in the **Canonical Assistant Source** unless a target-specific override is intentionally needed.
- The **Installation Manifest** lists **External Sources**.
- An **External Source** may provide a **Skill**, a **Plugin**, or many **Skills**.
- Fetching an **External Source** may produce local **Skills**, **Plugins**, or **Skill Artifacts**.
- An **MCP Server** is a **Toolkit Component** when the **Setup Wizard** can configure it for an **Assistant Target**.
- The **Installation Manifest** can list **External Sources** for **MCP Servers**.
- Playwright MCP and Context7 are **MCP Servers**.
- Some **MCP Servers** require local prerequisites or secrets, such as a Context7 API key.
- The **Setup Wizard** should configure **MCP Servers** only with user confirmation and should not silently install or run arbitrary server processes.
- A **Setup Profile** can describe a **Default Install** or a **Custom Install**.
- A **Default Install** includes all applicable **Toolkit Components** for selected **Assistant Targets** and uses **Safe Merge**.
- During a **Default Install**, fetched **External Sources** are prepared first, then local **Toolkit Components** from the **Canonical Assistant Source** are applied afterward so local choices win conflicts.
- A **Custom Install** includes only the **Assistant Targets** and **Toolkit Components** selected by the user.
- The **Fetch Step** happens before the **Setup Wizard** builds **Assistant Payloads** or **Skill Artifacts**.
- The **Verification Step** checks copied files, executable hooks, generated **Target Projections**, **Install Receipts**, and **Skill Artifacts**.
- **Next Steps** cover actions the **Setup Wizard** cannot or should not automate, such as manual desktop skill upload or adding API keys.
- Claude Code and Codex CLI are **Assistant Targets**.
- Claude Desktop is not a first-version **Assistant Target** for automated installation; it receives generated skill artifacts and manual next steps.
- A single assistant can use more than one **Assistant Home**.
- Claude Code uses `~/.claude` as an **Assistant Home**.
- Codex CLI uses `~/.codex` for Codex configuration and `~/.agents` for shared agent skills; both are treated as **Assistant Homes**.

## Example Dialogue

> **Dev:** "Should this machine get the whole **Assistant Setup Toolkit** or only the Codex pieces?"
> **Domain expert:** "Use the **Default Install** for Claude Code and Codex CLI. Run the **Fetch Step** first, then apply local **Toolkit Components** from the **Canonical Assistant Source** so my local skills win conflicts."

## Flagged Ambiguities

- "config repo" sounds like generic dotfiles; resolved: use **Assistant Setup Toolkit** for this repo's product/domain.
- `~/.agents` is not branded as Codex, but Codex discovers agent skills from it; resolved: define **Assistant Home** as any user-level install destination owned by, or discovered by, an assistant.
- "plugin" and "skill" were both used for GitHub repos; resolved: a **Skill** is rooted at `SKILL.md`, while a **Plugin** is an extension package or manifest that may bundle skills.
- "overwrite" could mean replacing conflicts or wiping an Assistant Home; resolved: **Overwrite Install** replaces payload conflicts only, while **Prune Install** removes only toolkit-owned files tracked by an install receipt.
- ".codex" and ".agents" could drift from ".claude"; resolved: `.claude/` is the **Canonical Assistant Source**, and Codex files are **Target Projections**.
