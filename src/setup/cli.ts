/**
 * CLI flag parsing for the Setup Wizard.
 *
 * Converts raw argv flags into a SetupProfile. When insufficient flags
 * are provided, returns null to signal that interactive prompts are needed.
 */

import type {
  AssistantTargetId,
  SetupMode,
  WriteBehavior,
  SetupProfile,
} from "./domain.js";
import {
  ALL_COMPONENT_KINDS,
  VISUAL_PLANS_VARIANT_KEY,
  VISUAL_PLANS_VARIANTS,
} from "./domain.js";
import type { VisualPlansVariant } from "./domain.js";

/** Result of attempting to parse CLI flags. */
export type ParseResult =
  | { kind: "profile"; profile: SetupProfile }
  | { kind: "interactive"; partial: PartialFlags };

/** Flags that were provided but insufficient for a full profile. */
export interface PartialFlags {
  readonly targets: readonly AssistantTargetId[];
  readonly dryRun: boolean;
  readonly overwrite: boolean;
  readonly prune: boolean;
  readonly symlink: boolean;
  readonly noFetch: boolean;
  readonly yes: boolean;
  readonly quiet: boolean;
  /**
   * Optional explicit External Source IDs from `--sources <a,b,c>`.
   * `undefined` means user didn't pass the flag (use manifest defaults).
   * `[]` means `--no-sources` was passed (skip all External Sources).
   */
  readonly selectedExternalSourceIds?: readonly string[];
  /** Optional `--visual-plans <value>` Variant, validated against the union. */
  readonly visualPlansVariant?: VisualPlansVariant;
}

/**
 * Try to parse CLI flags into a complete SetupProfile.
 * Returns "interactive" when required flags (target + mode) are missing.
 */
export function tryParseCliFlags(argv: readonly string[]): ParseResult {
  const flags = new Set(argv);

  // Parse what's available
  const targets: AssistantTargetId[] = [];
  if (flags.has("--claude")) targets.push("claude-code");
  if (flags.has("--codex")) targets.push("codex-cli");

  // `--sync` = quick "git pull"-style re-projection: both targets, all
  // components, default mode, overwrite, skip fetch + confirmation. Other
  // explicit flags still win (e.g. `--sync --claude` syncs only Claude).
  const sync = flags.has("--sync");
  if (sync) {
    if (targets.length === 0) {
      targets.push("claude-code", "codex-cli");
    }
  }

  const hasDefault = flags.has("--default") || sync;
  const hasCustom = flags.has("--custom");
  const dryRun = flags.has("--dry-run");
  const overwrite = flags.has("--overwrite") || sync;
  const prune = flags.has("--prune");
  const symlink = flags.has("--symlink");
  const noFetch = flags.has("--no-fetch") || sync;
  const yes = flags.has("--yes") || sync;
  const quiet = flags.has("--quiet");

  // Parse `--sources <ids>` (comma-separated) and `--no-sources` shortcut.
  // Both feed `selectedExternalSourceIds` so the caller can override the
  // manifest's default-only gate.
  let selectedExternalSourceIds: readonly string[] | undefined;
  if (flags.has("--no-sources")) {
    selectedExternalSourceIds = [];
  } else {
    const argvList = [...argv];
    const idx = argvList.indexOf("--sources");
    if (idx !== -1 && idx + 1 < argvList.length) {
      const raw = argvList[idx + 1];
      selectedExternalSourceIds = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }

  // Parse `--visual-plans <value>`. A bad or missing value warns; it forces
  // interactive only when the run isn't already pinned non-interactive
  // (--yes/--sync must never hang a CI/non-TTY run on a typo). An unset
  // Variant is rehydrated later from the Install Receipt.
  let visualPlansVariant: VisualPlansVariant | undefined;
  let visualPlansInvalid = false;
  {
    const argvList = [...argv];
    const idx = argvList.indexOf("--visual-plans");
    if (idx !== -1) {
      const raw = idx + 1 < argvList.length ? argvList[idx + 1].trim() : "";
      if ((VISUAL_PLANS_VARIANTS as readonly string[]).includes(raw)) {
        visualPlansVariant = raw as VisualPlansVariant;
      } else {
        visualPlansInvalid = true;
        const shown = raw === "" || raw.startsWith("--") ? "(missing)" : raw;
        console.warn(
          `Invalid --visual-plans value ${shown} — expected one of: ${VISUAL_PLANS_VARIANTS.join(", ")}.`,
        );
      }
    }
  }
  const forceInteractiveForVariant = visualPlansInvalid && !yes;

  // If we have targets + mode, we can build a complete profile
  if (
    targets.length > 0 &&
    (hasDefault || hasCustom) &&
    !forceInteractiveForVariant
  ) {
    const mode: SetupMode = hasCustom ? "custom" : "default";
    let writeBehavior: WriteBehavior = "safe-merge";
    if (overwrite) writeBehavior = "overwrite";
    if (prune) writeBehavior = "prune";

    return {
      kind: "profile",
      profile: {
        mode,
        targets,
        components: [...ALL_COMPONENT_KINDS],
        writeBehavior,
        dryRun,
        fetch: !noFetch,
        symlink,
        yes,
        quiet,
        selectedExternalSourceIds,
        // Unset (no flag / bad value under --yes) stays undefined so the
        // Install Receipt's recorded Variant can rehydrate it downstream.
        variants: visualPlansVariant
          ? { [VISUAL_PLANS_VARIANT_KEY]: visualPlansVariant }
          : undefined,
      },
    };
  }

  // Not enough flags — need interactive prompts
  return {
    kind: "interactive",
    partial: {
      targets,
      dryRun,
      overwrite,
      prune,
      symlink,
      noFetch,
      yes,
      quiet,
      selectedExternalSourceIds,
      visualPlansVariant,
    },
  };
}

/**
 * Parse CLI flags into a SetupProfile, throwing if insufficient.
 * Used by tests and non-interactive callers.
 */
export function parseCliFlags(argv: readonly string[]): SetupProfile {
  const result = tryParseCliFlags(argv);
  if (result.kind === "profile") return result.profile;

  if (result.partial.targets.length === 0) {
    throw new Error(
      "Specify at least one Assistant Target: --claude, --codex",
    );
  }
  throw new Error(
    "Specify --default or --custom to select a Setup Mode in non-interactive mode.",
  );
}
