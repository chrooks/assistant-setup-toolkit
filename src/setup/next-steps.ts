/**
 * Next Steps formatting for the Setup Wizard.
 *
 * Next Steps are post-install actions the wizard cannot or should not
 * automate: manual desktop uploads, MCP Server secrets, etc.
 */

/** The kind of Next Step — determines how it's presented. */
export type NextStepKind =
  | "mcp-secret"
  | "mcp-confirmation"
  | "desktop-upload"
  | "manual-action";

/** A single post-install action for the user. */
export interface NextStep {
  readonly kind: NextStepKind;
  readonly description: string;
  readonly sourceId?: string;
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
 * Format Next Steps as human-readable lines for CLI output.
 */
export function formatNextSteps(
  steps: readonly NextStep[],
): readonly string[] {
  if (steps.length === 0) return ["  (none)"];

  return steps.map((step, i) => `  ${i + 1}. ${step.description}`);
}
