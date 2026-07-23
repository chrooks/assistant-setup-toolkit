import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createDefaultSetupProfile, resolveAssistantHomes } from "../../src/setup/domain.js";
import type { PayloadFile } from "../../src/setup/domain.js";
import { resolveAssistantHomePath, resolveReceiptPath } from "../../src/setup/paths.js";
import { buildAssistantPayloads } from "../../src/setup/payload.js";
import { planWrites } from "../../src/setup/write-plan.js";
import { planCodexProjection } from "../../src/setup/projection.js";
import { discoverSkillDirs } from "../../src/setup/index.js";

// Temporary directory for fake homes — cleaned up after each test
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "setup-wizard-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Create a file in the fake home, including parent directories. */
async function writeFile(relativePath: string, content: string): Promise<void> {
  const fullPath = path.join(tmpDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

/** Check if a file exists in the fake home. */
async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(tmpDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe("integration", () => {
  describe("Claude Code Default Install dry-run", () => {
    it("plans writes for Claude payload files into fake home", () => {
      const profile = createDefaultSetupProfile(["claude-code"]);
      const fakeClaudeHome = resolveAssistantHomePath("claude-home", tmpDir);

      const canonicalFiles: PayloadFile[] = [
        {
          relativePath: "CLAUDE.md",
          sourcePath: "/repo/canonical/CLAUDE.md",
          component: "instructions",
          origin: "canonical-source",
          executable: false,
        },
        {
          relativePath: "skills/commit/SKILL.md",
          sourcePath: "/repo/canonical/skills/commit/SKILL.md",
          component: "skills",
          origin: "canonical-source",
          executable: false,
        },
      ];

      const result = buildAssistantPayloads({
        targets: [...profile.targets],
        components: [...profile.components],
        externalFiles: [],
        canonicalFiles,
        projectionFiles: [],
      });

      const claudePayload = result.payloads.find((p) => p.homeId === "claude-home")!;
      expect(claudePayload.files).toHaveLength(2);

      // Plan writes against empty fake home
      const plan = planWrites({
        assistantHome: fakeClaudeHome,
        payloadFiles: claudePayload.files,
        existingFiles: [],
        previousReceipt: null,
        writeBehavior: profile.writeBehavior,
        dryRun: true,
      });

      // All files should be copies (nothing exists yet)
      expect(plan.actions.every((a) => a.action === "copy")).toBe(true);
      expect(plan.actions).toHaveLength(2);
      // Dry-run should not plan a backup
      expect(plan.backupPath).toBeNull();
    });
  });

  describe("Codex CLI Default Install with projections", () => {
    it("includes projected AGENTS.md in codex-home payload", () => {
      const projectionMappings = planCodexProjection({
        claudeFiles: ["CLAUDE.md", "PLAN.md"],
        skillDirs: [{ name: "commit", files: ["SKILL.md"] }],
      });

      // Verify projection mappings
      expect(projectionMappings).toHaveLength(3);
      expect(projectionMappings[0].target).toBe(".codex/AGENTS.md");
      expect(projectionMappings[1].target).toBe(".codex/PLAN.md");
      expect(projectionMappings[2].target).toBe(".agents/skills/commit/SKILL.md");

      // Build projection payload files
      const projectionFiles: PayloadFile[] = [
        {
          relativePath: "AGENTS.md",
          sourcePath: "/repo/.codex/AGENTS.md",
          component: "instructions",
          origin: "target-projection",
          executable: false,
        },
        {
          relativePath: "PLAN.md",
          sourcePath: "/repo/.codex/PLAN.md",
          component: "plans",
          origin: "target-projection",
          executable: false,
        },
        {
          relativePath: "skills/commit/SKILL.md",
          sourcePath: "/repo/.agents/skills/commit/SKILL.md",
          component: "skills",
          origin: "target-projection",
          executable: false,
        },
      ];

      const result = buildAssistantPayloads({
        targets: ["codex-cli"],
        components: ["instructions", "plans", "skills"],
        externalFiles: [],
        canonicalFiles: [],
        projectionFiles,
      });

      // codex-home should get AGENTS.md and PLAN.md
      const codexPayload = result.payloads.find((p) => p.homeId === "codex-home")!;
      const codexPaths = codexPayload.files.map((f) => f.relativePath);
      expect(codexPaths).toContain("AGENTS.md");
      expect(codexPaths).toContain("PLAN.md");

      // agents-home should get skills
      const agentsPayload = result.payloads.find((p) => p.homeId === "agents-home")!;
      const agentsPaths = agentsPayload.files.map((f) => f.relativePath);
      expect(agentsPaths).toContain("skills/commit/SKILL.md");
    });

    it("discovers machine-scoped skills nested under skills/machines/<machine>/<skill>/", async () => {
      await writeFile("canonical/skills/commit/SKILL.md", "# Commit");
      await writeFile("canonical/skills/machines/hestia/deploy/SKILL.md", "# Deploy");
      // A machine dir with no skill subdirectories yet (e.g. work/ holding only
      // a .gitkeep so it survives on clone) must not blow up discovery.
      await writeFile("canonical/skills/machines/work/.gitkeep", "");

      const skillDirs = await discoverSkillDirs(tmpDir);
      const names = skillDirs.map((d) => d.name).sort();

      expect(names).toEqual(["commit", "machines/hestia/deploy"]);
      const deploy = skillDirs.find((d) => d.name === "machines/hestia/deploy")!;
      expect(deploy.files).toEqual(["SKILL.md"]);
    });

    it("projects a machine-scoped skill to Codex and gates it by the machine Variant", () => {
      const projectionMappings = planCodexProjection({
        claudeFiles: [],
        skillDirs: [{ name: "machines/hestia/deploy", files: ["SKILL.md"] }],
      });

      expect(projectionMappings).toHaveLength(1);
      expect(projectionMappings[0].target).toBe(
        ".agents/skills/machines/hestia/deploy/SKILL.md",
      );

      // Mirror index.ts's projectionFiles transform: strip the .codex/.agents
      // prefix, tag component "skills".
      const projectionFiles: PayloadFile[] = projectionMappings.map((m) => ({
        relativePath: m.target.replace(/^\.(codex|agents)\//, ""),
        sourcePath: `/repo/.setup/projections/${m.target}`,
        component: "skills",
        origin: "target-projection",
        executable: false,
      }));

      const matching = buildAssistantPayloads({
        targets: ["codex-cli"],
        components: ["skills"],
        externalFiles: [],
        canonicalFiles: [],
        projectionFiles,
        variants: { machine: "hestia" },
      });
      const matchingPaths = matching.payloads
        .find((p) => p.homeId === "agents-home")!
        .files.map((f) => f.relativePath);
      expect(matchingPaths).toEqual(["skills/deploy/SKILL.md"]);

      const otherMachine = buildAssistantPayloads({
        targets: ["codex-cli"],
        components: ["skills"],
        externalFiles: [],
        canonicalFiles: [],
        projectionFiles,
        variants: { machine: "work" },
      });
      const otherPaths = otherMachine.payloads
        .find((p) => p.homeId === "agents-home")!
        .files.map((f) => f.relativePath);
      expect(otherPaths).toEqual([]);
    });
  });

  describe("Safe Merge preserves existing user files", () => {
    it("skips files that already exist in the Assistant Home", async () => {
      const fakeClaudeHome = resolveAssistantHomePath("claude-home", tmpDir);

      // Pre-populate a file in the fake home
      await writeFile(".claude/CLAUDE.md", "user's custom content");

      const plan = planWrites({
        assistantHome: fakeClaudeHome,
        payloadFiles: [
          {
            relativePath: "CLAUDE.md",
            sourcePath: "/repo/canonical/CLAUDE.md",
            component: "instructions",
            origin: "canonical-source",
            executable: false,
          },
          {
            relativePath: "skills/new/SKILL.md",
            sourcePath: "/repo/canonical/skills/new/SKILL.md",
            component: "skills",
            origin: "canonical-source",
            executable: false,
          },
        ],
        existingFiles: ["CLAUDE.md"],
        previousReceipt: null,
        writeBehavior: "safe-merge",
        dryRun: false,
      });

      // Existing CLAUDE.md should be skipped
      const skipped = plan.actions.filter((a) => a.action === "skip");
      expect(skipped).toHaveLength(1);
      expect(skipped[0].relativePath).toBe("CLAUDE.md");

      // New skill should be copied
      const copies = plan.actions.filter((a) => a.action === "copy");
      expect(copies).toHaveLength(1);
      expect(copies[0].relativePath).toBe("skills/new/SKILL.md");
    });
  });

  describe("Overwrite Install replaces conflicts", () => {
    it("plans overwrite for existing files", () => {
      const fakeClaudeHome = resolveAssistantHomePath("claude-home", tmpDir);

      const plan = planWrites({
        assistantHome: fakeClaudeHome,
        payloadFiles: [
          {
            relativePath: "CLAUDE.md",
            sourcePath: "/repo/canonical/CLAUDE.md",
            component: "instructions",
            origin: "canonical-source",
            executable: false,
          },
        ],
        existingFiles: ["CLAUDE.md"],
        previousReceipt: null,
        writeBehavior: "overwrite",
        dryRun: false,
      });

      expect(plan.actions[0].action).toBe("overwrite");
      expect(plan.backupPath).toBeTruthy();
    });
  });

  describe("Prune Install removes stale receipt-owned files", () => {
    it("removes files from previous receipt absent from new payload", () => {
      const fakeClaudeHome = resolveAssistantHomePath("claude-home", tmpDir);

      const plan = planWrites({
        assistantHome: fakeClaudeHome,
        payloadFiles: [
          {
            relativePath: "skills/kept/SKILL.md",
            sourcePath: "/repo/canonical/skills/kept/SKILL.md",
            component: "skills",
            origin: "canonical-source",
            executable: false,
          },
        ],
        existingFiles: ["skills/old/SKILL.md", "skills/kept/SKILL.md"],
        previousReceipt: {
          schemaVersion: 1,
          toolkit: "code-assistant-context",
          installedAt: "2026-05-05T00:00:00.000Z",
          assistantTarget: "claude-code",
          assistantHome: fakeClaudeHome,
          setupProfile: {
            mode: "default",
            components: ["skills"],
            writeBehavior: "safe-merge",
          },
          files: ["skills/old/SKILL.md", "skills/kept/SKILL.md"],
        },
        writeBehavior: "prune",
        dryRun: false,
      });

      const removes = plan.actions.filter((a) => a.action === "remove");
      expect(removes).toHaveLength(1);
      expect(removes[0].relativePath).toBe("skills/old/SKILL.md");
    });
  });

  describe("Local wins over external in payload", () => {
    it("canonical source file overrides external source for same path", () => {
      const result = buildAssistantPayloads({
        targets: ["claude-code"],
        components: ["skills"],
        externalFiles: [
          {
            relativePath: "skills/feature/SKILL.md",
            sourcePath: "/tmp/external/skills/feature/SKILL.md",
            component: "skills",
            origin: "external-source",
            executable: false,
          },
        ],
        canonicalFiles: [
          {
            relativePath: "skills/feature/SKILL.md",
            sourcePath: "/repo/canonical/skills/feature/SKILL.md",
            component: "skills",
            origin: "canonical-source",
            executable: false,
          },
        ],
        projectionFiles: [],
      });

      const claudePayload = result.payloads.find((p) => p.homeId === "claude-home")!;
      const feature = claudePayload.files.find(
        (f) => f.relativePath === "skills/feature/SKILL.md",
      )!;

      // Local canonical source wins
      expect(feature.origin).toBe("canonical-source");
      expect(feature.sourcePath).toBe("/repo/canonical/skills/feature/SKILL.md");

      // Conflict recorded
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].winner).toBe("canonical-source");
      expect(result.conflicts[0].loser).toBe("external-source");
    });
  });
});
