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

    it("leaves variants unset when --visual-plans absent (receipt rehydrates later)", () => {
      const profile = parseCliFlags(["--claude", "--default", "--yes"]);
      expect(profile.variants?.["visual-plans"]).toBeUndefined();
    });

    it("falls back to interactive on an unknown --visual-plans value", () => {
      expect(() =>
        parseCliFlags(["--claude", "--default", "--visual-plans", "hosted"]),
      ).toThrow();
    });

    it("stays non-interactive on an unknown value under --yes (warn + unset)", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--yes",
        "--visual-plans",
        "hosted",
      ]);
      expect(profile.variants?.["visual-plans"]).toBeUndefined();
    });

    it("does not swallow a following flag as the --visual-plans value", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--visual-plans",
        "--yes",
      ]);
      expect(profile.yes).toBe(true);
      expect(profile.variants?.["visual-plans"]).toBeUndefined();
    });

    it("stays non-interactive under --sync with a trailing bare --visual-plans", () => {
      const profile = parseCliFlags(["--sync", "--visual-plans"]);
      expect(profile.variants?.["visual-plans"]).toBeUndefined();
    });

    it("parses --preset <name> into profile.presetName", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--preset",
        "work",
      ]);
      expect(profile.presetName).toBe("work");
    });

    it("ignores a bare trailing --preset under --yes (warn + unset)", () => {
      const profile = parseCliFlags(["--sync", "--preset"]);
      expect(profile.presetName).toBeUndefined();
    });

    it("does not swallow a following flag as the --preset value", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--preset",
        "--yes",
      ]);
      expect(profile.yes).toBe(true);
      expect(profile.presetName).toBeUndefined();
    });

    it("parses --visual-plans <value> into profile.variants", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--visual-plans",
        "local-files",
      ]);
      expect(profile.variants?.["visual-plans"]).toBe("local-files");
    });
  });
});
