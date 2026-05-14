---
name: consult
description: Advisory guidance for creating, changing, or reviewing Skills, Plugins, hook scripts, manifests/install.yaml, Setup Wizard extension behavior, MCP Servers, and assistant extension verification in this repository.
user-invocable: false
---

# Consult

Use this Skill when work touches assistant extension decisions in this repository: Skills, Plugins, hook scripts, MCP Servers, Installation Manifest entries, Setup Wizard behavior, Skill Artifacts, or extension verification.

Before making or reviewing those decisions:

1. Read `references/codex-howto-extension-map.md`.
2. Use this repository's Lexicon terms exactly.
3. Treat local how-to repositories as example-driven reference sources, not as code to copy wholesale.
4. Prefer the existing Assistant Setup Toolkit pipeline and existing project Boundaries before inventing new Setup Wizard behavior.
5. Refresh official documentation before locking exact schema, CLI, or lifecycle details into code or long-lived docs.
6. If the reference map and local docs are insufficient, use Context7 or web search for current extension documentation before guessing.

Default decision rules:

- Use a Skill for one reusable workflow or reusable reference guidance.
- Use a Plugin for bundled multi-component distribution.
- Use a hook script for event-triggered side effects.
- Use an MCP Server for live external tool or data access.
- Use Next Steps for actions the Setup Wizard should surface but not run.
