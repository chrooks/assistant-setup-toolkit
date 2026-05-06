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
} from "./domain.js";
import { ALL_COMPONENT_KINDS } from "./domain.js";
import type { PartialFlags } from "./cli.js";

/**
 * Run the full interactive prompt flow, returning a complete SetupProfile.
 * Pre-fills answers from any partial flags the user provided on the CLI.
 */
export async function runInteractivePrompts(
  partial: PartialFlags,
): Promise<SetupProfile> {
  console.log("\nAssistant Setup Toolkit Setup Wizard\n");

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

  // Step 4: Select write behavior (skip if provided via flags)
  let writeBehavior: WriteBehavior;
  if (partial.overwrite) {
    writeBehavior = "overwrite";
  } else if (partial.prune) {
    writeBehavior = "prune";
  } else {
    writeBehavior = await promptWriteBehavior();
  }

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
