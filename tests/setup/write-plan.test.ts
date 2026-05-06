import { describe, it, expect } from "vitest";
import { planWrites } from "../../src/setup/write-plan.js";
import type { PayloadFile, InstallReceipt } from "../../src/setup/domain.js";

// Helper to create a payload file
function makeFile(relativePath: string, sourcePath?: string): PayloadFile {
  return {
    relativePath,
    sourcePath: sourcePath ?? `/repo/canonical/${relativePath}`,
    component: "skills",
    origin: "canonical-source",
    executable: false,
  };
}

describe("write-plan", () => {
  const assistantHome = "/tmp/fake-home/.claude";

  describe("Safe Merge", () => {
    it("plans copies for missing files, skips existing conflicts", () => {
      const plan = planWrites({
        assistantHome,
        payloadFiles: [makeFile("CLAUDE.md"), makeFile("skills/new/SKILL.md")],
        existingFiles: ["CLAUDE.md"],
        previousReceipt: null,
        writeBehavior: "safe-merge",
        dryRun: false,
      });

      // CLAUDE.md exists — should be skipped
      const skipped = plan.actions.filter((a) => a.action === "skip");
      expect(skipped).toHaveLength(1);
      expect(skipped[0].relativePath).toBe("CLAUDE.md");

      // skills/new/SKILL.md is new — should be copied
      const copies = plan.actions.filter((a) => a.action === "copy");
      expect(copies).toHaveLength(1);
      expect(copies[0].relativePath).toBe("skills/new/SKILL.md");

      // Backup should be planned for non-dry-run
      expect(plan.backupPath).toBeTruthy();
    });
  });

  describe("Overwrite Install", () => {
    it("replaces existing files that conflict with payload", () => {
      const plan = planWrites({
        assistantHome,
        payloadFiles: [makeFile("CLAUDE.md"), makeFile("skills/new/SKILL.md")],
        existingFiles: ["CLAUDE.md"],
        previousReceipt: null,
        writeBehavior: "overwrite",
        dryRun: false,
      });

      // CLAUDE.md should be overwritten
      const overwrites = plan.actions.filter((a) => a.action === "overwrite");
      expect(overwrites).toHaveLength(1);
      expect(overwrites[0].relativePath).toBe("CLAUDE.md");

      // New file still copied
      const copies = plan.actions.filter((a) => a.action === "copy");
      expect(copies).toHaveLength(1);
    });
  });

  describe("Prune Install", () => {
    it("removes only stale files from previous receipt absent in new payload", () => {
      const previousReceipt: InstallReceipt = {
        schemaVersion: 1,
        toolkit: "code-assistant-context",
        installedAt: "2026-05-05T00:00:00.000Z",
        assistantTarget: "claude-code",
        assistantHome,
        setupProfile: {
          mode: "default",
          components: ["skills"],
          writeBehavior: "safe-merge",
        },
        files: [
          "skills/old/SKILL.md",
          "skills/kept/SKILL.md",
        ],
      };

      const plan = planWrites({
        assistantHome,
        payloadFiles: [makeFile("skills/kept/SKILL.md")],
        existingFiles: ["skills/old/SKILL.md", "skills/kept/SKILL.md"],
        previousReceipt,
        writeBehavior: "prune",
        dryRun: false,
      });

      // old/SKILL.md was in receipt but not in new payload — should be removed
      const removes = plan.actions.filter((a) => a.action === "remove");
      expect(removes).toHaveLength(1);
      expect(removes[0].relativePath).toBe("skills/old/SKILL.md");

      // kept/SKILL.md is in both — should be overwritten (prune acts like overwrite for present files)
      const overwrites = plan.actions.filter((a) => a.action === "overwrite");
      expect(overwrites).toHaveLength(1);
      expect(overwrites[0].relativePath).toBe("skills/kept/SKILL.md");
    });

    it("warns and falls back when no previous receipt exists", () => {
      const plan = planWrites({
        assistantHome,
        payloadFiles: [makeFile("CLAUDE.md")],
        existingFiles: [],
        previousReceipt: null,
        writeBehavior: "prune",
        dryRun: false,
      });

      // Should not remove anything without a receipt
      const removes = plan.actions.filter((a) => a.action === "remove");
      expect(removes).toHaveLength(0);

      // Should warn
      expect(plan.warnings).toContain(
        "No previous Install Receipt found. Cannot prune — falling back to overwrite behavior.",
      );
    });
  });

  describe("dry-run", () => {
    it("does not plan a backup path", () => {
      const plan = planWrites({
        assistantHome,
        payloadFiles: [makeFile("CLAUDE.md")],
        existingFiles: [],
        previousReceipt: null,
        writeBehavior: "safe-merge",
        dryRun: true,
      });

      expect(plan.backupPath).toBeNull();
      expect(plan.dryRun).toBe(true);
    });
  });
});
