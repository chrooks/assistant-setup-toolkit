import { describe, it, expect } from "vitest";
import { parseCliFlags, tryParseCliFlags } from "../../src/setup/cli.js";

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

    it("defaults writeBehavior to safe-merge when --write is absent", () => {
      const profile = parseCliFlags(["--claude", "--default"]);
      expect(profile.writeBehavior).toBe("safe-merge");
    });

    it("parses --write overwrite and --write prune", () => {
      expect(
        parseCliFlags(["--claude", "--default", "--write", "overwrite"])
          .writeBehavior,
      ).toBe("overwrite");
      expect(
        parseCliFlags(["--claude", "--default", "--write", "prune"])
          .writeBehavior,
      ).toBe("prune");
    });

    it("rejects an unknown --write value instead of silently defaulting", () => {
      expect(() =>
        parseCliFlags(["--claude", "--default", "--write", "clobber"]),
      ).toThrow(/Invalid --write value/);
    });

    it("parses --no-fetch to disable fetching", () => {
      const profile = parseCliFlags(["--claude", "--default", "--no-fetch"]);
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

    it("leaves artifacts off unless --artifacts is passed", () => {
      expect(parseCliFlags(["--claude", "--default"]).artifacts).toBe(false);
      expect(
        parseCliFlags(["--claude", "--default", "--artifacts"]).artifacts,
      ).toBe(true);
    });

    it("throws when no target is specified", () => {
      expect(() => parseCliFlags(["--default"])).toThrow(
        /at least one Assistant Target/,
      );
    });

    it("throws when neither --default nor --custom is specified in non-interactive mode", () => {
      expect(() => parseCliFlags(["--claude"])).toThrow(/--default or --custom/);
    });

    it("rejects --default and --custom together", () => {
      expect(() => parseCliFlags(["--claude", "--default", "--custom"])).toThrow(
        /not both/,
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
      const profile = parseCliFlags(["--claude", "--default", "--no-sources"]);
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

    it("parses --visual-plans <value> into profile.variants", () => {
      const profile = parseCliFlags([
        "--claude",
        "--default",
        "--visual-plans",
        "local-files",
      ]);
      expect(profile.variants?.["visual-plans"]).toBe("local-files");
    });

    it("rejects an unknown --visual-plans value", () => {
      expect(() =>
        parseCliFlags(["--claude", "--default", "--visual-plans", "hosted"]),
      ).toThrow(/Invalid --visual-plans value/);
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

    it("expands --sync into both targets, default mode, overwrite, no fetch, yes", () => {
      const profile = parseCliFlags(["--sync"]);
      expect(profile.targets).toEqual(["claude-code", "codex-cli"]);
      expect(profile.mode).toBe("default");
      expect(profile.writeBehavior).toBe("overwrite");
      expect(profile.fetch).toBe(false);
      expect(profile.yes).toBe(true);
    });

    it("lets an explicit target narrow --sync", () => {
      const profile = parseCliFlags(["--sync", "--claude"]);
      expect(profile.targets).toEqual(["claude-code"]);
    });
  });

  describe("tryParseCliFlags", () => {
    // The whole point of the parseArgs rewrite: a typo used to be silently
    // dropped, and the run would fall through to interactive prompts with no
    // explanation of why the flags "didn't work".
    it("errors on an unknown flag instead of silently ignoring it", () => {
      const result = tryParseCliFlags(["--claude", "--defualt"]);
      expect(result.kind).toBe("error");
      if (result.kind === "error") {
        expect(result.message).toMatch(/defualt/);
      }
    });

    it("errors when a value flag is missing its value", () => {
      const result = tryParseCliFlags(["--claude", "--default", "--preset"]);
      expect(result.kind).toBe("error");
    });

    it("returns help text for --help", () => {
      const result = tryParseCliFlags(["--help"]);
      expect(result.kind).toBe("help");
      if (result.kind === "help") {
        expect(result.text).toMatch(/Usage: npm run setup/);
      }
    });

    it("asks for interactive prompts when target and mode are absent", () => {
      const result = tryParseCliFlags([]);
      expect(result.kind).toBe("interactive");
    });
  });
});
