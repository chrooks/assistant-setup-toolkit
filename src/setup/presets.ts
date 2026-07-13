/**
 * Preset parsing, loading, and resolution (ADR-0002).
 *
 * A Preset is a named, repo-declared partial Setup Profile in
 * manifests/presets.yaml. Machines remember only the Preset NAME (in the
 * Install Receipt); contents re-resolve from this file every run, so editing
 * a Preset updates every machine of that class on its next sync.
 */

import fs from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import type { Preset, SetupProfile } from "./domain.js";

/** The only keys a Preset may define — identity fields, never run ephemera. */
const PRESET_FIELDS = [
  "targets",
  "components",
  "selectedExternalSourceIds",
  "variants",
  "writeBehavior",
] as const;

/**
 * Parse and validate presets YAML. Unknown fields and versions fail loudly —
 * a typo like `varaints` must never be silently ignored.
 */
export function parsePresetsYaml(yamlText: string): Record<string, Preset> {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse presets YAML: ${message}`);
  }

  if (raw === null || typeof raw !== "object") {
    throw new Error("Presets file must be a YAML mapping.");
  }
  const doc = raw as Record<string, unknown>;

  if (doc.version !== 1) {
    throw new Error(
      `Unsupported presets version ${JSON.stringify(doc.version)} — expected 1.`,
    );
  }

  const presetsRaw = doc.presets ?? {};
  if (presetsRaw === null || typeof presetsRaw !== "object") {
    throw new Error("`presets` must be a mapping of preset names.");
  }

  const presets: Record<string, Preset> = {};
  for (const [name, value] of Object.entries(
    presetsRaw as Record<string, unknown>,
  )) {
    if (value === null || typeof value !== "object") {
      throw new Error(`Preset "${name}" must be a mapping.`);
    }
    const fields = value as Record<string, unknown>;
    for (const key of Object.keys(fields)) {
      if (!(PRESET_FIELDS as readonly string[]).includes(key)) {
        throw new Error(
          `Preset "${name}" has unknown field "${key}" — allowed: ${PRESET_FIELDS.join(", ")}.`,
        );
      }
    }
    if (fields.variants !== undefined) {
      const variants = fields.variants;
      if (variants === null || typeof variants !== "object") {
        throw new Error(`Preset "${name}": variants must be a mapping.`);
      }
      for (const [vk, vv] of Object.entries(
        variants as Record<string, unknown>,
      )) {
        if (typeof vv !== "string") {
          throw new Error(
            `Preset "${name}": variant "${vk}" must be a string value.`,
          );
        }
      }
    }
    presets[name] = fields as Preset;
  }

  return presets;
}

/**
 * Load presets from disk. A MISSING file → empty record (Presets are
 * optional); any other read error propagates — degrading a permission or IO
 * failure to "no presets" would misdiagnose an unknown-name abort.
 */
export async function loadPresets(
  filePath: string,
): Promise<Record<string, Preset>> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
  return parsePresetsYaml(raw);
}

/**
 * Compute the variants to persist in the Install Receipt: flag-sourced keys
 * are one-off (ADR-0002) and must not stick — each reverts to the prior
 * receipt value, or drops when there was none. Preset/prompt-sourced values
 * pass through.
 */
export function stickyReceiptVariants(
  profileVariants: Readonly<Record<string, string>> | undefined,
  flagKeys: readonly string[],
  priorReceiptVariants: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  const sticky: Record<string, string> = { ...profileVariants };
  for (const key of flagKeys) {
    const prior = priorReceiptVariants?.[key];
    if (prior !== undefined) {
      sticky[key] = prior;
    } else {
      delete sticky[key];
    }
  }
  return sticky;
}

/**
 * Resolve the effective Preset name: flag beats receipt (rung 1 vs rung 4).
 * An unknown name — flag-typed or receipt-recorded — fails loudly with the
 * available names; a renamed Preset must never silently fall back to defaults.
 */
export function resolvePresetName(
  presets: Readonly<Record<string, Preset>>,
  flagName: string | undefined,
  receiptName: string | undefined,
): string | undefined {
  const name = flagName ?? receiptName;
  if (name === undefined) return undefined;
  if (!(name in presets)) {
    const available = Object.keys(presets).join(", ") || "(none defined)";
    throw new Error(
      `Unknown Preset "${name}" — available in manifests/presets.yaml: ${available}.`,
    );
  }
  return name;
}

/** SetupProfile fields whose flag-built values may just be defaults. */
export type ExplicitField = "targets" | "components" | "writeBehavior";

/** One line of "what this Preset actually changed about the run". */
export interface PresetEffect {
  /** The Preset field this came from, e.g. "variants.machine". */
  readonly field: string;
  /** What the run ended up doing, in plain terms. */
  readonly effect: string;
  /** True when a CLI flag beat the Preset's value for this field. */
  readonly overridden: boolean;
}

/**
 * Spell out what a Preset did to this run.
 *
 * Compares the Preset's declared fields against the RESOLVED profile, so it
 * reports the same truth whichever path built that profile (flags or prompts),
 * and marks any field a flag overrode. Naming a Preset is otherwise an act of
 * faith — the run says "preset hestia" and never says what that bought you.
 *
 * Pure: takes the resolved profile, returns lines.
 */
export function describePresetEffects(
  profile: SetupProfile,
  preset: Preset,
): readonly PresetEffect[] {
  const effects: PresetEffect[] = [];

  if (preset.targets) {
    const got = [...profile.targets].sort().join(", ");
    const want = [...preset.targets].sort().join(", ");
    effects.push({
      field: "targets",
      effect: got,
      overridden: got !== want,
    });
  }

  if (preset.components) {
    const got = [...profile.components].sort().join(", ");
    const want = [...preset.components].sort().join(", ");
    effects.push({
      field: "components",
      effect: `${profile.components.length} component(s)`,
      overridden: got !== want,
    });
  }

  if (preset.writeBehavior) {
    effects.push({
      field: "writeBehavior",
      effect: profile.writeBehavior,
      overridden: profile.writeBehavior !== preset.writeBehavior,
    });
  }

  if (preset.selectedExternalSourceIds) {
    const got = profile.selectedExternalSourceIds;
    const want = preset.selectedExternalSourceIds;
    effects.push({
      field: "selectedExternalSourceIds",
      effect:
        got === undefined
          ? "manifest defaults"
          : got.length === 0
            ? "no External Sources"
            : got.join(", "),
      overridden:
        got === undefined ||
        got.length !== want.length ||
        got.some((id, i) => id !== want[i]),
    });
  }

  for (const [key, value] of Object.entries(preset.variants ?? {})) {
    const actual = profile.variants?.[key];
    effects.push({
      field: `variants.${key}`,
      effect: `${actual ?? "(unset)"}${describeVariant(key, actual)}`,
      overridden: actual !== value,
    });
  }

  return effects;
}

/**
 * Translate a Variant value into its visible consequence. A bare
 * `machine=hestia` says nothing about what changed; "installs rules/machine.md"
 * does. Unknown Variants get no gloss rather than a wrong one.
 */
function describeVariant(key: string, value: string | undefined): string {
  if (value === undefined) return "";
  if (key === "machine") {
    return ` — installs rules/machine.md from canonical/rules/machines/${value}.md`;
  }
  if (key === "visual-plans") {
    if (value === "none") return " — visual-plan/visual-recap skills excluded";
    if (value === "self-hosted") return " — visual-plan/visual-recap via the Plan MCP";
    if (value === "local-files") return " — visual-plan/visual-recap write local MDX (no MCP)";
  }
  return "";
}

/**
 * Apply a Preset to a flag-built profile: each Preset field fills a gap the
 * flags left. Flags always win (rung 1 of the ladder beats rung 2), so the
 * caller names which fields the user set explicitly — the profile alone can't
 * distinguish "chose safe-merge" from "defaulted to safe-merge".
 * Returns a new profile; never mutates.
 */
export function resolvePresetIntoProfile(
  base: SetupProfile,
  preset: Preset,
  explicit: ReadonlySet<ExplicitField> = new Set(),
): SetupProfile {
  return {
    ...base,
    targets:
      explicit.has("targets") || !preset.targets
        ? base.targets
        : preset.targets,
    components:
      explicit.has("components") || !preset.components
        ? base.components
        : preset.components,
    writeBehavior:
      explicit.has("writeBehavior") || !preset.writeBehavior
        ? base.writeBehavior
        : preset.writeBehavior,
    selectedExternalSourceIds:
      base.selectedExternalSourceIds ?? preset.selectedExternalSourceIds,
    // Per-key merge: an explicit --visual-plans flag beats the Preset's entry.
    variants: { ...preset.variants, ...base.variants },
  };
}
