import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseInstallationManifestYaml } from "../../src/setup/manifest.js";

// Minimal valid manifest with one skill and one MCP server
const VALID_YAML = `
version: 1
externalSources:
  - id: test-skill
    name: Test Skill
    kind: skill
    url: https://github.com/example/test-skill
    default: true
    targets:
      - claude-code
  - id: test-mcp
    name: Test MCP
    kind: mcp-server
    url: https://github.com/example/test-mcp
    default: false
    targets:
      - claude-code
      - codex-cli
    requiresConfirmation: true
    requiredSecrets:
      - TEST_API_KEY
`;

describe("manifest", () => {
  describe("parseInstallationManifestYaml", () => {
    it("parses a valid manifest with skill and MCP server sources", () => {
      const manifest = parseInstallationManifestYaml(VALID_YAML, "test.yaml");

      expect(manifest.version).toBe(1);
      expect(manifest.externalSources).toHaveLength(2);

      // Skill source
      const skill = manifest.externalSources[0];
      expect(skill.id).toBe("test-skill");
      expect(skill.kind).toBe("skill");
      expect(skill.default).toBe(true);
      expect(skill.targets).toEqual(["claude-code"]);

      // MCP server source
      const mcp = manifest.externalSources[1];
      expect(mcp.id).toBe("test-mcp");
      expect(mcp.kind).toBe("mcp-server");
      expect(mcp.requiresConfirmation).toBe(true);
      expect(mcp.requiredSecrets).toEqual(["TEST_API_KEY"]);
    });

    it("rejects unknown top-level fields with descriptive error", () => {
      const yaml = `
version: 1
externalSources: []
bogusField: true
`;
      expect(() => parseInstallationManifestYaml(yaml, "bad.yaml")).toThrow(
        /Invalid Installation Manifest in bad\.yaml/,
      );
      expect(() => parseInstallationManifestYaml(yaml, "bad.yaml")).toThrow(
        /bogusField/,
      );
    });

    it("rejects source missing required id field", () => {
      const yaml = `
version: 1
externalSources:
  - name: No ID
    kind: skill
    url: https://github.com/example/no-id
    default: true
    targets: [claude-code]
`;
      expect(() => parseInstallationManifestYaml(yaml, "missing-id.yaml")).toThrow(
        /Invalid Installation Manifest/,
      );
    });

    it("rejects source with invalid URL", () => {
      const yaml = `
version: 1
externalSources:
  - id: bad-url
    name: Bad URL
    kind: skill
    url: not-a-url
    default: true
    targets: [claude-code]
`;
      expect(() => parseInstallationManifestYaml(yaml, "bad-url.yaml")).toThrow(
        /url must be a valid URL/,
      );
    });

    it("accepts empty externalSources array", () => {
      const yaml = `
version: 1
externalSources: []
`;
      const manifest = parseInstallationManifestYaml(yaml, "empty.yaml");
      expect(manifest.externalSources).toEqual([]);
    });

    it("parses installWhen conditional", () => {
      const yaml = `
version: 1
externalSources:
  - id: conditional
    name: Conditional Source
    kind: plugin
    url: https://github.com/example/conditional
    default: true
    targets: [claude-code]
    installWhen:
      assistantTargetExists: claude-code
`;
      const manifest = parseInstallationManifestYaml(yaml, "conditional.yaml");
      expect(manifest.externalSources[0].installWhen).toEqual({
        assistantTargetExists: "claude-code",
      });
    });

    it("parses per-target plugin install commands", () => {
      const yaml = `
version: 1
externalSources:
  - id: plugin-source
    name: Plugin Source
    kind: plugin
    url: https://github.com/example/plugin-source
    default: true
    targets: [claude-code, codex-cli]
    installCommands:
      claude-code:
        - claude plugin marketplace add example/plugin-source
        - claude plugin install source@plugin
      codex-cli:
        - npx skills add example/plugin-source -a codex
`;
      const manifest = parseInstallationManifestYaml(yaml, "plugin.yaml");
      expect(manifest.externalSources[0].installCommands).toEqual({
        "claude-code": [
          "claude plugin marketplace add example/plugin-source",
          "claude plugin install source@plugin",
        ],
        "codex-cli": ["npx skills add example/plugin-source -a codex"],
      });
    });
  });

  describe("real manifest: manifests/install.yaml", () => {
    it("parses the repository manifest with all expected sources", () => {
      const yamlPath = resolve(__dirname, "../../manifests/install.yaml");
      const yamlText = readFileSync(yamlPath, "utf-8");
      const manifest = parseInstallationManifestYaml(yamlText, "manifests/install.yaml");

      expect(manifest.version).toBe(1);
      // Should contain all 10 sources from PLUGINS.md
      expect(manifest.externalSources).toHaveLength(10);

      // Verify key IDs exist
      const ids = manifest.externalSources.map((s) => s.id);
      expect(ids).toContain("matt-pocock-skills");
      expect(ids).toContain("find-skills");
      expect(ids).toContain("impeccable");
      expect(ids).toContain("caveman");
      expect(ids).toContain("ponytail");
      expect(ids).toContain("everything-claude-code");
      expect(ids).toContain("codex-plugin-cc");
      expect(ids).toContain("playwright-mcp");
      expect(ids).toContain("context7");
      expect(ids).toContain("agent-native-visual-plans");

      const caveman = manifest.externalSources.find((s) => s.id === "caveman")!;
      expect(caveman.kind).toBe("plugin");
      expect(caveman.installCommands?.["claude-code"]).toEqual([
        "claude plugin marketplace add JuliusBrussee/caveman",
        "claude plugin install caveman@caveman",
      ]);
      expect(caveman.installCommands?.["codex-cli"]).toEqual([
        "npx skills add JuliusBrussee/caveman -a codex",
      ]);

      const ponytail = manifest.externalSources.find((s) => s.id === "ponytail")!;
      expect(ponytail.kind).toBe("plugin");
      expect(ponytail.installCommands?.["claude-code"]).toEqual([
        "claude plugin marketplace add DietrichGebert/ponytail",
        "claude plugin install ponytail@ponytail",
      ]);

      // MCP servers require confirmation
      const playwright = manifest.externalSources.find((s) => s.id === "playwright-mcp")!;
      expect(playwright.requiresConfirmation).toBe(true);

      const ctx7 = manifest.externalSources.find((s) => s.id === "context7")!;
      expect(ctx7.requiredSecrets).toEqual(["CONTEXT7_API_KEY"]);
    });
  });
});
