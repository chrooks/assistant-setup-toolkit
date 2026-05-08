/**
 * Domain types for the Assistant Setup Toolkit Setup Wizard.
 *
 * These types model Assistant Targets, Assistant Homes, Setup Profiles,
 * Toolkit Components, write behaviors, Install Receipts, and payload files.
 * This module is pure — no filesystem or IO dependencies.
 */

// -- Literal unions matching the domain glossary --

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
  | "settings"
  | "manifests"
  | "mcp";

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
  /**
   * IDs of External Sources the user picked for this run.
   * `undefined` = use manifest defaults (preserves non-interactive behavior).
   * `[]` = explicitly install no External Sources.
   */
  readonly selectedExternalSourceIds?: readonly string[];
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
  readonly setupProfile: Pick<SetupProfile, "mode" | "components" | "writeBehavior">;
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
