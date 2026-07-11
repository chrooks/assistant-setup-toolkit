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

/** Origin of the self-hosted Plan app (hearth deploy on hestia). */
export const SELF_HOSTED_PLAN_URL = "https://plan.hestia.chrooks.com";

/**
 * The Variant key naming which machine class this install is (ADR-0003).
 * Gates machine-scoped rules: canonical/rules/machines/<name>.md ships only
 * where variants.machine === name.
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
  readonly schemaVersion: 1;
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
  readonly files: readonly string[];
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
