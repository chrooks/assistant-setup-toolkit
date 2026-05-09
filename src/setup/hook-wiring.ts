/**
 * Hook Wiring Manifest loader, planner, and applier.
 *
 * Reads `canonical/hooks/wiring.yaml`, validates it with Zod, and produces
 * idempotent wiring plans that merge hook entries into Claude Code's
 * `~/.claude/settings.json` and Codex CLI's `~/.codex/hooks.json`. For
 * Codex targets the applier also asserts the feature flag
 * `[features] codex_hooks = true` in `~/.codex/config.toml`.
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

/** A single wiring entry — one hook script bound to one event on one or more targets. */
const WiringEntrySchema = z.object({
  file: z.string().min(1, "file must not be empty"),
  event: z.string().min(1, "event must not be empty"),
  targets: z.array(TargetSchema).min(1, "targets must not be empty"),
  matcher: z.string().optional(),
  timeoutSec: z.number().int().positive().optional(),
  /** Optional command template. `{hook}` is replaced with the absolute hook path. Defaults to `bash {hook}`. */
  command: z.string().optional(),
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
): readonly WiringPlan[] {
  const plansByTarget = new Map<AssistantTargetId, WiringAction[]>();

  for (const entry of entries) {
    for (const target of entry.targets) {
      const home = assistantHomeByTarget[target];
      if (!home) continue; // target not selected this run

      const settingsPath = path.join(home, SETTINGS_PATH_BY_TARGET[target]);
      const hookAbsPath = path.join(home, "hooks", entry.file);
      const commandTemplate = entry.command ?? "bash {hook}";
      const renderedCommand = commandTemplate.replace(/\{hook\}/g, hookAbsPath);

      const action: WiringAction = {
        target,
        settingsPath,
        event: entry.event,
        matcher: entry.matcher,
        timeoutSec: entry.timeoutSec,
        command: renderedCommand,
      };

      const existing = plansByTarget.get(target);
      if (existing) {
        existing.push(action);
      } else {
        plansByTarget.set(target, [action]);
      }
    }
  }

  const plans: WiringPlan[] = [];
  for (const [target, actions] of plansByTarget) {
    const home = assistantHomeByTarget[target];
    if (!home) continue;

    const settingsPath = path.join(home, SETTINGS_PATH_BY_TARGET[target]);
    const featureFlag: FeatureFlagAssertion | undefined =
      target === "codex-cli"
        ? {
            tomlPath: path.join(home, "config.toml"),
            section: "features",
            key: "codex_hooks",
            value: true,
          }
        : undefined;

    plans.push({ target, settingsPath, actions, featureFlag });
  }

  return plans;
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

  for (const action of plan.actions) {
    const eventGroups = hooks[action.event] ?? [];
    if (commandAlreadyPresent(eventGroups, action.command)) {
      alreadyPresent += 1;
      continue;
    }

    const newGroup = buildMatcherGroup(action);
    hooks[action.event] = [...eventGroups, newGroup];
    added += 1;
  }

  let flagAdded = false;
  if (plan.featureFlag) {
    flagAdded = await assertTomlFeatureFlag(plan.featureFlag, { dryRun });
  }

  if (added > 0 && !dryRun) {
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

/** True if any matcher group in the array contains the exact rendered command. */
function commandAlreadyPresent(
  groups: readonly MatcherGroup[],
  command: string,
): boolean {
  return groups.some((group) =>
    group.hooks.some((hook) => hook.command === command),
  );
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
 *   1. If a `<key> = ...` line already exists anywhere in the file → no-op.
 *   2. If a `[features]` section already exists → insert the line right
 *      after that section header (before any subsequent `[other.section]`).
 *   3. Otherwise → append a new `[features]` block at the end.
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

  const keyLine = new RegExp(`^\\s*${escapeRegExp(flag.key)}\\s*=`, "m");
  if (keyLine.test(original)) {
    return false; // already present — no-op
  }

  const newLine = `${flag.key} = ${JSON.stringify(flag.value)}`;
  let updated: string;

  const sectionHeader = new RegExp(
    `^\\[${escapeRegExp(flag.section)}\\]\\s*$`,
    "m",
  );
  const sectionMatch = sectionHeader.exec(original);
  if (sectionMatch) {
    // Insert the new line right after the section header line.
    const insertAt = sectionMatch.index + sectionMatch[0].length;
    updated =
      original.slice(0, insertAt) +
      "\n" +
      newLine +
      original.slice(insertAt);
  } else {
    // Append a fresh block. Ensure exactly one blank line before the new block.
    const trimmedTrailing = original.replace(/\s*$/, "");
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
