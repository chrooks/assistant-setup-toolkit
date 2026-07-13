/**
 * Hook Wiring Manifest loader, planner, and applier.
 *
 * Reads `canonical/hooks/wiring.yaml`, validates it with Zod, and produces
 * idempotent wiring plans that merge hook entries into Claude Code's
 * `~/.claude/settings.json` and Codex CLI's `~/.codex/hooks.json`. For
 * Codex targets the applier also asserts the feature flag
 * `[features] hooks = true` in `~/.codex/config.toml`.
 *
 * Idempotency is keyed on the rendered command string. Re-running the
 * wizard never produces duplicate entries, and an entry wired by hand
 * earlier won't be re-added on the next run.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { AssistantTargetId } from "./domain.js";

// -- Manifest schema --

/** Targets a wiring entry can apply to. */
const TargetSchema = z.enum(["claude-code", "codex-cli"]);

/** Where the hook should be registered. Defaults to the selected Assistant Home. */
const WiringScopeSchema = z.enum(["assistant-home", "project"]);

/** A single wiring entry — one hook script bound to one event on one or more targets. */
const WiringEntrySchema = z.object({
  file: z.string().min(1, "file must not be empty"),
  event: z.string().min(1, "event must not be empty"),
  targets: z.array(TargetSchema).min(1, "targets must not be empty"),
  scope: WiringScopeSchema.optional(),
  matcher: z.string().optional(),
  timeoutSec: z.number().int().positive().optional(),
  /** Optional command template. `{hook}` and `{project}` are replaced with absolute paths. Defaults to `node {hook}`. */
  command: z.string().optional(),
  /** Optional Variant gate: the entry applies only when every pair matches the run's resolved variants (e.g. `machine: work`). */
  variants: z.record(z.string(), z.string()).optional(),
});

/** Full wiring manifest envelope. */
const WiringManifestSchema = z.object({
  version: z.literal(1),
  hooks: z.array(WiringEntrySchema),
});

// -- Public types (zod-inferred so they can't drift from the schema) --

export type WiringEntry = z.infer<typeof WiringEntrySchema>;
export type WiringManifest = z.infer<typeof WiringManifestSchema>;

/** A planned wiring action for one (entry × target) pair. */
export interface WiringAction {
  readonly target: AssistantTargetId;
  readonly settingsPath: string;
  readonly event: string;
  readonly matcher?: string;
  readonly timeoutSec?: number;
  /** Final rendered command string the assistant will run. */
  readonly command: string;
}

/** A planned feature-flag assertion (Codex only). */
export interface FeatureFlagAssertion {
  readonly tomlPath: string;
  readonly section: string;
  readonly key: string;
  readonly value: boolean;
  readonly deprecatedKeys?: readonly string[];
}

/** Per-target plan: one settings file plus optional feature-flag assertion. */
export interface WiringPlan {
  readonly target: AssistantTargetId;
  readonly settingsPath: string;
  readonly actions: readonly WiringAction[];
  readonly featureFlag?: FeatureFlagAssertion;
}

/** Summary returned by applyHookWiring for receipt/reporting. */
export interface ApplyWiringResult {
  readonly target: AssistantTargetId;
  readonly settingsPath: string;
  readonly added: number;
  readonly alreadyPresent: number;
  readonly flagAdded: boolean;
}

export interface PlanHookWiringOptions {
  readonly projectRoot?: string;
  /** The run's resolved Variant map (SetupProfile.variants). Entries carrying a `variants` gate are skipped unless every pair matches. */
  readonly variants?: Readonly<Record<string, string>>;
}

// -- Loader --

/**
 * Load and validate the Wiring Manifest at `<canonicalHooksDir>/wiring.yaml`.
 * Returns an empty array (not an error) when the manifest is absent — wiring
 * is opt-in, and a toolkit without it should still install cleanly.
 *
 * Throws a descriptive error when the file exists but is malformed.
 */
export async function loadWiringManifest(
  canonicalHooksDir: string,
): Promise<readonly WiringEntry[]> {
  const manifestPath = path.join(canonicalHooksDir, "wiring.yaml");
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, "utf-8");
  } catch (error: unknown) {
    if (isErrnoNotFound(error)) {
      return [];
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error: unknown) {
    throw new Error(
      `Failed to parse ${manifestPath}: ${getMessage(error)}`,
    );
  }

  const result = WiringManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid wiring manifest at ${manifestPath}: ${result.error.message}`,
    );
  }

  return result.data.hooks;
}

// -- Planner --

/** Where each target stores its hook configuration. */
const SETTINGS_PATH_BY_TARGET: Record<AssistantTargetId, string> = {
  "claude-code": "settings.json",
  "codex-cli": "hooks.json",
};

/**
 * Build the per-target wiring plan from manifest entries.
 *
 * `assistantHomeByTarget` maps each target to its already-resolved Assistant
 * Home (e.g. `~/.claude` or `~/.codex`) so this function stays pure: it
 * doesn't touch the filesystem and doesn't re-resolve home paths.
 */
export function planHookWiring(
  entries: readonly WiringEntry[],
  assistantHomeByTarget: Readonly<Partial<Record<AssistantTargetId, string>>>,
  options: PlanHookWiringOptions = {},
): readonly WiringPlan[] {
  const plansBySettingsPath = new Map<
    string,
    {
      target: AssistantTargetId;
      settingsPath: string;
      actions: WiringAction[];
      featureFlag?: FeatureFlagAssertion;
    }
  >();

  for (const entry of entries) {
    if (!variantGateSatisfied(entry.variants, options.variants)) continue;
    for (const target of entry.targets) {
      const home = assistantHomeByTarget[target];
      if (!home) continue; // target not selected this run

      const scope = entry.scope ?? "assistant-home";
      const settingsRoot =
        scope === "project"
          ? getProjectSettingsRoot(target, options.projectRoot)
          : home;
      const settingsPath = path.join(
        settingsRoot,
        SETTINGS_PATH_BY_TARGET[target],
      );
      const projectRoot =
        scope === "project" || entry.command?.includes("{project}") === true
          ? getProjectRoot(options.projectRoot)
          : "";
      const hookAbsPath = toHookCommandPath(
        scope === "project"
          ? path.join(projectRoot, "canonical", "hooks", entry.file)
          : path.join(home, "hooks", entry.file),
      );
      const commandTemplate = entry.command ?? "node {hook}";
      const renderedCommand = commandTemplate
        .replace(/\{hook\}/g, hookAbsPath)
        .replace(/\{project\}/g, toHookCommandPath(projectRoot));

      const action: WiringAction = {
        target,
        settingsPath,
        event: entry.event,
        matcher: entry.matcher,
        timeoutSec: entry.timeoutSec,
        command: renderedCommand,
      };

      const featureFlag: FeatureFlagAssertion | undefined =
        target === "codex-cli"
          ? {
              tomlPath: path.join(settingsRoot, "config.toml"),
              section: "features",
              key: "hooks",
              value: true,
              deprecatedKeys: ["codex_hooks"],
            }
          : undefined;
      const planKey = `${target}\0${settingsPath}`;
      const existing = plansBySettingsPath.get(planKey);
      if (existing) {
        existing.actions.push(action);
      } else {
        plansBySettingsPath.set(planKey, {
          target,
          settingsPath,
          actions: [action],
          featureFlag,
        });
      }
    }
  }

  return Array.from(plansBySettingsPath.values());
}

// -- Applier --

/** A single matcher-group entry inside `hooks[event]` arrays. */
interface MatcherGroup {
  matcher?: string;
  hooks: HookCommand[];
}

/** A single hook command inside a matcher group's `hooks` array. */
interface HookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

/** Shape of the persisted settings.json / hooks.json file. */
interface SettingsFile {
  hooks?: Record<string, MatcherGroup[]>;
  // Other fields are preserved verbatim
  [key: string]: unknown;
}

/**
 * Apply a single target's wiring plan: idempotently merge actions into the
 * settings file, then assert the feature flag when present.
 *
 * Reads the existing settings file (treats it as `{}` if absent), navigates
 * to `hooks[event]`, and appends a new matcher group only when no existing
 * hook command in any matcher group has the same rendered command string.
 *
 * The `dryRun` flag short-circuits all filesystem writes but still computes
 * the would-add and would-skip counts so a dry-run reporter can show them.
 */
export async function applyHookWiring(
  plan: WiringPlan,
  options: { readonly dryRun?: boolean } = {},
): Promise<ApplyWiringResult> {
  const dryRun = options.dryRun === true;

  const settings = await readSettings(plan.settingsPath);
  const hooks = settings.hooks ?? {};

  let added = 0;
  let alreadyPresent = 0;
  let deduped = false;

  for (const action of plan.actions) {
    const eventGroups = hooks[action.event] ?? [];
    const dedupeResult = dedupeEquivalentCommands(eventGroups);
    const activeEventGroups = dedupeResult.groups;
    if (dedupeResult.removed > 0) {
      hooks[action.event] = activeEventGroups;
      deduped = true;
    }

    if (commandAlreadyPresent(activeEventGroups, action.command)) {
      alreadyPresent += 1;
      continue;
    }

    const newGroup = buildMatcherGroup(action);
    hooks[action.event] = [...activeEventGroups, newGroup];
    added += 1;
  }

  let flagAdded = false;
  if (plan.featureFlag) {
    flagAdded = await assertTomlFeatureFlag(plan.featureFlag, { dryRun });
  }

  if ((added > 0 || deduped) && !dryRun) {
    const next: SettingsFile = { ...settings, hooks };
    await writeSettings(plan.settingsPath, next);
  }

  return {
    target: plan.target,
    settingsPath: plan.settingsPath,
    added,
    alreadyPresent,
    flagAdded,
  };
}

// -- Internals --

/** Read settings.json/hooks.json. Returns `{}` if the file doesn't exist. */
async function readSettings(settingsPath: string): Promise<SettingsFile> {
  let raw: string;
  try {
    raw = await fs.readFile(settingsPath, "utf-8");
  } catch (error: unknown) {
    if (isErrnoNotFound(error)) {
      return {};
    }
    throw error;
  }
  if (raw.trim() === "") return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    throw new Error(
      `Failed to parse ${settingsPath}: ${getMessage(error)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(
      `Expected ${settingsPath} to contain a JSON object, got ${typeof parsed}`,
    );
  }
  return parsed as SettingsFile;
}

/** Write settings.json/hooks.json with stable formatting. */
async function writeSettings(
  settingsPath: string,
  contents: SettingsFile,
): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  const json = JSON.stringify(contents, null, 2) + "\n";
  await fs.writeFile(settingsPath, json, "utf-8");
}

/** True if any matcher group in the array contains an equivalent command. */
function commandAlreadyPresent(
  groups: readonly MatcherGroup[],
  command: string,
): boolean {
  const normalizedNew = normalizeHookCommand(command);
  return groups.some((group) =>
    group.hooks.some(
      (hook) => normalizeHookCommand(hook.command) === normalizedNew,
    ),
  );
}

/**
 * Drop duplicate hook commands within the same event and matcher.
 * This cleans up older `~` + absolute-path duplicates without collapsing
 * intentionally different matcher groups for the same command.
 */
function dedupeEquivalentCommands(groups: readonly MatcherGroup[]): {
  readonly groups: MatcherGroup[];
  readonly removed: number;
} {
  const seen = new Set<string>();
  let removed = 0;
  const dedupedGroups: MatcherGroup[] = [];

  for (const group of groups) {
    const nextHooks: HookCommand[] = [];
    const matcher = group.matcher ?? "";

    for (const hook of group.hooks) {
      const key = `${matcher}\0${normalizeHookCommand(hook.command)}`;
      if (seen.has(key)) {
        removed += 1;
        continue;
      }
      seen.add(key);
      nextHooks.push(hook);
    }

    if (nextHooks.length > 0) {
      dedupedGroups.push({ ...group, hooks: nextHooks });
    }
  }

  return { groups: dedupedGroups, removed };
}

/**
 * Normalize a hook command for idempotency comparison.
 * Forward-slashes the command and collapses `$HOME` to `~` so that
 * `node ~/.claude/hooks/foo.js`, `node /Users/alice/.claude/hooks/foo.js`, and
 * the backslash form a Windows home produces are all treated as the same hook.
 * Forward-slashing first is what lets the home match: rendered paths use
 * forward slashes (see toHookCommandPath) while HOME on Windows uses
 * backslashes, so the home must be slashed too or the replace never matches.
 */
function normalizeHookCommand(command: string): string {
  const slashed = command.replace(/\\/g, "/");
  const home = (process.env.HOME ?? process.env.USERPROFILE ?? "").replace(
    /\\/g,
    "/",
  );
  if (!home) return slashed;
  return slashed.replace(home, "~");
}

/** Convert a planned WiringAction into the matcher-group shape settings.json expects. */
function buildMatcherGroup(action: WiringAction): MatcherGroup {
  const hookCommand: HookCommand = {
    type: "command",
    command: action.command,
  };
  if (action.timeoutSec !== undefined) {
    hookCommand.timeout = action.timeoutSec;
  }

  const group: MatcherGroup = { hooks: [hookCommand] };
  if (action.matcher !== undefined) {
    group.matcher = action.matcher;
  }
  return group;
}

/**
 * Idempotently assert `[features] <key> = <value>` in a TOML file.
 *
 * Strategy:
 *   1. Remove deprecated aliases for this flag, if any.
 *   2. If a `<key> = ...` line already exists anywhere in the file → normalize it.
 *   3. If a `[features]` section already exists → insert the line right
 *      after that section header (before any subsequent `[other.section]`).
 *   4. Otherwise → append a new `[features]` block at the end.
 *
 * This avoids the "two `[features]` blocks" hazard that plain append would
 * cause when an unrelated `[features]` section already exists.
 */
async function assertTomlFeatureFlag(
  flag: FeatureFlagAssertion,
  options: { readonly dryRun: boolean },
): Promise<boolean> {
  let original: string;
  try {
    original = await fs.readFile(flag.tomlPath, "utf-8");
  } catch (error: unknown) {
    if (isErrnoNotFound(error)) {
      original = "";
    } else {
      throw error;
    }
  }

  let updated = original;
  for (const deprecatedKey of flag.deprecatedKeys ?? []) {
    const deprecatedLine = new RegExp(
      `^\\s*${escapeRegExp(deprecatedKey)}\\s*=.*(?:\\r?\\n)?`,
      "gm",
    );
    updated = updated.replace(deprecatedLine, "");
  }

  const newLine = `${flag.key} = ${JSON.stringify(flag.value)}`;
  const keyLine = new RegExp(
    `^(\\s*)${escapeRegExp(flag.key)}\\s*=.*$`,
    "m",
  );
  const keyMatch = keyLine.exec(updated);
  if (keyMatch) {
    updated = updated.replace(keyLine, `${keyMatch[1]}${newLine}`);
    if (updated === original) {
      return false;
    }
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(flag.tomlPath), { recursive: true });
      await fs.writeFile(flag.tomlPath, updated, "utf-8");
    }
    return true;
  }

  const sectionHeader = new RegExp(
    `^\\[${escapeRegExp(flag.section)}\\]\\s*$`,
    "m",
  );
  const sectionMatch = sectionHeader.exec(updated);
  if (sectionMatch) {
    // Insert the new line right after the section header line.
    const insertAt = sectionMatch.index + sectionMatch[0].length;
    updated =
      updated.slice(0, insertAt) +
      "\n" +
      newLine +
      updated.slice(insertAt);
  } else {
    // Append a fresh block. Ensure exactly one blank line before the new block.
    const trimmedTrailing = updated.replace(/\s*$/, "");
    const prefix = trimmedTrailing.length === 0 ? "" : "\n\n";
    updated = `${trimmedTrailing}${prefix}[${flag.section}]\n${newLine}\n`;
  }

  if (!options.dryRun) {
    await fs.mkdir(path.dirname(flag.tomlPath), { recursive: true });
    await fs.writeFile(flag.tomlPath, updated, "utf-8");
  }
  return true;
}

// -- Small helpers --

/** True when the entry has no Variant gate, or every required pair matches the run's variants. */
function variantGateSatisfied(
  required: Readonly<Record<string, string>> | undefined,
  actual: Readonly<Record<string, string>> | undefined,
): boolean {
  if (!required) return true;
  return Object.entries(required).every(([key, value]) => actual?.[key] === value);
}

function isErrnoNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function getMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Render a filesystem path as a shell-safe hook command argument.
 *
 * On Windows `path.join` yields backslashes, which the assistant's shell
 * mangles when it runs `node C:\Users\...\hook.js` (the loader reads
 * `C:Users...`). Forward slashes resolve correctly on Windows, Mac, and Linux
 * alike, so every rendered hook path uses them.
 */
function toHookCommandPath(p: string): string {
  return p.replace(/\\/g, "/");
}

function getProjectSettingsRoot(
  target: AssistantTargetId,
  projectRoot: string | undefined,
): string {
  const root = getProjectRoot(projectRoot);
  return path.join(root, target === "claude-code" ? ".claude" : ".codex");
}

function getProjectRoot(projectRoot: string | undefined): string {
  if (!projectRoot) {
    throw new Error("Project-scoped hook wiring requires a project root.");
  }
  return projectRoot;
}
