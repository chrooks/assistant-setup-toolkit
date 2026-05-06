/**
 * External Source fetch planning.
 *
 * Plans which External Sources to fetch based on targets, defaults,
 * and fetch flag. MCP servers are always skipped (next-steps-only).
 * Actual network fetching is deferred — this module plans the work.
 */

import type { ExternalSource } from "./manifest.js";
import type { AssistantTargetId } from "./domain.js";

/** A source planned for fetching. */
export interface PlannedFetch {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly kind: ExternalSource["kind"];
}

/** A source skipped with a reason. */
export interface SkippedFetch {
  readonly id: string;
  readonly name: string;
  readonly reason: string;
}

/** Result of fetch planning. */
export interface FetchPlan {
  readonly planned: readonly PlannedFetch[];
  readonly skipped: readonly SkippedFetch[];
}

/** Options for fetch planning. */
export interface FetchPlanOptions {
  readonly targets: readonly AssistantTargetId[];
  readonly fetch: boolean;
}

/**
 * Plan which External Sources should be fetched.
 *
 * Rules:
 * - MCP servers are always skipped (handled via Next Steps)
 * - Non-default sources are skipped unless explicitly selected
 * - Sources not targeting any selected target are skipped
 * - All sources skipped when fetch is disabled
 */
export function planExternalFetches(
  sources: readonly ExternalSource[],
  options: FetchPlanOptions,
): FetchPlan {
  const planned: PlannedFetch[] = [];
  const skipped: SkippedFetch[] = [];

  for (const source of sources) {
    // Skip all if fetch disabled
    if (!options.fetch) {
      skipped.push({
        id: source.id,
        name: source.name,
        reason: `Fetch disabled (--no-fetch)`,
      });
      continue;
    }

    // MCP servers are next-steps-only
    if (source.kind === "mcp-server") {
      skipped.push({
        id: source.id,
        name: source.name,
        reason: `MCP server — configure via Next Steps`,
      });
      continue;
    }

    // Check target compatibility
    const hasMatchingTarget = source.targets.some((t) =>
      options.targets.includes(t),
    );
    if (!hasMatchingTarget) {
      skipped.push({
        id: source.id,
        name: source.name,
        reason: `No matching target selected`,
      });
      continue;
    }

    // Only fetch default sources (custom selection not yet implemented)
    if (!source.default) {
      skipped.push({
        id: source.id,
        name: source.name,
        reason: `Not a default source`,
      });
      continue;
    }

    planned.push({
      id: source.id,
      name: source.name,
      url: source.url,
      kind: source.kind,
    });
  }

  return { planned, skipped };
}
