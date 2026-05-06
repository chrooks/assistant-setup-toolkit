# Installation Wizard PRD

> **Status:** needs-triage  
> **Feature:** Setup Wizard for the Assistant Setup Toolkit  
> **Date:** 2026-05-06

## Domain Language Relationship Hierarchy

```text
Assistant Setup Toolkit
├── Canonical Assistant Source
│   └── Target Projection
├── Setup Wizard
│   ├── Setup Profile
│   │   ├── Default Install
│   │   └── Custom Install
│   ├── Fetch Step
│   │   └── External Source
│   │       ├── Skill
│   │       ├── Plugin
│   │       └── MCP Server
│   ├── Assistant Target
│   │   └── Assistant Home
│   ├── Assistant Payload
│   │   └── Toolkit Component
│   │       ├── instructions
│   │       ├── plans
│   │       ├── hooks
│   │       ├── commands
│   │       ├── skills
│   │       ├── settings
│   │       └── manifests
│   ├── write behavior
│   │   ├── Safe Merge
│   │   ├── Overwrite Install
│   │   └── Prune Install
│   ├── Install Receipt
│   ├── Skill Artifact
│   ├── Verification Step
│   └── Next Steps
└── Installation Manifest
    └── External Source
```

The **Assistant Setup Toolkit** is the product. The **Setup Wizard** is the user-facing installer. The **Canonical Assistant Source** is edited directly, while **Target Projections** are generated to avoid drift. The **Installation Manifest** describes **External Sources**. The **Setup Wizard** turns selected **Assistant Targets** and **Toolkit Components** into **Assistant Payloads**, writes them to **Assistant Homes**, records **Install Receipts**, verifies the result, and prints **Next Steps** for anything it cannot safely automate.

## Problem Statement

Setting up this Assistant Setup Toolkit on a new machine requires too much manual knowledge. A user has to know which files belong in which Assistant Homes, when to run the Claude-to-Codex projection scripts, how to fetch external skills and plugins, how to package Skill Artifacts for desktop upload, how to avoid overwriting personal assistant configuration, and how to configure MCP Servers safely.

The current scripts are useful but fragmented. There are separate shell and PowerShell installers, separate target projection scripts, a skill artifact downloader, and a human-readable plugin checklist. This makes repeatable setup across macOS and Windows harder than it should be and creates drift risk between the Canonical Assistant Source and Codex Target Projections.

## Solution

Build a cross-platform Node + TypeScript Setup Wizard, runnable primarily through `npm run setup` and directly through `npx tsx scripts/setup.ts`. The Setup Wizard supports both interactive and flag-driven setup for Claude Code and Codex CLI. It prompts for a Default Install or Custom Install, supports Safe Merge by default, creates timestamped backups before non-dry-run writes, records Install Receipts, and offers explicit Overwrite Install and Prune Install modes.

The Setup Wizard treats `.claude/` as the Canonical Assistant Source and regenerates Codex Target Projections before installing Codex payloads. It converts the current plugin checklist into a YAML Installation Manifest that can list External Sources for Skills, Plugins, and MCP Servers. In a Default Install, it fetches and prepares External Sources first, then applies Toolkit Components from the local Canonical Assistant Source afterward so local skills win conflicts. It prepares Skill Artifacts where appropriate, configures MCP Servers only with explicit confirmation, and prints Next Steps for manual desktop skill uploads and secret-dependent setup.

## User Stories

1. As a user setting up a new Mac, I want to run one setup command, so that I can install the Assistant Setup Toolkit without remembering several scripts.
2. As a user setting up Windows, I want the same Setup Wizard to work, so that I do not need a separate mental model for PowerShell.
3. As a user, I want `npm run setup` to be the recommended command, so that the entry point is easy to discover.
4. As a user, I want `npx tsx scripts/setup.ts` to work directly, so that I can run the wizard without committing to a package install flow first.
5. As a user, I want interactive prompts, so that I can make setup choices safely on a fresh machine.
6. As a user, I want flags such as `--claude`, `--codex`, `--default`, `--dry-run`, `--overwrite`, and `--prune`, so that I can automate repeat installs.
7. As a user, I want to choose Claude Code as an Assistant Target, so that the wizard installs the Claude payload into the Claude Assistant Home.
8. As a user, I want to choose Codex CLI as an Assistant Target, so that the wizard installs Codex payloads into Codex Assistant Homes.
9. As a user, I want a Default Install, so that I can install every applicable Toolkit Component for the selected Assistant Targets.
10. As a user, I want a Custom Install, so that I can choose only the Toolkit Components I want.
11. As a user, I want `.claude/` treated as the Canonical Assistant Source, so that I only edit one source when changing shared assistant instructions or skills.
12. As a user, I want Codex Target Projections regenerated before Codex installs, so that `.codex/` and `.agents/` do not drift from `.claude/`.
13. As a user, I want the Setup Wizard to back up Assistant Homes before writing, so that I can recover from mistakes.
14. As a user, I want Safe Merge by default, so that unrelated personal assistant files are not deleted.
15. As a user, I want Overwrite Install as an explicit behavior, so that selected payload files can replace older conflicting files.
16. As a user, I want Prune Install as an explicit behavior, so that old toolkit-owned files can be removed when they are no longer selected or present.
17. As a user, I want Prune Install to rely on Install Receipts, so that the wizard never deletes arbitrary user-owned files.
18. As a user, I want timestamped Install Receipts, so that I can understand what the wizard installed and when.
19. As a user, I want dry-run mode, so that I can preview planned writes before changing Assistant Homes.
20. As a user, I want a confirmation summary before interactive writes, so that I know which Assistant Targets, Assistant Homes, and write behaviors will be used.
21. As a user, I want symlink mode where supported, so that my Assistant Homes can stay connected to this repo during active development.
22. As a user, I want the wizard to fetch External Sources, so that external Skills and Plugins are available without manual cloning.
23. As a user, I want local Toolkit Components applied after External Sources during a Default Install, so that my local skills can override outside skills with the same names.
24. As a user, I want a YAML Installation Manifest, so that external Skills, Plugins, and MCP Servers are machine-readable.
25. As a user, I want the wizard to include Skills found in the skills directories, so that existing local workflows are installed.
26. As a user, I want the wizard to convert existing commands to Skills first, so that skills become the primary workflow package format.
27. As a user, I want Matt Pocock skills available by default, so that the toolkit includes the engineering workflows I use.
28. As a user, I want UI/UX Pro Max available as an External Source, so that design-oriented assistance can be installed.
29. As a user, I want find-skills available as an External Source, so that agents can discover more skills later.
30. As a user, I want Everything Claude Code available as an External Source, so that Claude Code setup can include that ecosystem.
31. As a user, I want Codex for Claude Code available when Claude Code exists, so that Claude can invoke Codex-oriented workflows where supported.
32. As a user, I want Playwright MCP listed as an MCP Server, so that browser automation capabilities can be configured intentionally.
33. As a user, I want Context7 listed as an MCP Server with an API key note, so that documentation capabilities are configured without leaking secrets.
34. As a user, I want MCP Server configuration to require confirmation, so that the wizard does not silently install or run arbitrary tool servers.
35. As a user, I want Skill Artifacts generated for desktop or web assistants, so that I can manually upload ZIPs where automatic install is not supported.
36. As a user, I want the wizard to warn when desktop app automatic install is unsupported, so that I do not mistake artifact generation for installation.
37. As a user, I want a Verification Step, so that copied files, executable hooks, Target Projections, Install Receipts, and Skill Artifacts are checked.
38. As a user, I want executable hook permissions verified on macOS, so that installed hooks actually run.
39. As a user, I want Windows path behavior tested, so that the wizard does not assume Unix filesystem semantics.
40. As a user, I want Next Steps printed after setup, so that manual desktop uploads and secret setup are clear.
41. As a user, I want failed fetches to fail with context, so that I know which External Source failed and how to retry.
42. As a user, I want offline or skipped fetch behavior to be explicit, so that checked-in artifacts are not confused with freshly fetched sources.
43. As a maintainer, I want setup behavior in deep modules, so that copy, backup, projection, manifest parsing, and verification can be tested without running the whole CLI.
44. As a maintainer, I want the old shell and PowerShell installers either wrapped or deprecated, so that there is a single recommended setup path.
45. As a maintainer, I want the README updated, so that new users find the Setup Wizard immediately.
46. As a maintainer, I want local PRD and feature docs to use the domain glossary, so that future agents talk precisely about setup behavior.

## Implementation Decisions

- Build the Setup Wizard with Node + TypeScript and `tsx`.
- Recommend `npm run setup` as the primary entry point.
- Support direct execution through `npx tsx scripts/setup.ts`.
- Support interactive and flag-driven execution.
- First-version automated Assistant Targets are Claude Code and Codex CLI.
- Claude Desktop and web assistant support is limited to Skill Artifact generation and Next Steps.
- Treat `.claude/` as the Canonical Assistant Source.
- Regenerate Codex Target Projections before Codex payload installation.
- During a Default Install, fetch and prepare External Sources first, then overlay local Toolkit Components from the Canonical Assistant Source so local skills win conflicts.
- Convert existing command workflows to Skills before making skills the primary installable workflow format.
- Introduce a YAML Installation Manifest for External Sources, replacing or pairing with the current human-readable plugin checklist.
- Model Skills, Plugins, and MCP Servers separately in the Installation Manifest.
- Use Safe Merge by default.
- Implement Overwrite Install as replacement of selected payload conflicts only.
- Implement Prune Install as removal only of toolkit-owned files recorded in previous Install Receipts.
- Create timestamped backups for every non-dry-run write to an Assistant Home.
- Write an Install Receipt after successful non-dry-run installation.
- Support symlink mode where the operating system and permissions allow it.
- Do not silently configure, install, or run MCP Servers; require confirmation and print Next Steps for secrets.
- Generate Skill Artifacts for manual desktop or web upload where automatic installation is unsupported.
- Keep the CLI layer thin and put setup behavior into deep, testable modules.
- Proposed deep modules:
  - Domain model module for Assistant Targets, Assistant Homes, Setup Profiles, write behaviors, Toolkit Components, and receipts.
  - Manifest module for parsing and validating the YAML Installation Manifest.
  - Target projection module for regenerating Codex views from the Canonical Assistant Source.
  - Payload builder module for turning selected targets and components into Assistant Payloads.
  - Write planner module for Safe Merge, Overwrite Install, Prune Install, dry-run, backup, and symlink decisions.
  - Receipt module for writing and reading Install Receipts.
  - External source module for fetching Skills, Plugins, and MCP Server metadata.
  - Artifact module for generating Skill Artifacts.
  - MCP module for confirmed MCP Server configuration and Next Steps.
  - Verification module for checking files, permissions, projections, receipts, and artifacts.
  - CLI prompt/flags module for adapting user input into Setup Profiles.

## Testing Decisions

- Tests should focus on external behavior: given a repo fixture, selected Assistant Targets, selected Toolkit Components, and fake Assistant Homes, the Setup Wizard should plan or produce the expected filesystem state.
- Unit test the domain model and Setup Profile normalization.
- Unit test Installation Manifest parsing and validation, including Skills, Plugins, MCP Servers, target compatibility, defaults, and install notes.
- Unit test Assistant Home path resolution for macOS and Windows-style fake homes.
- Unit test Target Projection generation from the Canonical Assistant Source.
- Unit test Assistant Payload building for Claude Code and Codex CLI.
- Unit test Safe Merge, Overwrite Install, and Prune Install decisions without touching real Assistant Homes.
- Unit test Install Receipt creation, timestamp inclusion, and ownership boundaries.
- Unit test Skill Artifact packaging behavior with fixtures.
- Unit test MCP Server Next Steps for Context7 secrets and Playwright setup.
- Integration test dry-run mode against temporary fake Assistant Homes.
- Integration test Default Install for Claude Code.
- Integration test Default Install for Codex CLI, including projection regeneration.
- Integration test Custom Install with a subset of Toolkit Components.
- Integration test Overwrite Install replacing payload conflicts.
- Integration test Prune Install removing only receipt-owned stale files.
- Integration test symlink mode where the platform supports symlinks.
- Integration test Verification Step output for copied files, executable hooks, Target Projections, Install Receipts, and Skill Artifacts.
- Run tests in CI on macOS and Windows.

## Out of Scope

- Automatic Claude Desktop or Claude web custom skill upload.
- Automatic Codex Desktop setup unless a supported desktop target and format are later confirmed.
- Silent installation or execution of MCP Server processes.
- Secret storage for Context7 or any other MCP Server.
- Deleting arbitrary files in Assistant Homes.
- Full public package publishing of the Setup Wizard.
- Replacing the assistant ecosystem's official skill installer.
- Building a GUI installer.

## Further Notes

- The Setup Wizard should explain desktop limitations honestly: it can generate Skill Artifacts and print Next Steps, but it should not claim the desktop skill is installed.
- `PLUGINS.md` currently mixes plugins, skills, and MCP Servers. The PRD expects this to become or be paired with a structured YAML Installation Manifest.
- Existing shell and PowerShell scripts can remain as compatibility wrappers during migration, but the recommended path should become the Node + TypeScript Setup Wizard.
- The issue tracker is not configured in this repo, so this PRD is published locally with `needs-triage` status.
