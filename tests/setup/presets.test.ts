import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  loadPresets,
  parsePresetsYaml,
  resolvePresetIntoProfile,
  resolvePresetName,
  describePresetEffects,
  stickyReceiptVariants,
} from "../../src/setup/presets.js";
import type { SetupProfile, Preset } from "../../src/setup/domain.js";
import { ALL_COMPONENT_KINDS } from "../../src/setup/domain.js";

const BASE_PROFILE: SetupProfile = {
  mode: "default",
  targets: ["claude-code"],
  components: [...ALL_COMPONENT_KINDS],
  writeBehavior: "safe-merge",
  dryRun: false,
  fetch: true,
  symlink: false,
  yes: true,
  quiet: false,
  artifacts: false,
};

const VALID_YAML = `
version: 1
presets:
  work:
    variants:
      visual-plans: local-files
    selectedExternalSourceIds: []
  personal:
    variants:
      visual-plans: self-hosted
`;

describe("presets", () => {
  describe("parsePresetsYaml", () => {
    it("parses named Presets with identity fields", () => {
      const presets = parsePresetsYaml(VALID_YAML);
      expect(Object.keys(presets)).toEqual(["work", "personal"]);
      expect(presets.work.variants).toEqual({ "visual-plans": "local-files" });
      expect(presets.work.selectedExternalSourceIds).toEqual([]);
      expect(presets.personal.writeBehavior).toBeUndefined();
    });

    it("rejects unknown fields naming the offender", () => {
      const bad = "version: 1\npresets:\n  work:\n    varaints:\n      x: y\n";
      expect(() => parsePresetsYaml(bad)).toThrow(/varaints/);
    });

    it("rejects an unsupported version", () => {
      expect(() => parsePresetsYaml("version: 2\npresets: {}\n")).toThrow(
        /version/i,
      );
    });
  });

  describe("resolvePresetIntoProfile", () => {
    const preset: Preset = {
      writeBehavior: "overwrite",
      selectedExternalSourceIds: ["find-skills"],
      variants: { "visual-plans": "local-files" },
    };

    it("fills gaps the flags left", () => {
      const resolved = resolvePresetIntoProfile(BASE_PROFILE, preset);
      expect(resolved.writeBehavior).toBe("overwrite");
      expect(resolved.selectedExternalSourceIds).toEqual(["find-skills"]);
      expect(resolved.variants?.["visual-plans"]).toBe("local-files");
    });

    it("explicit flag values beat the Preset", () => {
      const base: SetupProfile = {
        ...BASE_PROFILE,
        writeBehavior: "prune",
        selectedExternalSourceIds: [],
        variants: { "visual-plans": "none" },
      };
      const resolved = resolvePresetIntoProfile(
        base,
        preset,
        new Set(["writeBehavior"]),
      );
      expect(resolved.writeBehavior).toBe("prune");
      expect(resolved.selectedExternalSourceIds).toEqual([]);
      expect(resolved.variants?.["visual-plans"]).toBe("none");
    });

    it("does not mutate the base profile", () => {
      const before = JSON.stringify(BASE_PROFILE);
      resolvePresetIntoProfile(BASE_PROFILE, preset);
      expect(JSON.stringify(BASE_PROFILE)).toBe(before);
    });
  });

  describe("resolvePresetName", () => {
    const presets = { work: {}, personal: {} };

    it("prefers the flag name over the receipt name", () => {
      expect(resolvePresetName(presets, "personal", "work")).toBe("personal");
    });

    it("falls back to the receipt name", () => {
      expect(resolvePresetName(presets, undefined, "work")).toBe("work");
    });

    it("returns undefined when neither names a Preset", () => {
      expect(resolvePresetName(presets, undefined, undefined)).toBeUndefined();
    });

    it("fails loudly on an unknown name, listing available Presets", () => {
      expect(() => resolvePresetName(presets, "wrok", undefined)).toThrow(
        /wrok.*work, personal/s,
      );
      expect(() => resolvePresetName(presets, undefined, "gone")).toThrow(
        /gone/,
      );
    });
  });

  describe("stickyReceiptVariants", () => {
    it("keeps preset/prompt-sourced variants", () => {
      expect(
        stickyReceiptVariants({ "visual-plans": "local-files" }, [], undefined),
      ).toEqual({ "visual-plans": "local-files" });
    });

    it("reverts a flag-sourced key to the prior receipt value", () => {
      expect(
        stickyReceiptVariants(
          { "visual-plans": "none" },
          ["visual-plans"],
          { "visual-plans": "self-hosted" },
        ),
      ).toEqual({ "visual-plans": "self-hosted" });
    });

    it("drops a flag-sourced key with no prior value", () => {
      expect(
        stickyReceiptVariants({ "visual-plans": "none" }, ["visual-plans"], undefined),
      ).toEqual({});
    });
  });

  describe("loadPresets", () => {
    it("propagates non-ENOENT read errors instead of returning {}", async () => {
      // A directory path fails with EISDIR — must not degrade to "no presets".
      await expect(loadPresets(path.resolve(__dirname, ".."))).rejects.toThrow();
    });

    it("returns an empty record when the file is missing", async () => {
      expect(await loadPresets("/nonexistent/presets.yaml")).toEqual({});
    });

    it("loads the repo's seeded manifests/presets.yaml", async () => {
      const seeded = await loadPresets(
        path.resolve(__dirname, "../../manifests/presets.yaml"),
      );
      expect(Object.keys(seeded).sort()).toEqual([
        "hestia",
        "personal",
        "work",
      ]);
      expect(seeded.work.variants?.["visual-plans"]).toBe("local-files");
      expect(seeded.personal.variants?.["visual-plans"]).toBe("self-hosted");
    });
  });

  describe("describePresetEffects", () => {
    it("reports each Variant with its visible consequence", () => {
      const preset: Preset = {
        variants: { "visual-plans": "self-hosted", machine: "hestia" },
      };
      const profile: SetupProfile = {
        ...BASE_PROFILE,
        variants: { "visual-plans": "self-hosted", machine: "hestia" },
      };

      const effects = describePresetEffects(profile, preset);

      expect(effects).toHaveLength(2);
      expect(effects[0]).toMatchObject({
        field: "variants.visual-plans",
        overridden: false,
      });
      expect(effects[1].field).toBe("variants.machine");
      // The gloss is the point — "machine = hestia" alone says nothing.
      expect(effects[1].effect).toContain("rules/machine.md");
    });

    it("marks a field a flag overrode", () => {
      const preset: Preset = { variants: { "visual-plans": "self-hosted" } };
      const profile: SetupProfile = {
        ...BASE_PROFILE,
        variants: { "visual-plans": "none" },
      };

      const [effect] = describePresetEffects(profile, preset);

      expect(effect.overridden).toBe(true);
      expect(effect.effect).toContain("none");
    });

    it("renders an empty source list as 'no External Sources'", () => {
      const preset: Preset = { selectedExternalSourceIds: [] };
      const profile: SetupProfile = {
        ...BASE_PROFILE,
        selectedExternalSourceIds: [],
      };

      const [effect] = describePresetEffects(profile, preset);

      expect(effect).toMatchObject({
        field: "selectedExternalSourceIds",
        effect: "no External Sources",
        overridden: false,
      });
    });

    it("reports nothing for a Preset that declares nothing", () => {
      expect(describePresetEffects(BASE_PROFILE, {})).toEqual([]);
    });

    it("reports writeBehavior as overridden when the profile diverges", () => {
      const preset: Preset = { writeBehavior: "overwrite" };
      const profile: SetupProfile = { ...BASE_PROFILE, writeBehavior: "prune" };

      const [effect] = describePresetEffects(profile, preset);

      expect(effect).toMatchObject({
        field: "writeBehavior",
        effect: "prune",
        overridden: true,
      });
    });
  });
});
