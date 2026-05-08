import { describe, it, expect } from "vitest";
import { parseCliFlags } from "../../src/setup/cli.js";

describe("cli", () => {
  describe("parseCliFlags", () => {
    it("parses --claude --codex --default --dry-run into a SetupProfile", () => {
      const profile = parseCliFlags([
        "--claude",
        "--codex",
        "--default",
        "--dry-run",
      ]);

      expect(profile.targets).toEqual(["claude-code", "codex-cli"]);
      expect(profile.mode).toBe("default");
      expect(profile.dryRun).toBe(true);
      expect(profile.writeBehavior).toBe("safe-merge");
      expect(profile.fetch).toBe(true);
    });

    it("parses --claude --overwrite as overwrite behavior", () => {
      const profile = parseCliFlags(["--claude", "--default", "--overwrite"]);

      expect(profile.writeBehavior).toBe("overwrite");
    });

    it("parses --prune as prune behavior", () => {
      const profile = parseCliFlags(["--claude", "--default", "--prune"]);

      expect(profile.writeBehavior).toBe("prune");
    });

    it("parses --no-fetch to disable fetching", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--no-fetch",
      ]);

      expect(profile.fetch).toBe(false);
    });

    it("parses --symlink and --yes flags", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--symlink",
        "--yes",
      ]);

      expect(profile.symlink).toBe(true);
      expect(profile.yes).toBe(true);
    });

    it("throws when no target is specified", () => {
      expect(() => parseCliFlags(["--default"])).toThrow(
        /at least one Assistant Target/,
      );
    });

    it("throws when neither --default nor --custom is specified in non-interactive mode", () => {
      expect(() => parseCliFlags(["--claude"])).toThrow(
        /--default or --custom/,
      );
    });

    it("parses --sources <ids> into selectedExternalSourceIds", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--sources",
        "find-skills,impeccable",
      ]);
      expect(profile.selectedExternalSourceIds).toEqual([
        "find-skills",
        "impeccable",
      ]);
    });

    it("parses --no-sources into an empty selectedExternalSourceIds", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--no-sources",
      ]);
      expect(profile.selectedExternalSourceIds).toEqual([]);
    });

    it("leaves selectedExternalSourceIds undefined when no source flag passed", () => {
      const profile = parseCliFlags(["--claude", "--default"]);
      expect(profile.selectedExternalSourceIds).toBeUndefined();
    });
  });
});
