import { describe, it, expect } from "vitest";
import {
  createDefaultSetupProfile,
  resolveAssistantHomes,
} from "../../src/setup/domain.js";
import type { SetupProfile, AssistantHomeId } from "../../src/setup/domain.js";

describe("domain", () => {
  describe("createDefaultSetupProfile", () => {
    it("returns all components with safe-merge defaults", () => {
      const profile: SetupProfile = createDefaultSetupProfile(["claude-code"]);

      expect(profile.mode).toBe("default");
      expect(profile.targets).toEqual(["claude-code"]);
      expect(profile.writeBehavior).toBe("safe-merge");
      expect(profile.dryRun).toBe(false);
      expect(profile.fetch).toBe(true);
      expect(profile.symlink).toBe(false);
      expect(profile.yes).toBe(false);
      expect(profile.components).toEqual([
        "instructions",
        "plans",
        "hooks",
        "commands",
        "skills",
        "settings",
        "manifests",
        "mcp",
      ]);
    });
  });

  describe("resolveAssistantHomes", () => {
    it("maps claude-code to claude-home only", () => {
      const homes = resolveAssistantHomes(["claude-code"]);
      expect(homes).toEqual(["claude-home"]);
    });

    it("maps codex-cli to codex-home and agents-home", () => {
      const homes = resolveAssistantHomes(["codex-cli"]);
      expect(homes).toEqual(["codex-home", "agents-home"]);
    });

    it("deduplicates when both targets selected", () => {
      const homes = resolveAssistantHomes(["claude-code", "codex-cli"]);
      expect(homes).toEqual(["claude-home", "codex-home", "agents-home"]);
    });

    it("returns empty for empty targets", () => {
      const homes = resolveAssistantHomes([]);
      expect(homes).toEqual([]);
    });
  });
});
