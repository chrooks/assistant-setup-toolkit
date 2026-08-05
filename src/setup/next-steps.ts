/**
 * Next Steps formatting for the Setup Wizard.
 *
 * Next Steps are post-install actions the wizard cannot or should not
 * automate: manual desktop uploads, MCP Server secrets, etc.
 */

import type { AssistantTargetId, VisualPlansVariant } from "./domain.js";
import { SELF_HOSTED_PLAN_ORIGIN_ENV, selfHostedPlanOrigin } from "./domain.js";
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
 * Build Next Steps for the visual-plans Variant. MCP registration and env
 * vars are surfaced, never executed, matching the toolkit's MCP posture.
 */
export function planVisualPlansNextSteps(
  variant: VisualPlansVariant,
  targets: readonly AssistantTargetId[],
): readonly NextStep[] {
  if (variant === "none") return [];

  if (variant === "self-hosted") {
    // The origin is a home-server hostname: machine-local, never in the repo.
    const origin = selfHostedPlanOrigin();
    if (origin === undefined) {
      return [
        {
          kind: "manual-action",
          description: `Set ${SELF_HOSTED_PLAN_ORIGIN_ENV} to your Plan deployment's origin (for example in ~/.zshrc), then re-run setup to get the exact MCP registration command`,
        },
      ];
    }

    const steps: NextStep[] = [];
    if (targets.includes("claude-code")) {
      steps.push({
        kind: "manual-action",
        description: `Register the self-hosted Plan MCP for Claude Code: claude mcp add --transport http plan ${origin}/_agent-native/mcp`,
      });
    }
    if (targets.includes("codex-cli")) {
      steps.push({
        kind: "manual-action",
        description: `Register the self-hosted Plan MCP for Codex CLI: add an mcp_servers entry for ${origin}/_agent-native/mcp to ~/.codex/config.toml`,
      });
    }
    return steps;
  }

  // local-files: no MCP entry at all — the skills' privacy mode takes over.
  return [
    {
      kind: "manual-action",
      description:
        "Enable visual-plans local-files mode (no MCP): set AGENT_NATIVE_PLANS_MODE=local-files persistently (shell profile or Claude settings env). See canonical/skills/visual-plan/references/local-files.md for the authoring flow.",
    },
  ];
}

/**
 * Build the Next Step for a `machine` Variant whose rule file is missing on
 * disk (ADR-0003: machine files are local-only and hand-created; ADR-0004:
 * TEMPLATE.md is the copy source). The wizard surfaces it, never creates it.
 */
export function planMachineRuleNextSteps(
  machine: string | undefined,
  machineRuleFileExists: boolean,
): readonly NextStep[] {
  if (!machine || machineRuleFileExists) return [];
  return [
    {
      kind: "manual-action",
      description: `Machine Variant "${machine}" is set but canonical/machines/${machine}/rules.md does not exist — copy canonical/machines/TEMPLATE.md to it and fill in this machine's context and Resource access, then re-run setup.`,
    },
  ];
}

/** Health of one live config file in an Assistant Home. */
export interface ConfigStatus {
  /** Config filename, e.g. "knowledge-config.json". */
  readonly fileName: string;
  /** Assistant Home holding it, e.g. "~/.claude". */
  readonly home: string;
  /** Whether the live file exists (the example shipping beside it does not count). */
  readonly exists: boolean;
  /**
   * Human-readable problems found inside an existing file — an unresolvable
   * path value, unparseable content. Empty means healthy.
   */
  readonly problems: readonly string[];
}

/**
 * Build Next Steps for live config the canonical Skills and hooks depend on.
 *
 * The wizard ships `*.example.*` files and the human owns the live ones, so
 * this reports rather than writes. Conditional by design: a step appears only
 * when a config is missing or carries a path that does not resolve. An
 * unconditional "update your config" line every run is noise, and noise is how
 * a stale path survives unnoticed.
 */
export function planConfigNextSteps(
  statuses: readonly ConfigStatus[],
): readonly NextStep[] {
  const steps: NextStep[] = [];

  for (const status of statuses) {
    const example = status.fileName.replace(/\.([^.]+)$/, ".example.$1");
    if (!status.exists) {
      steps.push({
        kind: "manual-action",
        description: `${status.home}/${status.fileName} does not exist — Skills that read it will fail. Copy ${status.home}/${example} to it and fill in your paths.`,
      });
      continue;
    }
    if (status.problems.length > 0) {
      steps.push({
        kind: "manual-action",
        description: `${status.home}/${status.fileName} has ${status.problems.length} problem(s): ${status.problems.join("; ")} — update it.`,
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
