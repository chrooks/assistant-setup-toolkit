/**
 * CLI flag parsing for the Setup Wizard.
 *
 * Converts raw argv flags into a SetupProfile. In non-interactive mode,
 * requires at least one Assistant Target and either --default or --custom.
 * Interactive prompts are handled separately and are not part of this module.
 */

import type {
  AssistantTargetId,
  SetupMode,
  WriteBehavior,
  SetupProfile,
} from "./domain.js";
import { ALL_COMPONENT_KINDS } from "./domain.js";

/**
 * Parse CLI flags into a SetupProfile.
 *
 * Supported flags:
 *   --claude, --codex        — select Assistant Targets
 *   --default, --custom      — select Setup Mode
 *   --dry-run                — preview without writing
 *   --overwrite, --prune     — select write behavior (default: safe-merge)
 *   --symlink                — use symlinks where supported
 *   --no-fetch               — skip External Source fetching
 *   --yes                    — skip confirmation prompts
 */
export function parseCliFlags(argv: readonly string[]): SetupProfile {
  const flags = new Set(argv);

  // Parse Assistant Targets
  const targets: AssistantTargetId[] = [];
  if (flags.has("--claude")) targets.push("claude-code");
  if (flags.has("--codex")) targets.push("codex-cli");

  if (targets.length === 0) {
    throw new Error(
      "Specify at least one Assistant Target: --claude, --codex",
    );
  }

  // Parse Setup Mode
  const hasDefault = flags.has("--default");
  const hasCustom = flags.has("--custom");

  if (!hasDefault && !hasCustom) {
    throw new Error(
      "Specify --default or --custom to select a Setup Mode in non-interactive mode.",
    );
  }

  const mode: SetupMode = hasCustom ? "custom" : "default";

  // Parse write behavior — only one allowed, default is safe-merge
  let writeBehavior: WriteBehavior = "safe-merge";
  if (flags.has("--overwrite")) writeBehavior = "overwrite";
  if (flags.has("--prune")) writeBehavior = "prune";

  // Parse remaining flags
  const dryRun = flags.has("--dry-run");
  const fetch = !flags.has("--no-fetch");
  const symlink = flags.has("--symlink");
  const yes = flags.has("--yes");

  // Default Install includes all components; Custom Install would
  // need interactive selection (not yet implemented in flag mode)
  const components = mode === "default" ? [...ALL_COMPONENT_KINDS] : [...ALL_COMPONENT_KINDS];

  return {
    mode,
    targets,
    components,
    writeBehavior,
    dryRun,
    fetch,
    symlink,
    yes,
  };
}
