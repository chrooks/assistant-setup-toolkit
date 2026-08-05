/**
 * Domain types for the Assistant Setup Toolkit Setup Wizard.
 *
 * These types model Assistant Targets, Assistant Homes, Setup Profiles,
 * Toolkit Components, write behaviors, Install Receipts, and payload files.
 * This module is pure — no filesystem or IO dependencies.
 */

// -- Literal unions matching the project Lexicon --

/** A supported assistant runtime the toolkit can configure. */
export type AssistantTargetId = "claude-code" | "codex-cli";

/** A user-level install destination owned by or discovered by an assistant. */
export type AssistantHomeId = "claude-home" | "codex-home" | "agents-home";

/** Whether the user chose Default Install or Custom Install. */
export type SetupMode = "default" | "custom";

/** How the Setup Wizard writes files into an Assistant Home. */
export type WriteBehavior = "safe-merge" | "overwrite" | "prune";

/** A user-selectable part of the toolkit that can be included in an Assistant Payload. */
export type ComponentKind =
  | "instructions"
  | "plans"
  | "hooks"
  | "commands"
  | "skills"
  | "rules"
  | "config"
  | "settings"
  | "manifests"
  | "mcp";

/** A per-machine flavor choice for the visual-plan/visual-recap backend. */
export type VisualPlansVariant = "local-files" | "self-hosted" | "none";

/** The Variant key for the visual-plans flavor in SetupProfile.variants. */
export const VISUAL_PLANS_VARIANT_KEY = "visual-plans";

/** All valid visual-plans Variant values, for flag/prompt validation. */
export const VISUAL_PLANS_VARIANTS: readonly VisualPlansVariant[] = [
  "local-files",
  "self-hosted",
  "none",
] as const;

/** Non-interactive default: every non-work machine is a personal machine. */
export const DEFAULT_VISUAL_PLANS_VARIANT: VisualPlansVariant = "self-hosted";

/**
 * Origin of the self-hosted Plan app. Machine-local by nature — a home-server
 * hostname is not shared configuration, so it comes from the environment and
 * never from this repository. Unset is the normal case on a fresh clone; the
 * next-step then tells the operator to set it.
 */
export const SELF_HOSTED_PLAN_ORIGIN_ENV = "TOOLKIT_PLAN_ORIGIN";

/** The configured Plan origin, or undefined when the operator has not set one. */
export function selfHostedPlanOrigin(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const raw = env[SELF_HOSTED_PLAN_ORIGIN_ENV]?.trim();
  return raw ? raw.replace(/\/+$/, "") : undefined;
}

/**
 * The Variant key naming which machine class this install is (ADR-0003).
 * Gates machine-scoped content: canonical/machines/<name>/ (rules.md,
 * skills/) ships only where variants.machine === name.
 */
export const MACHINE_VARIANT_KEY = "machine";

/** Fixed install path for the (single) matching machine rule. */
export const MACHINE_RULE_INSTALL_PATH = "rules/machine.md";

/**
 * A named, repo-declared partial Setup Profile (ADR-0002).
 * Exactly the five identity fields, all optional; run ephemera are excluded.
 */
export interface Preset {
  readonly targets?: readonly AssistantTargetId[];
  readonly components?: readonly ComponentKind[];
  readonly selectedExternalSourceIds?: readonly string[];
  readonly variants?: Readonly<Record<string, string>>;
  readonly writeBehavior?: WriteBehavior;
}

/** The skill directories the visual-plans Variant governs. */
export const VISUAL_PLANS_SKILL_NAMES = ["visual-plan", "visual-recap"] as const;

/**
 * Resolve the visual-plans Variant from a profile's variants map,
 * falling back to the non-interactive default for unset/unknown values.
 */
export function resolveVisualPlansVariant(profile: {
  readonly variants?: Readonly<Record<string, string>>;
}): VisualPlansVariant {
  const raw = profile.variants?.[VISUAL_PLANS_VARIANT_KEY];
  return VISUAL_PLANS_VARIANTS.includes(raw as VisualPlansVariant)
    ? (raw as VisualPlansVariant)
    : DEFAULT_VISUAL_PLANS_VARIANT;
}

/** The kind of thing an External Source provides. */
export type ExternalSourceKind =
  | "skill"
  | "skill-pack"
  | "plugin"
  | "skill-or-plugin"
  | "mcp-server";

// -- All valid component kinds, used by Default Install --

export const ALL_COMPONENT_KINDS: readonly ComponentKind[] = [
  "instructions",
  "plans",
  "hooks",
  "commands",
  "skills",
  "rules",
  "config",
  "settings",
  "manifests",
  "mcp",
] as const;

// -- Interfaces --

/** A named selection of targets, components, and behaviors for a Setup Wizard run. */
export interface SetupProfile {
  readonly mode: SetupMode;
  readonly targets: readonly AssistantTargetId[];
  readonly components: readonly ComponentKind[];
  readonly writeBehavior: WriteBehavior;
  readonly dryRun: boolean;
  readonly fetch: boolean;
  readonly symlink: boolean;
  readonly yes: boolean;
  readonly quiet: boolean;
  /**
   * Build Skill Artifact ZIPs for manual desktop/web upload (`--artifacts`).
   * Off by default: an ordinary install never uploads them, and building ~50
   * ZIPs is the slowest, noisiest step in the run.
   */
  readonly artifacts: boolean;
  /**
   * IDs of External Sources the user picked for this run.
   * `undefined` = use manifest defaults (preserves non-interactive behavior).
   * `[]` = explicitly install no External Sources.
   */
  readonly selectedExternalSourceIds?: readonly string[];
  /**
   * Per-machine Variant choices, keyed by Variant name (e.g. "visual-plans").
   * Plain data so a future per-device preset system can absorb it unchanged.
   * `undefined` = no Variant chosen (interactive flows should ask).
   */
  readonly variants?: Readonly<Record<string, string>>;
  /** Name of the Preset chosen for this run (`--preset`, receipt, or prompt). */
  readonly presetName?: string;
  /**
   * True when targets came from actual --claude/--codex flags (explicit,
   * beats a Preset) rather than a sync/interactive default.
   */
  readonly targetsExplicit?: boolean;
}

/** Where a payload file came from — used for precedence and conflict reporting. */
export type PayloadFileOrigin =
  | "external-source"
  | "canonical-source"
  | "target-projection";

/** A single file prepared for installation into an Assistant Home. */
export interface PayloadFile {
  readonly relativePath: string;
  readonly sourcePath: string;
  readonly component: ComponentKind;
  readonly origin: PayloadFileOrigin;
  readonly executable: boolean;
}

/** The selected set of toolkit files prepared for one Assistant Home. */
export interface AssistantPayload {
  readonly target: AssistantTargetId;
  readonly homeId: AssistantHomeId;
  readonly files: readonly PayloadFile[];
}

/** A timestamped record of toolkit-owned files written during a Setup Wizard run. */
export interface InstallReceipt {
  /** 1: `files` only. 2: adds `ownedFiles`, the cumulative prune memory. */
  readonly schemaVersion: 1 | 2;
  readonly toolkit: "code-assistant-context";
  readonly installedAt: string;
  readonly assistantTarget: AssistantTargetId;
  readonly assistantHome: string;
  readonly setupProfile: Pick<
    SetupProfile,
    "mode" | "components" | "writeBehavior" | "variants"
  > & {
    /** The Preset name this machine chose — rehydrated on later runs. */
    readonly preset?: string;
  };
  /** Files this run actually wrote (copy + overwrite). Run-scoped, not ownership. */
  readonly files: readonly string[];
  /**
   * Every path the toolkit has ever placed in this home — the union of each
   * run's payload, including files a Safe Merge skipped.
   *
   * This is prune's memory. `files` cannot serve the purpose: it is rewritten
   * each run, so a file dropped from the payload vanishes from the receipt on
   * the very next run and becomes unprunable forever. Absent on schemaVersion
   * 1 receipts — read it through resolveOwnedFiles.
   */
  readonly ownedFiles?: readonly string[];
}

/**
 * Read an Install Receipt's ownership set, tolerating schemaVersion 1 receipts
 * that predate `ownedFiles`. A v1 receipt only knows its own run, which is the
 * limitation v2 exists to fix — falling back to `files` keeps prune working at
 * the old fidelity until the next run upgrades the receipt.
 */
export function resolveOwnedFiles(
  receipt: Pick<InstallReceipt, "files" | "ownedFiles">,
): readonly string[] {
  return receipt.ownedFiles ?? receipt.files;
}

// -- Mapping: which Assistant Homes belong to which Assistant Target --

const TARGET_HOME_MAP: Record<AssistantTargetId, readonly AssistantHomeId[]> = {
  "claude-code": ["claude-home"],
  "codex-cli": ["codex-home", "agents-home"],
};

// -- Helpers --

/**
 * Create a Default Install profile for the given Assistant Targets.
 * Includes all Toolkit Components, Safe Merge, and fetch enabled.
 */
export function createDefaultSetupProfile(
  targets: readonly AssistantTargetId[],
): SetupProfile {
  return {
    mode: "default",
    targets,
    components: ALL_COMPONENT_KINDS,
    writeBehavior: "safe-merge",
    dryRun: false,
    fetch: true,
    symlink: false,
    yes: false,
    quiet: false,
    artifacts: false,
  };
}

/**
 * Resolve which Assistant Homes are needed for the given Assistant Targets.
 * Returns a deduplicated list preserving insertion order.
 */
export function resolveAssistantHomes(
  targets: readonly AssistantTargetId[],
): readonly AssistantHomeId[] {
  // Build deduplicated list while preserving order
  const seen = new Set<AssistantHomeId>();
  const result: AssistantHomeId[] = [];
  for (const target of targets) {
    for (const home of TARGET_HOME_MAP[target]) {
      if (!seen.has(home)) {
        seen.add(home);
        result.push(home);
      }
    }
  }
  return result;
}
