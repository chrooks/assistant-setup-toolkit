/**
 * CLI flag parsing for the Setup Wizard.
 *
 * Converts raw argv flags into a SetupProfile. When required flags are
 * missing, returns "interactive" to signal that prompts are needed.
 *
 * Parsing goes through Node's built-in `util.parseArgs` in strict mode, so an
 * unknown or misspelled flag fails loudly instead of being silently dropped
 * (`--defualt` used to fall through to interactive with no explanation).
 */

import { parseArgs } from "node:util";
import type {
  AssistantTargetId,
  SetupMode,
  WriteBehavior,
  SetupProfile,
} from "./domain.js";
import {
  ALL_COMPONENT_KINDS,
  VISUAL_PLANS_VARIANT_KEY,
  VISUAL_PLANS_VARIANTS,
} from "./domain.js";
import type { VisualPlansVariant } from "./domain.js";

/** Write behaviors accepted by `--write`. */
const WRITE_BEHAVIORS: readonly WriteBehavior[] = [
  "safe-merge",
  "overwrite",
  "prune",
];

/** Result of attempting to parse CLI flags. */
export type ParseResult =
  | { kind: "profile"; profile: SetupProfile }
  | { kind: "interactive"; partial: PartialFlags }
  | { kind: "help"; text: string }
  | { kind: "error"; message: string };

/** Flags that were provided but insufficient for a full profile. */
export interface PartialFlags {
  readonly targets: readonly AssistantTargetId[];
  readonly dryRun: boolean;
  readonly writeBehavior: WriteBehavior;
  readonly symlink: boolean;
  readonly noFetch: boolean;
  readonly yes: boolean;
  readonly quiet: boolean;
  readonly artifacts: boolean;
  /**
   * Optional explicit External Source IDs from `--sources <a,b,c>`.
   * `undefined` means the flag wasn't passed (use manifest defaults).
   * `[]` means `--no-sources` was passed (skip all External Sources).
   */
  readonly selectedExternalSourceIds?: readonly string[];
  /** Optional `--visual-plans <value>` Variant, validated against the union. */
  readonly visualPlansVariant?: VisualPlansVariant;
  /** Optional `--preset <name>` — validated against presets.yaml downstream. */
  readonly presetName?: string;
}

export const HELP_TEXT = `Assistant Setup Toolkit — Setup Wizard

Usage: npm run setup -- [flags]

Targets (at least one; omit to be prompted)
  --claude                 Install into the Claude Code home (~/.claude)
  --codex                  Install into the Codex CLI home (~/.codex)

Mode (omit to be prompted)
  --default                Install every Toolkit Component
  --custom                 Pick components interactively

Writing
  --write <behavior>       safe-merge (default) | overwrite | prune
  --symlink                Link files instead of copying them
  --dry-run                Print the plan; write nothing

Sources & Variants
  --sources <a,b,c>        Only these External Sources
  --no-sources             Skip all External Sources
  --no-fetch               Use cached sources; do not hit the network
  --preset <name>          Apply a Preset from manifests/presets.yaml
  --visual-plans <v>       ${VISUAL_PLANS_VARIANTS.join(" | ")}

Other
  --artifacts              Build Skill Artifact ZIPs for manual upload (slow; off by default)
  --yes                    Skip the confirmation prompt
  --quiet                  Print errors only
  --help                   Show this message

Shorthand
  --sync                   Re-project everything: both targets, --default,
                           --write overwrite, --no-fetch, --yes

Examples
  npm run setup -- --claude --default
  npm run setup -- --claude --write overwrite --artifacts
  npm run setup -- --preset hestia --default --dry-run
`;

/**
 * Try to parse CLI flags into a complete SetupProfile.
 * Returns "interactive" when required flags (target + mode) are missing,
 * "help" for --help, and "error" for anything malformed.
 */
export function tryParseCliFlags(argv: readonly string[]): ParseResult {
  let values: Record<string, unknown>;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        claude: { type: "boolean", default: false },
        codex: { type: "boolean", default: false },
        default: { type: "boolean", default: false },
        custom: { type: "boolean", default: false },
        write: { type: "string" },
        symlink: { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        sources: { type: "string" },
        "no-sources": { type: "boolean", default: false },
        "no-fetch": { type: "boolean", default: false },
        preset: { type: "string" },
        "visual-plans": { type: "string" },
        artifacts: { type: "boolean", default: false },
        yes: { type: "boolean", default: false },
        quiet: { type: "boolean", default: false },
        sync: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    }));
  } catch (err: unknown) {
    // parseArgs throws on unknown flags and on a value-flag with no value.
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "error", message };
  }

  if (values.help === true) return { kind: "help", text: HELP_TEXT };

  const sync = values.sync === true;

  const targets: AssistantTargetId[] = [];
  if (values.claude === true) targets.push("claude-code");
  if (values.codex === true) targets.push("codex-cli");
  const targetsExplicit = targets.length > 0;
  // `--sync` = "git pull"-style re-projection. It only supplies defaults;
  // an explicit flag still wins (`--sync --claude` syncs Claude alone).
  if (sync && targets.length === 0) targets.push("claude-code", "codex-cli");

  if (values.default === true && values.custom === true) {
    return {
      kind: "error",
      message: "Pass either --default or --custom, not both.",
    };
  }

  // One flag, one choice. This used to be three booleans (--overwrite /
  // --prune / --symlink) collapsed by a last-wins if-chain, so `--overwrite
  // --prune` silently meant prune. --symlink stays separate: it governs *how*
  // a file lands, not which files get replaced.
  let writeBehavior: WriteBehavior = "safe-merge";
  if (values.write !== undefined) {
    const raw = String(values.write).trim();
    if (!WRITE_BEHAVIORS.includes(raw as WriteBehavior)) {
      return {
        kind: "error",
        message: `Invalid --write value "${raw}" — expected one of: ${WRITE_BEHAVIORS.join(", ")}.`,
      };
    }
    writeBehavior = raw as WriteBehavior;
  } else if (sync) {
    writeBehavior = "overwrite";
  }

  let selectedExternalSourceIds: readonly string[] | undefined;
  if (values["no-sources"] === true) {
    selectedExternalSourceIds = [];
  } else if (values.sources !== undefined) {
    selectedExternalSourceIds = String(values.sources)
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  let visualPlansVariant: VisualPlansVariant | undefined;
  if (values["visual-plans"] !== undefined) {
    const raw = String(values["visual-plans"]).trim();
    if (!(VISUAL_PLANS_VARIANTS as readonly string[]).includes(raw)) {
      return {
        kind: "error",
        message: `Invalid --visual-plans value "${raw}" — expected one of: ${VISUAL_PLANS_VARIANTS.join(", ")}.`,
      };
    }
    visualPlansVariant = raw as VisualPlansVariant;
  }

  // Preset name validity is checked downstream against presets.yaml — cli.ts
  // stays IO-free. Here we only reject an empty name.
  let presetName: string | undefined;
  if (values.preset !== undefined) {
    const raw = String(values.preset).trim();
    if (raw === "") {
      return {
        kind: "error",
        message: "--preset requires a name (see manifests/presets.yaml).",
      };
    }
    presetName = raw;
  }

  const hasDefault = values.default === true || sync;
  const hasCustom = values.custom === true;
  const dryRun = values["dry-run"] === true;
  const noFetch = values["no-fetch"] === true || sync;
  const yes = values.yes === true || sync;
  const quiet = values.quiet === true;
  const symlink = values.symlink === true;
  const artifacts = values.artifacts === true;

  if (targets.length > 0 && (hasDefault || hasCustom)) {
    return {
      kind: "profile",
      profile: {
        mode: hasCustom ? "custom" : "default",
        targets,
        components: [...ALL_COMPONENT_KINDS],
        writeBehavior,
        dryRun,
        fetch: !noFetch,
        symlink,
        yes,
        quiet,
        artifacts,
        selectedExternalSourceIds,
        // Unset stays undefined so the Install Receipt's recorded Variant can
        // rehydrate it downstream.
        variants: visualPlansVariant
          ? { [VISUAL_PLANS_VARIANT_KEY]: visualPlansVariant }
          : undefined,
        presetName,
        targetsExplicit,
      },
    };
  }

  return {
    kind: "interactive",
    partial: {
      targets,
      dryRun,
      writeBehavior,
      symlink,
      noFetch,
      yes,
      quiet,
      artifacts,
      selectedExternalSourceIds,
      visualPlansVariant,
      presetName,
    },
  };
}

/**
 * Parse CLI flags into a SetupProfile, throwing if insufficient.
 * Used by tests and non-interactive callers.
 */
export function parseCliFlags(argv: readonly string[]): SetupProfile {
  const result = tryParseCliFlags(argv);
  if (result.kind === "profile") return result.profile;
  if (result.kind === "error") throw new Error(result.message);
  if (result.kind === "help") throw new Error("--help requested; no profile to build.");

  if (result.partial.targets.length === 0) {
    throw new Error("Specify at least one Assistant Target: --claude, --codex");
  }
  throw new Error(
    "Specify --default or --custom to select a Setup Mode in non-interactive mode.",
  );
}
