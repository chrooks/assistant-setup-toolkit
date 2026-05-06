/**
 * Setup Wizard orchestration entry point.
 *
 * Wires together CLI parsing, manifest loading, payload building,
 * write planning, verification, and Next Steps into a single run.
 * The orchestrator reads the real filesystem to discover Canonical
 * Assistant Source files and produces dry-run or live output.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { parseCliFlags } from "./cli.js";
import { resolveAssistantHomes } from "./domain.js";
import type { AssistantTargetId, AssistantHomeId, PayloadFile, ComponentKind } from "./domain.js";
import { loadInstallationManifest } from "./manifest.js";
import type { ExternalSource } from "./manifest.js";
import { resolveAssistantHomePath, resolveReceiptPath } from "./paths.js";
import { planCodexProjection, rewriteContentForCodex } from "./projection.js";
import type { ProjectionMapping } from "./projection.js";
import { buildAssistantPayloads } from "./payload.js";
import { planWrites } from "./write-plan.js";
import type { WritePlan } from "./write-plan.js";
import { planVerificationChecks, formatVerificationResult } from "./verify.js";
import { planMcpNextSteps } from "./mcp.js";
import { buildStandardNextSteps, formatNextSteps } from "./next-steps.js";
import type { NextStep } from "./next-steps.js";
import { applyWritePlan } from "./apply.js";

// -- Helpers --

/** Resolve the repo root from the current working directory. */
function findRepoRoot(): string {
  return process.cwd();
}

/** Map an AssistantHomeId to a human-readable label. */
function homeLabel(homeId: AssistantHomeId): string {
  const labels: Record<AssistantHomeId, string> = {
    "claude-home": "~/.claude",
    "codex-home": "~/.codex",
    "agents-home": "~/.agents",
  };
  return labels[homeId];
}

/** Map an AssistantTargetId to a human-readable label. */
function targetLabel(targetId: AssistantTargetId): string {
  const labels: Record<AssistantTargetId, string> = {
    "claude-code": "Claude Code",
    "codex-cli": "Codex CLI",
  };
  return labels[targetId];
}

/** Discover which .claude/ files exist and categorize them by component kind. */
async function discoverCanonicalFiles(
  repoRoot: string,
): Promise<PayloadFile[]> {
  const claudeDir = path.join(repoRoot, ".claude");
  const files: PayloadFile[] = [];

  // Map directories to component kinds
  const dirComponentMap: Record<string, ComponentKind> = {
    hooks: "hooks",
    commands: "commands",
    skills: "skills",
  };

  // Check for top-level instruction files
  for (const [filename, component] of [
    ["CLAUDE.md", "instructions"],
    ["PLAN.md", "plans"],
  ] as const) {
    const filePath = path.join(claudeDir, filename);
    try {
      await fs.access(filePath);
      files.push({
        relativePath: filename,
        sourcePath: filePath,
        component,
        origin: "canonical-source",
        executable: false,
      });
    } catch {
      // File doesn't exist — skip
    }
  }

  // Walk component directories
  for (const [dirName, component] of Object.entries(dirComponentMap)) {
    const dirPath = path.join(claudeDir, dirName);
    try {
      await fs.access(dirPath);
      const entries = await walkDir(dirPath);
      for (const entry of entries) {
        const relativePath = path.join(dirName, path.relative(dirPath, entry.path));
        files.push({
          relativePath,
          sourcePath: entry.path,
          component,
          origin: "canonical-source",
          executable: entry.executable,
        });
      }
    } catch {
      // Directory doesn't exist — skip
    }
  }

  return files;
}

/** Recursively walk a directory and return file entries. */
async function walkDir(
  dirPath: string,
): Promise<Array<{ path: string; executable: boolean }>> {
  const results: Array<{ path: string; executable: boolean }> = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const subResults = await walkDir(fullPath);
      results.push(...subResults);
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath);
      // Check if file is executable (owner execute bit)
      const executable = (stat.mode & 0o100) !== 0;
      results.push({ path: fullPath, executable });
    }
  }

  return results;
}

/** Discover skill directories for projection planning. */
async function discoverSkillDirs(
  repoRoot: string,
): Promise<Array<{ name: string; files: string[] }>> {
  const skillsDir = path.join(repoRoot, ".claude", "skills");
  const result: Array<{ name: string; files: string[] }> = [];

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(skillsDir, entry.name);
      const skillFiles = await fs.readdir(skillPath);
      result.push({
        name: entry.name,
        files: skillFiles.filter((f) => !f.startsWith(".")),
      });
    }
  } catch {
    // No skills directory
  }

  return result;
}

// -- Main orchestration --

/**
 * Run the Setup Wizard end to end.
 * Returns an exit code (0 = success, 1 = error).
 */
export async function runSetupWizard(
  argv: string[],
  _env?: Partial<NodeJS.ProcessEnv>,
): Promise<number> {
  try {
    // Parse CLI flags into a Setup Profile
    const profile = parseCliFlags(argv);
    const repoRoot = findRepoRoot();

    // Print header
    console.log("Assistant Setup Toolkit Setup Wizard");
    console.log(`Mode: ${profile.dryRun ? "dry-run" : "live"}`);
    console.log(`Setup Profile: ${profile.mode === "default" ? "Default Install" : "Custom Install"}`);
    console.log(`Write behavior: ${profile.writeBehavior === "safe-merge" ? "Safe Merge" : profile.writeBehavior === "overwrite" ? "Overwrite Install" : "Prune Install"}`);

    // Print Assistant Targets and Homes
    const homes = resolveAssistantHomes(profile.targets);
    console.log("Assistant Targets:");
    for (const target of profile.targets) {
      const targetHomes = resolveAssistantHomes([target]);
      const homeLabels = targetHomes.map(homeLabel).join(", ");
      console.log(`  - ${targetLabel(target)} -> ${homeLabels}`);
    }

    // Load Installation Manifest
    const manifestPath = path.join(repoRoot, "manifests", "install.yaml");
    let manifest;
    try {
      manifest = await loadInstallationManifest(manifestPath);
    } catch {
      console.log("Warning: Could not load manifests/install.yaml — continuing without External Sources.");
      manifest = { version: 1 as const, externalSources: [] };
    }

    // Print Fetch Step plan
    const mcpSources = manifest.externalSources.filter((s) => s.kind === "mcp-server");
    const fetchableSources = manifest.externalSources.filter((s) => s.kind !== "mcp-server" && s.default);
    console.log("Fetch Step:");
    for (const source of fetchableSources) {
      console.log(`  - ${source.id}: ${profile.dryRun ? "planned" : "fetching"}`);
    }
    for (const source of mcpSources) {
      const secretNote = source.requiredSecrets?.length
        ? `, requires ${source.requiredSecrets.join(", ")}`
        : "";
      console.log(`  - ${source.id}: next steps only${secretNote}`);
    }

    // Plan Target Projections if Codex is selected
    const hasCodex = profile.targets.includes("codex-cli");
    const projectionMappings: ProjectionMapping[] = [];
    if (hasCodex) {
      // Discover what's in .claude/ for projection planning
      const claudeFiles: string[] = [];
      for (const name of ["CLAUDE.md", "PLAN.md"]) {
        try {
          await fs.access(path.join(repoRoot, ".claude", name));
          claudeFiles.push(name);
        } catch {
          // skip
        }
      }
      const skillDirs = await discoverSkillDirs(repoRoot);
      const mappings = planCodexProjection({ claudeFiles, skillDirs });
      projectionMappings.push(...mappings);

      console.log("Target Projections:");
      for (const mapping of mappings) {
        console.log(`  - regenerate ${mapping.target} from .claude/${mapping.source}`);
      }
    }

    // Discover Canonical Assistant Source files
    const canonicalFiles = await discoverCanonicalFiles(repoRoot);

    // Build projection files for Codex targets
    const projectionFiles: PayloadFile[] = projectionMappings.map((m) => ({
      relativePath: m.target.replace(/^\.(codex|agents)\//, ""),
      sourcePath: path.join(repoRoot, m.target),
      component: m.target.includes("skills") ? ("skills" as const) : ("instructions" as const),
      origin: "target-projection" as const,
      executable: false,
    }));

    // Print payload precedence
    console.log("Payload precedence:");
    console.log("  - External Sources prepared first");
    console.log("  - Canonical Assistant Source applied last; local files win conflicts");

    // Build Assistant Payloads (external files empty for now — fetch not implemented)
    const payloadResult = buildAssistantPayloads({
      targets: [...profile.targets],
      components: [...profile.components],
      externalFiles: [],
      canonicalFiles,
      projectionFiles,
    });

    // Report conflicts if any
    if (payloadResult.conflicts.length > 0) {
      console.log("Conflicts resolved:");
      for (const conflict of payloadResult.conflicts) {
        console.log(`  - ${conflict.relativePath}: ${conflict.winner} wins over ${conflict.loser}`);
      }
    }

    // Plan writes for each Assistant Home
    const writePlans: WritePlan[] = [];
    console.log("Planned writes:");
    if (profile.dryRun) {
      console.log("  (dry-run — no files will be written)");
    }

    for (const payload of payloadResult.payloads) {
      const homePath = resolveAssistantHomePath(payload.homeId);

      // Check which files already exist in the target home
      let existingFiles: string[] = [];
      try {
        const allFiles = await walkDir(homePath);
        existingFiles = allFiles.map((f) => path.relative(homePath, f.path));
      } catch {
        // Home doesn't exist yet
      }

      const plan = planWrites({
        assistantHome: homePath,
        payloadFiles: payload.files,
        existingFiles,
        previousReceipt: null,
        writeBehavior: profile.writeBehavior,
        dryRun: profile.dryRun,
      });

      writePlans.push(plan);

      if (!profile.dryRun && plan.backupPath) {
        console.log(`  Backup: ${plan.backupPath}`);
      }

      for (const action of plan.actions) {
        if (action.action !== "skip") {
          console.log(`  [${action.action}] ${homeLabel(payload.homeId)}/${action.relativePath}`);
        }
      }
    }

    // Apply write plans (live mode) or skip (dry-run)
    if (!profile.dryRun) {
      console.log("Applying writes...");
      let totalWritten = 0;
      let totalSkipped = 0;
      let totalRemoved = 0;
      const allErrors: Array<{ home: string; relativePath: string; message: string }> = [];

      for (const payload of payloadResult.payloads) {
        const plan = writePlans.find(
          (p) => p.assistantHome === resolveAssistantHomePath(payload.homeId),
        );
        if (!plan) continue;

        const result = await applyWritePlan(plan, {
          assistantTarget: payload.target,
          mode: profile.mode,
          components: [...profile.components],
          writeBehavior: profile.writeBehavior,
        });

        totalWritten += result.filesWritten;
        totalSkipped += result.filesSkipped;
        totalRemoved += result.filesRemoved;

        for (const err of result.errors) {
          allErrors.push({
            home: homeLabel(payload.homeId),
            relativePath: err.relativePath,
            message: err.message,
          });
        }
      }

      console.log(`  ${totalWritten} file(s) written, ${totalSkipped} skipped, ${totalRemoved} removed`);

      if (allErrors.length > 0) {
        console.error("Errors during apply:");
        for (const err of allErrors) {
          console.error(`  ${err.home}/${err.relativePath}: ${err.message}`);
        }
        return 1;
      }
    }

    // Verification Step
    const verificationResult = planVerificationChecks(writePlans, profile.dryRun);
    console.log("Verification Step:");
    for (const line of formatVerificationResult(verificationResult)) {
      console.log(line);
    }

    // Next Steps
    const mcpSteps = planMcpNextSteps(manifest.externalSources);
    const standardSteps = buildStandardNextSteps(false);
    const allNextSteps: NextStep[] = [...standardSteps, ...mcpSteps];
    console.log("Next Steps:");
    for (const line of formatNextSteps(allNextSteps)) {
      console.log(line);
    }

    // Footer
    if (profile.dryRun) {
      console.log("\nDry-run complete. No files were written.");
    } else {
      console.log("\nSetup complete.");
    }

    return 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    return 1;
  }
}
