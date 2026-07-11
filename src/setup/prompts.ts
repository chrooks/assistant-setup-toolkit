/**
 * Interactive prompts for the Setup Wizard.
 *
 * Uses @inquirer/prompts for cross-platform interactive CLI selection.
 * Each prompt function is isolated so non-interactive tests can bypass them.
 * Partial flags from CLI args pre-fill selections where provided.
 */

import { checkbox, select, confirm } from "@inquirer/prompts";
import type {
  AssistantTargetId,
  SetupMode,
  WriteBehavior,
  ComponentKind,
  SetupProfile,
  VisualPlansVariant,
} from "./domain.js";
import {
  ALL_COMPONENT_KINDS,
  DEFAULT_VISUAL_PLANS_VARIANT,
  VISUAL_PLANS_VARIANT_KEY,
} from "./domain.js";
import type { PartialFlags } from "./cli.js";
import type { ExternalSource } from "./manifest.js";

/**
 * Run the full interactive prompt flow, returning a complete SetupProfile.
 * Pre-fills answers from any partial flags the user provided on the CLI.
 */
export async function runInteractivePrompts(
  partial: PartialFlags,
  externalSources: readonly ExternalSource[] = [],
): Promise<SetupProfile> {
  console.log("\nAssistant Setup Toolkit Setup Wizard\n");

  // Step 0: Operation — Quick Sync re-projects Canonical Assistant Source over
  // all targets with Overwrite (no fetch, no confirmation). Acts like `git pull`
  // for the projection. Full Setup falls through to normal prompts.
  const operation = await promptOperation();
  if (operation === "sync") {
    const syncTargets: AssistantTargetId[] =
      partial.targets.length > 0
        ? [...partial.targets]
        : ["claude-code", "codex-cli"];
    return {
      mode: "default",
      targets: syncTargets,
      components: [...ALL_COMPONENT_KINDS],
      writeBehavior: "overwrite",
      dryRun: partial.dryRun,
      fetch: false,
      symlink: partial.symlink,
      yes: true,
      quiet: partial.quiet,
      selectedExternalSourceIds: [],
      // Unset stays undefined — Quick Sync preserves the machine's recorded
      // Variant via Install Receipt rehydration rather than resetting it.
      variants: partial.visualPlansVariant
        ? { [VISUAL_PLANS_VARIANT_KEY]: partial.visualPlansVariant }
        : undefined,
    };
  }

  // Step 1: Select Assistant Targets (skip if already provided via flags)
  let targets: AssistantTargetId[];
  if (partial.targets.length > 0) {
    targets = [...partial.targets];
    console.log(`Assistant Targets (from flags): ${targets.join(", ")}`);
  } else {
    targets = await promptAssistantTargets();
  }

  // Step 2: Select Setup Mode
  const mode = await promptSetupMode();

  // Step 3: Select Toolkit Components (only for Custom Install)
  let components: ComponentKind[];
  if (mode === "custom") {
    components = await promptComponents();
  } else {
    components = [...ALL_COMPONENT_KINDS];
  }

  // Step 3.5: Select External Sources (skip if --sources/--no-sources given,
  // or if --no-fetch was set, or if the manifest has nothing to offer).
  let selectedExternalSourceIds: readonly string[] | undefined =
    partial.selectedExternalSourceIds;
  if (
    selectedExternalSourceIds === undefined &&
    !partial.noFetch &&
    externalSources.length > 0
  ) {
    selectedExternalSourceIds = await promptExternalSources(externalSources);
  }

  // Step 4: Select write behavior (skip if provided via flags)
  let writeBehavior: WriteBehavior;
  if (partial.overwrite) {
    writeBehavior = "overwrite";
  } else if (partial.prune) {
    writeBehavior = "prune";
  } else {
    writeBehavior = await promptWriteBehavior();
  }

  // Step 4.5: Visual-plans Variant (skip if provided via --visual-plans)
  const visualPlansVariant =
    partial.visualPlansVariant ?? (await promptVisualPlansVariant());

  // Step 5: Dry-run toggle (skip if already set via flag)
  let dryRun = partial.dryRun;
  if (!dryRun) {
    dryRun = await promptDryRun();
  }

  // Step 6: Confirmation summary
  const profile: SetupProfile = {
    mode,
    targets,
    components,
    writeBehavior,
    dryRun,
    fetch: !partial.noFetch,
    symlink: partial.symlink,
    yes: partial.yes,
    quiet: partial.quiet,
    selectedExternalSourceIds,
    variants: { [VISUAL_PLANS_VARIANT_KEY]: visualPlansVariant },
  };

  if (!partial.yes) {
    const confirmed = await promptConfirmation(profile);
    if (!confirmed) {
      throw new Error("Setup cancelled by user.");
    }
  }

  return profile;
}

// -- Individual prompt functions --

/** Prompt for the visual-plans Variant (see docs/adr/0001). */
async function promptVisualPlansVariant(): Promise<VisualPlansVariant> {
  return select<VisualPlansVariant>({
    message: "Visual plans backend (/visual-plan, /visual-recap):",
    choices: [
      {
        name: "Self-hosted — Plan app on hestia via MCP (personal devices)",
        value: "self-hosted",
      },
      {
        name: "Local files — MDX + CLI bridge, no MCP (work laptop)",
        value: "local-files",
      },
      {
        name: "None — skip the visual-plan skills on this machine",
        value: "none",
      },
    ],
    default: DEFAULT_VISUAL_PLANS_VARIANT,
  });
}

/** Prompt user to choose Quick Sync or Full Setup. */
async function promptOperation(): Promise<"sync" | "setup"> {
  return select<"sync" | "setup">({
    message: "What do you want to do?",
    choices: [
      {
        name: "Quick Sync — re-project canonical → all targets, overwrite (like `git pull`)",
        value: "sync",
      },
      {
        name: "Full Setup — choose targets, mode, components, and write behavior",
        value: "setup",
      },
    ],
  });
}

/** Prompt user to select one or more Assistant Targets. */
async function promptAssistantTargets(): Promise<AssistantTargetId[]> {
  const selected = await checkbox<AssistantTargetId>({
    message: "Select Assistant Targets to install:",
    choices: [
      { name: "Claude Code (~/.claude)", value: "claude-code", checked: true },
      { name: "Codex CLI (~/.codex, ~/.agents)", value: "codex-cli", checked: true },
    ],
  });

  if (selected.length === 0) {
    throw new Error("At least one Assistant Target must be selected.");
  }

  return selected;
}

/** Prompt user to choose Default Install or Custom Install. */
async function promptSetupMode(): Promise<SetupMode> {
  return select<SetupMode>({
    message: "Setup mode:",
    choices: [
      {
        name: "Default Install — all Toolkit Components, Safe Merge",
        value: "default",
      },
      {
        name: "Custom Install — choose components and behavior",
        value: "custom",
      },
    ],
  });
}

/** Prompt user to select which Toolkit Components to include. */
async function promptComponents(): Promise<ComponentKind[]> {
  const selected = await checkbox<ComponentKind>({
    message: "Select Toolkit Components to install:",
    choices: ALL_COMPONENT_KINDS.map((kind) => ({
      name: kind,
      value: kind,
      checked: true,
    })),
  });

  if (selected.length === 0) {
    throw new Error("At least one Toolkit Component must be selected.");
  }

  return selected;
}

/** Prompt user to choose a write behavior. */
async function promptWriteBehavior(): Promise<WriteBehavior> {
  return select<WriteBehavior>({
    message: "Write behavior:",
    choices: [
      {
        name: "Safe Merge — copy missing files, skip existing conflicts",
        value: "safe-merge",
      },
      {
        name: "Overwrite — replace conflicting payload files",
        value: "overwrite",
      },
      {
        name: "Prune — overwrite + remove stale toolkit-owned files",
        value: "prune",
      },
    ],
  });
}

/**
 * Prompt user to choose which External Sources to install. MCP servers are
 * shown disabled (configure manually). Returns the selected source IDs;
 * empty array means the user opted out of all External Sources.
 */
async function promptExternalSources(
  sources: readonly ExternalSource[],
): Promise<string[]> {
  // Build choice list — MCP entries are disabled, non-MCP defaults are pre-checked.
  const choices = sources.map((s) => {
    const isMcp = s.kind === "mcp-server";
    const label = isMcp
      ? `${s.name} (${s.kind} — configure manually)`
      : `${s.name} (${s.kind})`;
    return {
      name: label,
      value: s.id,
      checked: !isMcp && s.default,
      disabled: isMcp ? "next steps only" : false,
    };
  });

  return checkbox<string>({
    message:
      "Select External Sources to install (space to toggle, enter to confirm; leave empty to skip all):",
    choices,
    required: false,
  });
}

/** Prompt user whether to run in dry-run mode. */
async function promptDryRun(): Promise<boolean> {
  return confirm({
    message: "Dry-run mode? (preview without writing files)",
    default: false,
  });
}

/** Show a confirmation summary and ask the user to proceed. */
async function promptConfirmation(profile: SetupProfile): Promise<boolean> {
  const targetNames = profile.targets
    .map((t) => (t === "claude-code" ? "Claude Code" : "Codex CLI"))
    .join(", ");

  const behaviorNames: Record<WriteBehavior, string> = {
    "safe-merge": "Safe Merge",
    overwrite: "Overwrite Install",
    prune: "Prune Install",
  };

  console.log("\n--- Setup Summary ---");
  console.log(`  Targets:    ${targetNames}`);
  console.log(`  Mode:       ${profile.mode === "default" ? "Default Install" : "Custom Install"}`);
  console.log(`  Components: ${profile.components.join(", ")}`);
  console.log(`  Behavior:   ${behaviorNames[profile.writeBehavior]}`);
  console.log(`  Dry-run:    ${profile.dryRun ? "yes" : "no"}`);
  console.log(`  Fetch:      ${profile.fetch ? "yes" : "no"}`);
  console.log("");

  return confirm({
    message: "Proceed with this configuration?",
    default: true,
  });
}
