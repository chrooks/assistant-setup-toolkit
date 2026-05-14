/**
 * Next Steps formatting for the Setup Wizard.
 *
 * Next Steps are post-install actions the wizard cannot or should not
 * automate: manual desktop uploads, MCP Server secrets, etc.
 */

import type { AssistantTargetId } from "./domain.js";
import type { ExternalSource } from "./manifest.js";

/** The kind of Next Step — determines how it's presented. */
type NextStepKind =
  | "mcp-secret"
  | "mcp-confirmation"
  | "desktop-upload"
  | "install-command"
  | "manual-action";

/** A single post-install action for the user. */
export interface NextStep {
  readonly kind: NextStepKind;
  readonly description: string;
  readonly sourceId?: string;
}

/** Input for planning native install command Next Steps. */
export interface InstallCommandNextStepsInput {
  readonly sources: readonly ExternalSource[];
  readonly selectedSourceIds: readonly string[];
  readonly targets: readonly AssistantTargetId[];
}

/**
 * Build the standard Next Steps that always apply after a Setup Wizard run.
 * MCP-specific steps are added separately via planMcpNextSteps.
 */
export function buildStandardNextSteps(
  hasSkillArtifacts: boolean,
): readonly NextStep[] {
  const steps: NextStep[] = [];

  if (hasSkillArtifacts) {
    steps.push({
      kind: "desktop-upload",
      description:
        "Upload generated Skill Artifacts (artifacts/*.zip) manually where desktop/web upload is required.",
    });
  }

  return steps;
}

/**
 * Build Next Steps for native install commands recorded in the Installation
 * Manifest. These commands are intentionally surfaced, not executed, because
 * they may invoke external installers with their own side effects.
 */
export function planInstallCommandNextSteps(
  input: InstallCommandNextStepsInput,
): readonly NextStep[] {
  const selected = new Set(input.selectedSourceIds);
  const steps: NextStep[] = [];

  for (const source of input.sources) {
    if (!selected.has(source.id)) continue;
    if (!source.installCommands) continue;

    for (const target of input.targets) {
      const commands = source.installCommands[target];
      if (!commands || commands.length === 0) continue;

      steps.push({
        kind: "install-command",
        sourceId: source.id,
        description: `Run native ${source.name} install for ${targetLabel(target)}: ${commands.join(" && ")}`,
      });
    }
  }

  return steps;
}

/**
 * Format Next Steps as human-readable lines for CLI output.
 */
export function formatNextSteps(
  steps: readonly NextStep[],
): readonly string[] {
  if (steps.length === 0) return ["  (none)"];

  return steps.map((step, i) => `  ${i + 1}. ${step.description}`);
}

/**
 * Format the complete Next Steps section with visible separators so it stands
 * apart from write, hook, artifact, and verification output.
 */
export function formatNextStepsSection(
  steps: readonly NextStep[],
): readonly string[] {
  const separator = "========================================";
  return ["", separator, "Next Steps", separator, ...formatNextSteps(steps), separator];
}

/** Map an AssistantTargetId to a human-readable label. */
function targetLabel(targetId: AssistantTargetId): string {
  const labels: Record<AssistantTargetId, string> = {
    "claude-code": "Claude Code",
    "codex-cli": "Codex CLI",
  };
  return labels[targetId];
}
