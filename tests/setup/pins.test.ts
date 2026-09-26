import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { comparePins, setPin } from "../../src/setup/pins.js";
import { loadInstallationManifest } from "../../src/setup/manifest.js";

const OLD = "1111111111111111111111111111111111111111";
const NEW = "2222222222222222222222222222222222222222";

const yaml = `version: 1
externalSources:
  # a comment that must survive
  - id: alpha
    name: Alpha
    kind: skill
    url: https://github.com/o/alpha/tree/main/skills/alpha
    commit: ${OLD}
    default: true
  - id: beta
    name: Beta
    kind: plugin
    url: https://github.com/o/beta
    default: false
`;

describe("setPin", () => {
  it("replaces an existing pin and leaves everything else byte-identical", () => {
    const next = setPin(yaml, "alpha", NEW);
    expect(next).toBe(yaml.replace(OLD, NEW));
  });

  it("adds a pin right under the url of a source that has none", () => {
    const next = setPin(yaml, "beta", NEW);
    expect(next).toContain(`    url: https://github.com/o/beta\n    commit: ${NEW}\n    default: false`);
    expect(next).toContain("# a comment that must survive");
  });

  it("never edits a notes line that happens to start with commit:", () => {
    const withNotes = yaml.replace(
      "    url: https://github.com/o/beta\n",
      "    url: https://github.com/o/beta\n    notes:\n      - >-\n        commit: is a word this note uses\n",
    );
    const next = setPin(withNotes, "beta", NEW);
    expect(next).toContain("        commit: is a word this note uses");
    expect(next).toContain(`    url: https://github.com/o/beta\n    commit: ${NEW}\n    notes:`);
  });

  it("refuses an unknown source id", () => {
    expect(() => setPin(yaml, "gamma", NEW)).toThrow(/gamma/);
  });
});

describe("comparePins", () => {
  it("reports each fetchable source as current, behind, or unpinned", async () => {
    const tips: Record<string, string> = {
      "https://github.com/o/alpha.git main": NEW,
      "https://github.com/o/beta.git HEAD": OLD,
    };
    const rows = await comparePins(
      [
        { id: "alpha", url: "https://github.com/o/alpha/tree/main/skills/alpha", kind: "skill", commit: OLD },
        { id: "beta", url: "https://github.com/o/beta", kind: "plugin" },
        { id: "mcp", url: "https://github.com/o/mcp", kind: "mcp-server" },
      ],
      async (repoUrl, ref) => tips[`${repoUrl} ${ref}`],
    );

    expect(rows).toEqual([
      {
        id: "alpha",
        status: "behind",
        pinned: OLD,
        tip: NEW,
        compareUrl: `https://github.com/o/alpha/compare/${OLD}...${NEW}`,
      },
      { id: "beta", status: "unpinned", tip: OLD },
    ]);
  });
});

describe("the real manifest", () => {
  it("pins every source the Setup Wizard fetches", async () => {
    const manifestPath = path.join(process.cwd(), "manifests", "install.yaml");
    const manifest = await loadInstallationManifest(manifestPath);
    const unpinned = manifest.externalSources
      .filter((s) => s.kind !== "mcp-server" && !s.commit)
      .map((s) => s.id);
    expect(unpinned).toEqual([]);
    expect(readFileSync(manifestPath, "utf8")).toContain("commit:");
  });
});
