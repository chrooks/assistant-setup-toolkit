/**
 * MCP Server planning and Next Steps generation.
 *
 * MCP Servers require explicit user confirmation before installation.
 * This module produces Next Steps — it never silently installs or runs
 * server processes.
 */

import type { ExternalSource } from "./manifest.js";
import type { NextStep } from "./next-steps.js";

/**
 * Plan Next Steps for MCP Server External Sources.
 * Produces confirmation and secret-required steps without executing anything.
 */
export function planMcpNextSteps(
  sources: readonly ExternalSource[],
): readonly NextStep[] {
  const steps: NextStep[] = [];

  for (const source of sources) {
    // Only process MCP server sources
    if (source.kind !== "mcp-server") continue;

    // Sources with required secrets get a secret step
    if (source.requiredSecrets && source.requiredSecrets.length > 0) {
      const secrets = source.requiredSecrets.join(", ");
      steps.push({
        kind: "mcp-secret",
        description: `Add required secret(s) for ${source.name}: ${secrets}. Do not commit secrets to source control.`,
        sourceId: source.id,
      });
      continue;
    }

    // Sources requiring confirmation get a confirmation step
    if (source.requiresConfirmation) {
      steps.push({
        kind: "mcp-confirmation",
        description: `${source.name} requires confirmation before installation. Review ${source.url} and configure manually.`,
        sourceId: source.id,
      });
    }
  }

  return steps;
}
