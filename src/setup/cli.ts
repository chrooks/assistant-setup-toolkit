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
import { ALL_COMPONENT_KINDS } from "./domain.js";

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

  const hasDefault = flags.has("--default");
  const hasCustom = flags.has("--custom");
  const dryRun = flags.has("--dry-run");
  const overwrite = flags.has("--overwrite");
  const prune = flags.has("--prune");
  const symlink = flags.has("--symlink");
  const noFetch = flags.has("--no-fetch");
  const yes = flags.has("--yes");

  // If we have targets + mode, we can build a complete profile
  if (targets.length > 0 && (hasDefault || hasCustom)) {
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
      },
    };
  }

  // Not enough flags — need interactive prompts
  return {
    kind: "interactive",
    partial: { targets, dryRun, overwrite, prune, symlink, noFetch, yes },
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
