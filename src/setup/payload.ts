/**
 * Assistant Payload builder.
 *
 * Builds payloads for each Assistant Target by merging external sources,
 * canonical source files, and target projections. The crucial ordering
 * rule: external sources are layered first, then local Canonical Assistant
 * Source files are applied last so local files win conflicts by relative path.
 */

import type {
  AssistantTargetId,
  AssistantHomeId,
  ComponentKind,
  PayloadFile,
  AssistantPayload,
  PayloadFileOrigin,
} from "./domain.js";
import { resolveAssistantHomes } from "./domain.js";

// -- Types --

/** Input for building Assistant Payloads. */
export interface BuildPayloadInput {
  readonly targets: readonly AssistantTargetId[];
  readonly components: readonly ComponentKind[];
  /** Files from External Sources (applied first, may be overridden). */
  readonly externalFiles: readonly PayloadFile[];
  /** Files from the Canonical Assistant Source canonical/ (applied last, wins conflicts). */
  readonly canonicalFiles: readonly PayloadFile[];
  /** Files from Target Projections (.codex/, .agents/). */
  readonly projectionFiles: readonly PayloadFile[];
}

/** A recorded conflict where two sources provided the same relative path. */
interface PayloadConflict {
  readonly relativePath: string;
  readonly winner: PayloadFileOrigin;
  readonly loser: PayloadFileOrigin;
}

/** Result of building payloads, including conflict log for dry-run reporting. */
export interface BuildPayloadResult {
  readonly payloads: readonly AssistantPayload[];
  readonly conflicts: readonly PayloadConflict[];
}

// -- Home routing rules --

/**
 * Determines which Assistant Home a file belongs to for a given target.
 * Codex CLI splits files: instructions/plans go to codex-home,
 * skills go to agents-home.
 */
function routeFileToHome(
  file: PayloadFile,
  target: AssistantTargetId,
): AssistantHomeId | null {
  if (target === "claude-code") {
    return "claude-home";
  }

  // Codex CLI routing: instructions and plans to codex-home, skills to agents-home
  if (target === "codex-cli") {
    if (file.component === "instructions" || file.component === "plans") {
      return "codex-home";
    }
    if (file.component === "skills") {
      return "agents-home";
    }
    // Other component types don't have a Codex equivalent yet
    return null;
  }

  return null;
}

// -- Payload building --

/**
 * Build Assistant Payloads for each target.
 *
 * Precedence rule (load-bearing):
 * 1. External Source files are added first
 * 2. Canonical Assistant Source files are applied last — if they share a
 *    relative path with an external file, the canonical file wins
 * 3. Target Projection files are used for Codex targets instead of raw
 *    canonical files
 *
 * Conflicts are recorded so dry-run output can explain what won.
 */
export function buildAssistantPayloads(
  input: BuildPayloadInput,
): BuildPayloadResult {
  const conflicts: PayloadConflict[] = [];

  // Build a merged file map per home: external first, then local overwrites
  const homeFileMaps = new Map<AssistantHomeId, Map<string, PayloadFile>>();

  // Helper to ensure a home map exists
  function getHomeMap(homeId: AssistantHomeId): Map<string, PayloadFile> {
    let map = homeFileMaps.get(homeId);
    if (!map) {
      map = new Map();
      homeFileMaps.set(homeId, map);
    }
    return map;
  }

  // Determine which homes we need
  const homes = resolveAssistantHomes(input.targets);
  for (const home of homes) {
    getHomeMap(home);
  }

  // For each target, route files to the appropriate home
  for (const target of input.targets) {
    // Step 1: Layer external files first
    for (const file of input.externalFiles) {
      if (!input.components.includes(file.component)) continue;
      const homeId = routeFileToHome(file, target);
      if (!homeId) continue;

      const homeMap = getHomeMap(homeId);
      homeMap.set(file.relativePath, file);
    }

    // Step 2: Layer canonical/projection files last — they win conflicts
    const localFiles =
      target === "codex-cli" ? input.projectionFiles : input.canonicalFiles;

    for (const file of localFiles) {
      if (!input.components.includes(file.component)) continue;
      const homeId = routeFileToHome(file, target);
      if (!homeId) continue;

      const homeMap = getHomeMap(homeId);
      const existing = homeMap.get(file.relativePath);

      // Record conflict if overwriting an external file
      if (existing && existing.origin !== file.origin) {
        conflicts.push({
          relativePath: file.relativePath,
          winner: file.origin,
          loser: existing.origin,
        });
      }

      // Local file wins
      homeMap.set(file.relativePath, file);
    }

    // Also add canonical files for claude-code that weren't covered above
    if (target === "claude-code") {
      // Already handled in the localFiles loop
    }
  }

  // Convert home maps to AssistantPayload objects
  const payloads: AssistantPayload[] = [];

  for (const target of input.targets) {
    const targetHomes = resolveAssistantHomes([target]);
    for (const homeId of targetHomes) {
      const homeMap = homeFileMaps.get(homeId);
      if (!homeMap) continue;

      payloads.push({
        target,
        homeId,
        files: Array.from(homeMap.values()),
      });
    }
  }

  return { payloads, conflicts };
}
