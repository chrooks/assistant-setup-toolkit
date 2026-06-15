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
import { tryParseCliFlags } from "./cli.js";
import { runInteractivePrompts } from "./prompts.js";
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
import {
  buildStandardNextSteps,
  formatNextStepsSection,
  planInstallCommandNextSteps,
} from "./next-steps.js";
import type { NextStep } from "./next-steps.js";
import { applyWritePlan } from "./apply.js";
import {
  loadWiringManifest,
  planHookWiring,
  applyHookWiring,
} from "./hook-wiring.js";
import { planSkillArtifacts, createSkillArtifacts } from "./artifacts.js";
import type { PlannedArtifact } from "./artifacts.js";
import { planExternalFetches } from "./external-sources.js";
import { fetchPlannedSources } from "./external-fetcher.js";
import os from "node:os";

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

/** Discover which canonical/ files exist and categorize them by component kind. */
async function discoverCanonicalFiles(
  repoRoot: string,
): Promise<PayloadFile[]> {
  const canonicalDir = path.join(repoRoot, "canonical");
  const files: PayloadFile[] = [];

  // Map directories to component kinds
  const dirComponentMap: Record<string, ComponentKind> = {
    hooks: "hooks",
    commands: "commands",
    skills: "skills",
    rules: "rules",
  };

  // Check for top-level instruction files
  for (const [filename, component] of [
    ["CLAUDE.md", "instructions"],
    ["CONTEXT.md", "instructions"],
    ["PLAN.md", "plans"],
  ] as const) {
    const filePath = path.join(canonicalDir, filename);
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
    const dirPath = path.join(canonicalDir, dirName);
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

/** Discover skill directories for projection planning and artifact generation. */
export async function discoverSkillDirs(
  repoRoot: string,
): Promise<Array<{ name: string; files: string[]; sourceDir: string }>> {
  const skillsDir = path.join(repoRoot, "canonical", "skills");
  const result: Array<{ name: string; files: string[]; sourceDir: string }> = [];

  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(skillsDir, entry.name);
      const skillFiles = (await walkDir(skillPath))
        .map((file) => path.relative(skillPath, file.path))
        .filter((file) => !file.split(path.sep).some((part) => part.startsWith(".")))
        .sort();
      result.push({
        name: entry.name,
        files: skillFiles,
        sourceDir: skillPath,
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
    // Parse CLI flags — fall through to interactive prompts if insufficient
    const parseResult = tryParseCliFlags(argv);
    const repoRoot = findRepoRoot();

    // Load Installation Manifest early so the interactive prompt can offer
    // External Sources to pick from. Failures here should not abort setup;
    // we fall back to an empty manifest and continue.
    const manifestPath = path.join(repoRoot, "manifests", "install.yaml");
    let manifest;
    try {
      manifest = await loadInstallationManifest(manifestPath);
    } catch {
      console.log("Warning: Could not load manifests/install.yaml — continuing without External Sources.");
      manifest = { version: 1 as const, externalSources: [] };
    }

    let profile;
    if (parseResult.kind === "profile") {
      profile = parseResult.profile;
    } else {
      // Interactive mode — prompt for missing selections, including External Sources
      profile = await runInteractivePrompts(
        parseResult.partial,
        manifest.externalSources,
      );
    }

    // Quiet mode suppresses informational output; errors always print.
    const log = profile.quiet
      ? (..._args: unknown[]) => {}
      : (...args: unknown[]) => console.log(...args);

    // Print header
    log("\nAssistant Setup Toolkit Setup Wizard");
    log(`Mode: ${profile.dryRun ? "dry-run" : "live"}`);
    log(`Setup Profile: ${profile.mode === "default" ? "Default Install" : "Custom Install"}`);
    log(`Write behavior: ${profile.writeBehavior === "safe-merge" ? "Safe Merge" : profile.writeBehavior === "overwrite" ? "Overwrite Install" : "Prune Install"}`);

    // Print Assistant Targets and Homes
    const homes = resolveAssistantHomes(profile.targets);
    log("Assistant Targets:");
    for (const target of profile.targets) {
      const targetHomes = resolveAssistantHomes([target]);
      const homeLabels = targetHomes.map(homeLabel).join(", ");
      log(`  - ${targetLabel(target)} -> ${homeLabels}`);
    }

    // Plan External Source fetches based on profile + manifest. Selection comes
    // from `selectedExternalSourceIds` (interactive picker or --sources flag);
    // when absent, falls back to manifest defaults. MCP sources always skipped
    // here — they're surfaced through Next Steps below.
    const fetchPlan = planExternalFetches(manifest.externalSources, {
      targets: profile.targets,
      fetch: profile.fetch,
      selectedIds: profile.selectedExternalSourceIds,
    });
    const mcpSources = manifest.externalSources.filter(
      (s) => s.kind === "mcp-server",
    );

    log("Fetch Step:");
    for (const planned of fetchPlan.planned) {
      log(`  - ${planned.id}: ${profile.dryRun ? "planned" : "queued"}`);
    }
    for (const skipped of fetchPlan.skipped) {
      // MCP entries get a special note about required secrets.
      const mcp = mcpSources.find((m) => m.id === skipped.id);
      if (mcp) {
        const secretNote = mcp.requiredSecrets?.length
          ? `, requires ${mcp.requiredSecrets.join(", ")}`
          : "";
        log(`  - ${skipped.id}: next steps only${secretNote}`);
      } else {
        log(`  - ${skipped.id}: skipped (${skipped.reason})`);
      }
    }

    // Resolve which ExternalSource objects correspond to the planned IDs so we
    // can hand them to the fetcher, which needs full source records (kind etc.).
    const plannedSources = manifest.externalSources.filter((s) =>
      fetchPlan.planned.some((p) => p.id === s.id),
    );

    // Per-run working dir — cleaned up in the `finally` block at the bottom.
    let externalWorkDir: string | null = null;
    let externalFiles: PayloadFile[] = [];
    // Wrap rest of the run so we can always reclaim the temp clone dir.
    try {
    if (!profile.dryRun && plannedSources.length > 0) {
      externalWorkDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "assistant-setup-toolkit-"),
      );
      const fetchResult = await fetchPlannedSources(
        plannedSources,
        externalWorkDir,
      );
      externalFiles = [...fetchResult.files];
      // Print per-source outcome — `[fetched]` or `[failed]` so the user can
      // see which clones succeeded before any writes happen.
      for (const r of fetchResult.results) {
        if (r.error) {
          console.error(`  [failed] ${r.sourceId}: ${r.error}`);
        } else {
          log(`  [fetched] ${r.sourceId} (${r.files.length} file(s))`);
        }
      }
    }

    // Plan and regenerate Target Projections if Codex is selected
    const hasCodex = profile.targets.includes("codex-cli");
    const projectionMappings: ProjectionMapping[] = [];
    if (hasCodex) {
      // Discover what's in canonical/ for projection planning
      const claudeFiles: string[] = [];
      for (const name of ["CLAUDE.md", "CONTEXT.md", "PLAN.md"]) {
        try {
          await fs.access(path.join(repoRoot, "canonical", name));
          claudeFiles.push(name);
        } catch {
          // skip
        }
      }
      const skillDirs = await discoverSkillDirs(repoRoot);
      // Discover hook scripts under canonical/hooks/ for 1:1 projection to .codex/hooks/
      const hookFiles: string[] = [];
      const canonicalHooksDir = path.join(repoRoot, "canonical", "hooks");
      try {
        const entries = await fs.readdir(canonicalHooksDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) hookFiles.push(entry.name);
        }
      } catch {
        // canonical/hooks/ doesn't exist — skip
      }
      // Discover rule files under canonical/rules/ for projection to .codex/rules/
      const ruleFiles: string[] = [];
      const canonicalRulesDir = path.join(repoRoot, "canonical", "rules");
      try {
        const entries = await walkDir(canonicalRulesDir);
        for (const entry of entries) {
          ruleFiles.push(path.relative(canonicalRulesDir, entry.path));
        }
      } catch {
        // canonical/rules/ doesn't exist — skip
      }
      const mappings = planCodexProjection({ claudeFiles, skillDirs, hookFiles, ruleFiles });
      projectionMappings.push(...mappings);

      log("Target Projections:");
      for (const mapping of mappings) {
        log(`  - regenerate ${mapping.target} from canonical/${mapping.source}`);
      }

      // Actually regenerate Target Projections in-repo before using as payload sources.
      // Read each canonical/ source, rewrite content for Codex (markdown only),
      // write to .codex/.agents/. Hook scripts are copied verbatim — text rewrites
      // could mangle shell logic that legitimately references either path.
      for (const mapping of mappings) {
        const sourcePath = path.join(repoRoot, "canonical", mapping.source);
        const targetPath = path.join(repoRoot, mapping.target);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        if (mapping.isHook) {
          await fs.copyFile(sourcePath, targetPath);
        } else {
          const sourceContent = await fs.readFile(sourcePath, "utf-8");
          const rewritten = rewriteContentForCodex(sourceContent, mapping.isSkill);
          await fs.writeFile(targetPath, rewritten, "utf-8");
        }
      }
    }

    // Discover Canonical Assistant Source files
    const canonicalFiles = await discoverCanonicalFiles(repoRoot);

    // Build projection files for Codex targets — now pointing at freshly regenerated files.
    // Tag the right component so payload routing sends each file to the right home:
    //   hooks   → ~/.codex/hooks/   (codex-home)
    //   skills  → ~/.agents/skills/ (agents-home)
    //   default → ~/.codex/         (codex-home)
    const projectionFiles: PayloadFile[] = projectionMappings.map((m) => {
      const component: ComponentKind = m.isHook
        ? "hooks"
        : m.target.includes("skills")
          ? "skills"
          : m.target.startsWith(".codex/rules/")
            ? "rules"
            : "instructions";
      return {
        relativePath: m.target.replace(/^\.(codex|agents)\//, ""),
        sourcePath: path.join(repoRoot, m.target),
        component,
        origin: "target-projection" as const,
        // Hook scripts must keep their executable bit when projected. fs.copyFile
        // already preserves mode, but the receipt records this metadata.
        executable: m.isHook,
      };
    });

    // Print payload precedence
    log("Payload precedence:");
    log("  - External Sources prepared first");
    log("  - Canonical Assistant Source applied last; local files win conflicts");

    // Build Assistant Payloads — external files come from the fetcher above
    // (empty array on dry-run or when no sources were selected).
    const payloadResult = buildAssistantPayloads({
      targets: [...profile.targets],
      components: [...profile.components],
      externalFiles,
      canonicalFiles,
      projectionFiles,
    });

    // Report conflicts if any
    if (payloadResult.conflicts.length > 0) {
      log("Conflicts resolved:");
      for (const conflict of payloadResult.conflicts) {
        log(`  - ${conflict.relativePath}: ${conflict.winner} wins over ${conflict.loser}`);
      }
    }

    // Plan writes for each Assistant Home
    const writePlans: WritePlan[] = [];
    log("Planned writes:");
    if (profile.dryRun) {
      log("  (dry-run — no files will be written)");
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
        log(`  Backup: ${plan.backupPath}`);
      }

      for (const action of plan.actions) {
        if (action.action !== "skip") {
          log(`  [${action.action}] ${homeLabel(payload.homeId)}/${action.relativePath}`);
        }
      }
    }

    // Apply write plans (live mode) or skip (dry-run)
    if (!profile.dryRun) {
      log("Applying writes...");
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

      log(`  ${totalWritten} file(s) written, ${totalSkipped} skipped, ${totalRemoved} removed`);

      if (allErrors.length > 0) {
        console.error("Errors during apply:");
        for (const err of allErrors) {
          console.error(`  ${err.home}/${err.relativePath}: ${err.message}`);
        }
        return 1;
      }
    }

    // Hook Wiring — declarative manifest-driven registration of hook scripts
    // into the right Assistant settings file. Reads canonical/hooks/wiring.yaml;
    // returns silently when the manifest is absent, so toolkits without it
    // continue to install cleanly. Idempotent: re-running never duplicates.
    //
    // Runs in both live and dry-run modes — dry-run reports the would-add/
    // would-skip counts without touching the filesystem.
    {
      const canonicalHooksDir = path.join(repoRoot, "canonical", "hooks");
      const wiringEntries = await loadWiringManifest(canonicalHooksDir);
      if (wiringEntries.length > 0) {
        const homesByTarget: Partial<Record<AssistantTargetId, string>> = {};
        for (const target of profile.targets) {
          const homeId: AssistantHomeId =
            target === "claude-code" ? "claude-home" : "codex-home";
          homesByTarget[target] = resolveAssistantHomePath(homeId);
        }

        const wiringPlans = planHookWiring(wiringEntries, homesByTarget, {
          projectRoot: repoRoot,
        });
        if (wiringPlans.length > 0) {
          log("Hook Wiring:");
          for (const plan of wiringPlans) {
            const result = await applyHookWiring(plan, {
              dryRun: profile.dryRun,
            });
            const verbAdd = profile.dryRun ? "would add" : "added";
            const verbSkip = profile.dryRun
              ? "would skip"
              : "already present";
            const flagSuffix = plan.featureFlag
              ? ` (${plan.featureFlag.key} flag: ${
                  result.flagAdded
                    ? profile.dryRun
                      ? "would set"
                      : "set"
                    : "already present"
                })`
              : "";
            log(
              `  [${plan.target}] ${result.added} ${verbAdd}, ${result.alreadyPresent} ${verbSkip}${flagSuffix}`,
            );
          }
        }
      }
    }

    // Skill Artifact generation — plan and create ZIPs for desktop/web upload
    const skillDirs = await discoverSkillDirs(repoRoot);
    const artifactsDir = path.join(repoRoot, "artifacts");
    const plannedArtifacts = planSkillArtifacts({ skillDirs, artifactsDir });
    let hasSkillArtifacts = false;

    if (plannedArtifacts.length > 0) {
      if (profile.dryRun) {
        log("Skill Artifacts (dry-run):");
        for (const artifact of plannedArtifacts) {
          log(`  [planned] ${artifact.skillName}.zip (${artifact.sourceFiles.length} file(s))`);
        }
        hasSkillArtifacts = true;
      } else {
        log("Skill Artifacts:");
        const artifactResult = await createSkillArtifacts(plannedArtifacts);

        for (const zipPath of artifactResult.created) {
          log(`  [created] ${path.basename(zipPath)}`);
        }
        for (const err of artifactResult.errors) {
          console.error(`  [error] ${err.skillName}: ${err.message}`);
        }

        hasSkillArtifacts = artifactResult.created.length > 0;
      }
    }

    // Verification Step
    const verificationResult = planVerificationChecks(writePlans, profile.dryRun);
    log("Verification Step:");
    for (const line of formatVerificationResult(verificationResult)) {
      log(line);
    }

    // Next Steps
    const installCommandSteps = planInstallCommandNextSteps({
      sources: manifest.externalSources,
      selectedSourceIds: fetchPlan.planned.map((source) => source.id),
      targets: profile.targets,
    });
    const mcpSteps = planMcpNextSteps(manifest.externalSources);
    const standardSteps = buildStandardNextSteps(hasSkillArtifacts);
    const allNextSteps: NextStep[] = [
      ...installCommandSteps,
      ...standardSteps,
      ...mcpSteps,
    ];
    for (const line of formatNextStepsSection(allNextSteps)) {
      log(line);
    }

    // Footer
    if (profile.dryRun) {
      log("\nDry-run complete. No files were written.");
    } else {
      log("\nSetup complete.");
    }

    return 0;
    } finally {
      // Always reclaim the per-run External Source clone dir, even on error.
      if (externalWorkDir) {
        await fs.rm(externalWorkDir, { recursive: true, force: true });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    return 1;
  }
}
