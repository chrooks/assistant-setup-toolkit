import { describe, it, expect } from "vitest";
import {
  resolveAssistantHomePath,
  resolveReceiptPath,
  resolveBackupPath,
} from "../../src/setup/paths.js";

describe("paths", () => {
  // Use a fake home so tests never touch real Assistant Homes
  const fakeHome = "/tmp/fake-user-home";

  describe("resolveAssistantHomePath", () => {
    it("resolves claude-home to <home>/.claude", () => {
      expect(resolveAssistantHomePath("claude-home", fakeHome)).toBe(
        "/tmp/fake-user-home/.claude",
      );
    });

    it("resolves codex-home to <home>/.codex", () => {
      expect(resolveAssistantHomePath("codex-home", fakeHome)).toBe(
        "/tmp/fake-user-home/.codex",
      );
    });

    it("resolves agents-home to <home>/.agents", () => {
      expect(resolveAssistantHomePath("agents-home", fakeHome)).toBe(
        "/tmp/fake-user-home/.agents",
      );
    });
  });

  describe("resolveReceiptPath", () => {
    it("returns receipt.json inside .assistant-setup-toolkit", () => {
      const assistantHome = "/tmp/fake-user-home/.claude";
      expect(resolveReceiptPath(assistantHome)).toBe(
        "/tmp/fake-user-home/.claude/.assistant-setup-toolkit/receipt.json",
      );
    });
  });

  describe("resolveBackupPath", () => {
    it("includes a timestamp segment under .assistant-setup-toolkit/backups", () => {
      const assistantHome = "/tmp/fake-user-home/.claude";
      const backupPath = resolveBackupPath(assistantHome);

      // Should be under the assistant home's toolkit metadata dir
      expect(backupPath).toContain(
        "/tmp/fake-user-home/.claude/.assistant-setup-toolkit/backups/",
      );
      // Should contain a timestamp-like segment (ISO-ish with digits and dashes)
      const segment = backupPath.split("/").pop()!;
      expect(segment).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
