---
name: consult
description: Advisory guidance for creating, changing, or reviewing Skills, Plugins, hook scripts, manifests/install.yaml, Setup Wizard extension behavior, MCP Servers, and assistant extension verification.
user-invocable: false
---

# Consult

Use this Skill when work touches assistant extension decisions in this repository: Skills, Plugins, hook scripts, MCP Servers, Installation Manifest entries, Setup Wizard behavior, Skill Artifacts, or extension verification.

Before making or reviewing those decisions:

1. Pull the latest from the `claude-howto` reference repo before searching it: `git -C /Users/cdbrooks/Development/Software/Repositories/claude-howto pull --ff-only 2>/dev/null || true`.
2. Read `references/claude-howto-extension-map.md`.
3. Use this repository's Lexicon terms exactly.
4. Treat `/Users/cdbrooks/Development/Software/Repositories/claude-howto` as an example-driven reference source, not as code to copy wholesale.
5. Prefer the existing Assistant Setup Toolkit pipeline and existing Canonical Assistant Source patterns before inventing new Setup Wizard behavior.
6. Refresh official Claude Code documentation before locking exact schema, CLI, or lifecycle details into code or long-lived docs.
7. If the reference repo and local docs are insufficient, search the web (Context7 MCP, web search) for current Claude Code extension documentation before guessing.

Default decision rules:

- Use a Skill for one reusable workflow or reusable reference guidance.
- Use a Plugin for bundled multi-component distribution.
- Use a hook script for event-triggered side effects.
- Use an MCP Server for live external tool or data access.
- Use Next Steps for actions the Setup Wizard should surface but not run.
