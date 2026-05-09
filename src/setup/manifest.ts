/**
 * Installation Manifest parser and validator.
 *
 * Reads a YAML Installation Manifest, validates it with Zod,
 * and returns normalized External Sources. Fails fast with
 * descriptive errors naming the manifest path and invalid field.
 */

import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { AssistantTargetId, ExternalSourceKind } from "./domain.js";

// -- Zod schemas --

/** Conditional install rule — source is only installed when a condition is met. */
const InstallWhenSchema = z.object({
  assistantTargetExists: z.enum(["claude-code", "codex-cli"]).optional(),
});

/** Native installation commands grouped by Assistant Target. */
const InstallCommandsSchema = z
  .object({
    "claude-code": z.array(z.string().min(1)).optional(),
    "codex-cli": z.array(z.string().min(1)).optional(),
  })
  .strict();

/** Schema for a single External Source entry in the manifest. */
const ExternalSourceSchema = z.object({
  id: z.string().min(1, "id must not be empty"),
  name: z.string().min(1, "name must not be empty"),
  kind: z.enum(["skill", "skill-pack", "plugin", "skill-or-plugin", "mcp-server"]),
  url: z.string().url("url must be a valid URL"),
  default: z.boolean(),
  targets: z.array(z.enum(["claude-code", "codex-cli"])).min(1, "targets must have at least one entry"),
  notes: z.array(z.string()).optional(),
  installCommands: InstallCommandsSchema.optional(),
  requiresConfirmation: z.boolean().optional(),
  requiredSecrets: z.array(z.string()).optional(),
  installWhen: InstallWhenSchema.optional(),
});

/** Schema for the full Installation Manifest. Uses strict() to reject unknown top-level fields. */
const InstallationManifestSchema = z
  .object({
    version: z.literal(1, {
      errorMap: () => ({ message: "version must be 1" }),
    }),
    externalSources: z.array(ExternalSourceSchema),
  })
  .strict();

// -- Public types derived from Zod schemas --

export type ExternalSource = z.infer<typeof ExternalSourceSchema>;
export type InstallationManifest = z.infer<typeof InstallationManifestSchema>;

// -- Public functions --

/**
 * Parse a YAML string into a validated Installation Manifest.
 * Throws with descriptive error messages on invalid input.
 *
 * @param yamlText - raw YAML content
 * @param sourceName - file name or label used in error messages
 */
export function parseInstallationManifestYaml(
  yamlText: string,
  sourceName: string,
): InstallationManifest {
  // Parse raw YAML into a JS object
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse YAML in ${sourceName}: ${message}`);
  }

  // Validate with Zod — strict mode rejects unknown top-level fields
  const result = InstallationManifestSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
        return `  ${path}: ${issue.message}`;
      })
      .join("\n");
    throw new Error(
      `Invalid Installation Manifest in ${sourceName}:\n${issues}`,
    );
  }

  return result.data;
}

/**
 * Load and validate an Installation Manifest from a file path.
 * Reads the file, parses as YAML, and validates.
 */
export async function loadInstallationManifest(
  filePath: string,
): Promise<InstallationManifest> {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(filePath, "utf-8");
  return parseInstallationManifestYaml(content, filePath);
}
