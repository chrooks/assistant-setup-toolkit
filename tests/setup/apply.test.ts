import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { applyWritePlan, readInstallReceipt } from "../../src/setup/apply.js";
import type { WritePlan } from "../../src/setup/write-plan.js";

// Temporary directories for source files and target home
let tmpDir: string;
let sourceDir: string;
let homeDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "apply-test-"));
  sourceDir = path.join(tmpDir, "source");
  homeDir = path.join(tmpDir, "home");
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(homeDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Write a file in the source directory. */
async function writeSource(relativePath: string, content: string): Promise<string> {
  const fullPath = path.join(sourceDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
  return fullPath;
}

/** Write a file in the home directory. */
async function writeHome(relativePath: string, content: string): Promise<void> {
  const fullPath = path.join(homeDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

/** Read a file from the home directory. */
async function readHome(relativePath: string): Promise<string> {
  return fs.readFile(path.join(homeDir, relativePath), "utf-8");
}

/** Check if a file exists in the home directory. */
async function existsInHome(relativePath: string): Promise<boolean> {
  try {
    await fs.access(path.join(homeDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

describe("apply", () => {
  describe("applyWritePlan", () => {
    it("copies new files into the Assistant Home", async () => {
      const sourcePath = await writeSource("CLAUDE.md", "# Instructions");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "safe-merge",
        dryRun: false,
        backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "test"),
        actions: [
          { relativePath: "CLAUDE.md", action: "copy", sourcePath },
        ],
        warnings: [],
      };

      const result = await applyWritePlan(plan);

      expect(result.filesWritten).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(await readHome("CLAUDE.md")).toBe("# Instructions");
    });

    it("overwrites existing files when action is overwrite", async () => {
      await writeHome("CLAUDE.md", "old content");
      const sourcePath = await writeSource("CLAUDE.md", "new content");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "overwrite",
        dryRun: false,
        backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "test"),
        actions: [
          { relativePath: "CLAUDE.md", action: "overwrite", sourcePath },
        ],
        warnings: [],
      };

      const result = await applyWritePlan(plan);

      expect(result.filesWritten).toBe(1);
      expect(await readHome("CLAUDE.md")).toBe("new content");
    });

    it("creates a backup before writing", async () => {
      await writeHome("CLAUDE.md", "original");
      const sourcePath = await writeSource("CLAUDE.md", "replacement");
      const backupPath = path.join(homeDir, ".assistant-setup-toolkit", "backups", "test");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "overwrite",
        dryRun: false,
        backupPath,
        actions: [
          { relativePath: "CLAUDE.md", action: "overwrite", sourcePath },
        ],
        warnings: [],
      };

      await applyWritePlan(plan);

      // Backup of original should exist
      const backedUp = await fs.readFile(path.join(backupPath, "CLAUDE.md"), "utf-8");
      expect(backedUp).toBe("original");
    });

    it("removes files when action is remove", async () => {
      await writeHome("skills/old/SKILL.md", "stale skill");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "prune",
        dryRun: false,
        backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "test"),
        actions: [
          { relativePath: "skills/old/SKILL.md", action: "remove", sourcePath: null },
        ],
        warnings: [],
      };

      const result = await applyWritePlan(plan);

      expect(result.filesRemoved).toBe(1);
      expect(await existsInHome("skills/old/SKILL.md")).toBe(false);
    });

    it("backs up files before removing them", async () => {
      await writeHome("skills/old/SKILL.md", "to be pruned");
      const backupPath = path.join(homeDir, ".assistant-setup-toolkit", "backups", "test");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "prune",
        dryRun: false,
        backupPath,
        actions: [
          { relativePath: "skills/old/SKILL.md", action: "remove", sourcePath: null },
        ],
        warnings: [],
      };

      await applyWritePlan(plan);

      const backedUp = await fs.readFile(
        path.join(backupPath, "skills/old/SKILL.md"),
        "utf-8",
      );
      expect(backedUp).toBe("to be pruned");
    });

    it("skips files with skip action", async () => {
      await writeHome("CLAUDE.md", "user content");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "safe-merge",
        dryRun: false,
        backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "test"),
        actions: [
          { relativePath: "CLAUDE.md", action: "skip", sourcePath: null },
        ],
        warnings: [],
      };

      const result = await applyWritePlan(plan);

      expect(result.filesWritten).toBe(0);
      expect(result.filesSkipped).toBe(1);
      // Content unchanged
      expect(await readHome("CLAUDE.md")).toBe("user content");
    });

    it("does nothing for dry-run plans", async () => {
      const sourcePath = await writeSource("CLAUDE.md", "should not appear");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "safe-merge",
        dryRun: true,
        backupPath: null,
        actions: [
          { relativePath: "CLAUDE.md", action: "copy", sourcePath },
        ],
        warnings: [],
      };

      const result = await applyWritePlan(plan);

      expect(result.filesWritten).toBe(0);
      expect(result.dryRun).toBe(true);
      expect(await existsInHome("CLAUDE.md")).toBe(false);
    });

    it("writes an Install Receipt after successful apply", async () => {
      const sourcePath = await writeSource("CLAUDE.md", "# Instructions");

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "safe-merge",
        dryRun: false,
        backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "test"),
        actions: [
          { relativePath: "CLAUDE.md", action: "copy", sourcePath },
        ],
        warnings: [],
      };

      const result = await applyWritePlan(plan, {
        assistantTarget: "claude-code",
        mode: "default",
        components: ["instructions"],
        writeBehavior: "safe-merge",
        variants: { "visual-plans": "self-hosted" },
        preset: "personal",
      });

      // Receipt should exist
      const receiptPath = path.join(homeDir, ".assistant-setup-toolkit", "receipt.json");
      const receiptRaw = await fs.readFile(receiptPath, "utf-8");
      const receipt = JSON.parse(receiptRaw);
      expect(receipt.schemaVersion).toBe(2);
      expect(receipt.toolkit).toBe("code-assistant-context");
      expect(receipt.assistantTarget).toBe("claude-code");
      expect(receipt.files).toContain("CLAUDE.md");
      expect(receipt.ownedFiles).toContain("CLAUDE.md");
      expect(receipt.setupProfile.variants).toEqual({
        "visual-plans": "self-hosted",
      });

      // Rehydration: the recorded Variant and Preset read back for later runs
      const readBack = await readInstallReceipt(homeDir);
      expect(readBack?.setupProfile.variants?.["visual-plans"]).toBe(
        "self-hosted",
      );
      expect(readBack?.setupProfile.preset).toBe("personal");
    });

    it("carries ownership forward so a file dropped from the payload stays prunable", async () => {
      const receiptOptions = {
        assistantTarget: "claude-code" as const,
        mode: "default" as const,
        components: ["instructions" as const],
        writeBehavior: "safe-merge" as const,
        variants: {},
      };
      const basePlan = {
        assistantHome: homeDir,
        writeBehavior: "safe-merge" as const,
        dryRun: false,
        backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "test"),
        warnings: [],
      };

      // Run 1 installs two skills.
      const oldSkill = await writeSource("skills/teach/SKILL.md", "# teach");
      const keptSkill = await writeSource("skills/kept/SKILL.md", "# kept");
      await applyWritePlan(
        {
          ...basePlan,
          actions: [
            { relativePath: "skills/teach/SKILL.md", action: "copy", sourcePath: oldSkill },
            { relativePath: "skills/kept/SKILL.md", action: "copy", sourcePath: keptSkill },
          ],
        },
        receiptOptions,
      );

      // Run 2 drops teach from the payload entirely — the old receipt shape
      // forgot it here, which is exactly what made it unprunable.
      await applyWritePlan(
        {
          ...basePlan,
          actions: [
            { relativePath: "skills/kept/SKILL.md", action: "overwrite", sourcePath: keptSkill },
          ],
        },
        receiptOptions,
      );

      const receipt = await readInstallReceipt(homeDir);
      expect(receipt?.files).not.toContain("skills/teach/SKILL.md");
      expect(receipt?.ownedFiles).toContain("skills/teach/SKILL.md");
    });

    it("removes the directory a pruned file leaves empty, but keeps populated ones", async () => {
      const goneSource = await writeSource("skills/gone/SKILL.md", "# gone");
      const siblingSource = await writeSource("skills/shared/other.md", "# other");
      await applyWritePlan({
        assistantHome: homeDir,
        writeBehavior: "overwrite",
        dryRun: false,
        backupPath: null,
        actions: [
          { relativePath: "skills/gone/SKILL.md", action: "copy", sourcePath: goneSource },
          { relativePath: "skills/shared/SKILL.md", action: "copy", sourcePath: goneSource },
          { relativePath: "skills/shared/other.md", action: "copy", sourcePath: siblingSource },
        ],
        warnings: [],
      });

      await applyWritePlan({
        assistantHome: homeDir,
        writeBehavior: "prune",
        dryRun: false,
        backupPath: null,
        actions: [
          { relativePath: "skills/gone/SKILL.md", action: "remove", sourcePath: null },
          { relativePath: "skills/shared/SKILL.md", action: "remove", sourcePath: null },
        ],
        warnings: [],
      });

      // Emptied by the prune — the husk goes too.
      expect(await existsInHome("skills/gone")).toBe(false);
      // Still holds a file — must survive.
      expect(await existsInHome("skills/shared/other.md")).toBe(true);
      // Never walks past the Assistant Home itself.
      expect(await existsInHome("skills")).toBe(true);
    });

    it("drops removed files from ownership so prune does not re-target them", async () => {
      const receiptOptions = {
        assistantTarget: "claude-code" as const,
        mode: "default" as const,
        components: ["instructions" as const],
        writeBehavior: "prune" as const,
        variants: {},
      };
      const sourcePath = await writeSource("skills/gone/SKILL.md", "# gone");

      await applyWritePlan(
        {
          assistantHome: homeDir,
          writeBehavior: "prune",
          dryRun: false,
          backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "a"),
          actions: [{ relativePath: "skills/gone/SKILL.md", action: "copy", sourcePath }],
          warnings: [],
        },
        receiptOptions,
      );

      await applyWritePlan(
        {
          assistantHome: homeDir,
          writeBehavior: "prune",
          dryRun: false,
          backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "b"),
          actions: [
            { relativePath: "skills/gone/SKILL.md", action: "remove", sourcePath: null },
          ],
          warnings: [],
        },
        receiptOptions,
      );

      const receipt = await readInstallReceipt(homeDir);
      expect(receipt?.ownedFiles).not.toContain("skills/gone/SKILL.md");
    });

    it("readInstallReceipt returns null when no receipt exists", async () => {
      expect(await readInstallReceipt(homeDir)).toBeNull();
    });

    it("creates nested directories for deep file paths", async () => {
      const sourcePath = await writeSource(
        "skills/deep/nested/SKILL.md",
        "# Deep skill",
      );

      const plan: WritePlan = {
        assistantHome: homeDir,
        writeBehavior: "safe-merge",
        dryRun: false,
        backupPath: path.join(homeDir, ".assistant-setup-toolkit", "backups", "test"),
        actions: [
          {
            relativePath: "skills/deep/nested/SKILL.md",
            action: "copy",
            sourcePath,
          },
        ],
        warnings: [],
      };

      const result = await applyWritePlan(plan);

      expect(result.filesWritten).toBe(1);
      expect(await readHome("skills/deep/nested/SKILL.md")).toBe("# Deep skill");
    });
  });
});
