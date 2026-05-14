# Claude HowTo Extension Map

Use this reference before creating, changing, or reviewing assistant extensions in this repository. It maps the local `claude-howto` repository to Assistant Setup Toolkit decisions.

## Source Map

Local reference repository:

- `/Users/cdbrooks/Development/Software/Repositories/claude-howto`

Useful paths:

- `03-skills/README.md` - Skill shape, Progressive Disclosure, frontmatter, supporting files, invocation controls, and testing.
- `06-hooks/README.md` - hook script event model, matcher behavior, JSON stdin/stdout, exit-code behavior, and security practices.
- `07-plugins/README.md` - Plugin structure, local plugin development, plugin testing, marketplace distribution, and component bundling.
- `05-mcp/README.md` - MCP Server configuration patterns and when live external tool access is appropriate.
- `07-plugins/*/` - example Plugins that combine commands, agents, MCP config, hooks, scripts, and templates.

Treat those files as example-driven guidance. Do not copy them into `canonical/` wholesale. Before preserving exact Claude Code schema details, refresh the official Claude Code docs for Skills, Plugins, hooks, MCP Servers, and plugin marketplaces.

## Toolkit Decision Rules

Use a Skill for one reusable workflow or one reusable reference. In this repository, a Skill belongs under `canonical/skills/<name>/SKILL.md`, and large details should move into nearby `references/`, `templates/`, `examples/`, or `scripts/` files.

Use a Plugin for bundled multi-component distribution. A Plugin is appropriate when the extension needs a cohesive package of several parts, such as Skills plus agents, hook scripts, MCP Servers, settings, or templates. If the request is only a single reusable workflow, keep it as a Skill.

Use a hook script for event-triggered side effects. A hook script is appropriate when behavior must run before or after assistant lifecycle events such as tool use, prompt submission, session start, or session end. Validate hook scripts with sample JSON stdin, syntax checks, exit-code checks, and target-runtime checks.

Use an MCP Server for live external tool or data access. An MCP Server is appropriate when the assistant should interact with a live tool, database, service, or API instead of relying on pasted or static context.

Use Next Steps for actions the Setup Wizard should surface but not run. Native plugin install commands, MCP Server secrets, external installer commands, OAuth setup, and manual desktop or web uploads should be printed as Next Steps unless the user explicitly asks the Setup Wizard to automate them.

## Implementation Guidance

Start in the Canonical Assistant Source. Edit `canonical/` first, then verify Target Projections through the Setup Wizard path. Do not edit generated `.codex/` or `.agents/` files as the source of truth.

For Skill work:

- Keep `SKILL.md` concise.
- Put the key trigger terms early in `description`.
- Use `user-invocable: false` for background reference guidance.
- Use `disable-model-invocation: true` for user-driven workflows with side effects.
- Keep supporting files discoverable through relative links from `SKILL.md`.

For Plugin work:

- Check whether the request genuinely needs multiple components or distribution.
- Keep `.claude-plugin/plugin.json` metadata separate from root-level component directories.
- Test local Plugins with `claude --plugin-dir ./path/to/plugin` before distribution.
- Use plugin marketplaces when the goal is team or community distribution.

For hook script work:

- Keep hook script behavior narrow and deterministic.
- Read JSON from stdin and handle missing fields safely.
- Use explicit event and matcher wiring.
- Avoid hardcoded credentials and avoid processing sensitive files unless explicitly required.
- Verify installed copies in each Assistant Home because runtime semantics can differ.

For Installation Manifest work:

- Treat `installCommands` as metadata that feeds Next Steps unless the user explicitly asks for execution.
- Keep third-party commands source-backed and time-sensitive.
- Extend schema, manifest, and tests together when adding manifest fields.
- Preserve the Boundary between fetching External Sources and running external installers.

## Verification Checklist

For a Skill:

- `SKILL.md` has a clear description and valid frontmatter.
- Supporting files are referenced by relative path.
- Setup Wizard dry run shows projection into `.agents/skills/<name>/` for Codex.
- Skill Artifact planning includes `<name>.zip` when applicable.

For a Plugin:

- Local run with `claude --plugin-dir ./path/to/plugin` succeeds.
- Skills appear under the plugin namespace.
- Agents, hook scripts, and MCP Servers load only when intended.
- Marketplace metadata is valid before distribution.

For a hook script:

- Syntax check passes, such as `node --check` for JavaScript or `bash -n` for shell.
- A sample JSON stdin smoke test exercises the intended event.
- Blocking behavior and non-blocking output are tested explicitly.
- Installed copies are checked in both Claude Code and Codex CLI Assistant Homes when shared.

For Setup Wizard changes:

- Add focused tests first.
- Run `npm run typecheck`.
- Run the relevant `npx vitest run ...` checks.
- Run `npm run setup -- --codex --default --dry-run` and inspect projection output.
- Keep generated projection changes only when they prove expected canonical source behavior.
