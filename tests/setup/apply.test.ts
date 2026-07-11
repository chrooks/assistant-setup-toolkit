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
      expect(receipt.schemaVersion).toBe(1);
      expect(receipt.toolkit).toBe("code-assistant-context");
      expect(receipt.assistantTarget).toBe("claude-code");
      expect(receipt.files).toContain("CLAUDE.md");
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
