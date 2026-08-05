import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_AI_PREFERENCES_CHAR_LIMIT,
  buildToolboxIndex,
  buildUploadChecklist,
  extractSkillGloss,
  groupExternalSkillDirs,
  parseClaudeAiManifest,
  selectPackSkills,
} from "../../src/setup/claude-ai-pack.js";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();

describe("parseClaudeAiManifest", () => {
  it("parses a valid manifest", () => {
    const manifest = parseClaudeAiManifest(
      "version: 1\nskills:\n  - grill-me\n  - quiz-me\n",
    );
    expect(manifest.skills).toEqual(["grill-me", "quiz-me"]);
  });

  it("rejects an unsupported version", () => {
    expect(() => parseClaudeAiManifest("version: 2\nskills: [x]\n")).toThrow(
      /version 2/,
    );
  });

  it("rejects a missing or empty skills list", () => {
    expect(() => parseClaudeAiManifest("version: 1\n")).toThrow(/non-empty/);
    expect(() => parseClaudeAiManifest("version: 1\nskills: []\n")).toThrow(
      /non-empty/,
    );
  });

  it("rejects non-string skill entries", () => {
    expect(() =>
      parseClaudeAiManifest("version: 1\nskills:\n  - 42\n"),
    ).toThrow(/non-empty string/);
  });

  it("rejects a non-mapping document", () => {
    expect(() => parseClaudeAiManifest("- just\n- a list\n")).toThrow(
      /mapping/,
    );
  });

  it("parses connectors and defaults them to empty", () => {
    const withConnectors = parseClaudeAiManifest(
      "version: 1\nskills: [wym]\nconnectors:\n  Brain: the brain\n",
    );
    expect(withConnectors.connectors).toEqual({ Brain: "the brain" });

    const without = parseClaudeAiManifest("version: 1\nskills: [wym]\n");
    expect(without.connectors).toEqual({});
  });

  it("rejects a connector without a gloss string", () => {
    expect(() =>
      parseClaudeAiManifest(
        "version: 1\nskills: [wym]\nconnectors:\n  Brain: 3\n",
      ),
    ).toThrow(/Connector "Brain"/);
  });

  it("parses externalSkills and defaults them to empty", () => {
    const withExternal = parseClaudeAiManifest(
      "version: 1\nskills: [wym]\nexternalSkills:\n  - grilling\n",
    );
    expect(withExternal.externalSkills).toEqual(["grilling"]);

    const without = parseClaudeAiManifest("version: 1\nskills: [wym]\n");
    expect(without.externalSkills).toEqual([]);
  });

  it("rejects a skill listed in both homes", () => {
    expect(() =>
      parseClaudeAiManifest(
        "version: 1\nskills: [wym]\nexternalSkills: [wym]\n",
      ),
    ).toThrow(/both/);
  });
});

describe("groupExternalSkillDirs", () => {
  it("groups fetched payload files into per-skill dirs", () => {
    const dirs = groupExternalSkillDirs([
      {
        relativePath: "skills/grilling/SKILL.md",
        sourcePath: "/tmp/clone/skills/productivity/grilling/SKILL.md",
        component: "skills",
        origin: "external-source",
        executable: false,
      },
      {
        relativePath: "skills/grilling/notes/extra.md",
        sourcePath: "/tmp/clone/skills/productivity/grilling/notes/extra.md",
        component: "skills",
        origin: "external-source",
        executable: false,
      },
      {
        relativePath: "rules/common/foo.md",
        sourcePath: "/tmp/clone/rules/common/foo.md",
        component: "rules",
        origin: "external-source",
        executable: false,
      },
    ]);
    expect(dirs).toEqual([
      {
        name: "grilling",
        files: ["SKILL.md", "notes/extra.md"],
        sourceDir: "/tmp/clone/skills/productivity/grilling",
      },
    ]);
  });
});

describe("extractSkillGloss", () => {
  it("takes the first sentence of the frontmatter description", () => {
    const gloss = extractSkillGloss(
      "---\nname: x\ndescription: Does the thing well. Use when asked.\n---\n",
    );
    expect(gloss).toBe("Does the thing well.");
  });

  it("truncates an overlong first sentence with an ellipsis", () => {
    const gloss = extractSkillGloss(
      `---\ndescription: ${"word ".repeat(60)}end.\n---\n`,
    );
    expect(gloss.length).toBeLessThanOrEqual(160);
    expect(gloss.endsWith("…")).toBe(true);
  });

  it("strips a YAML quote and unescapes inner quotes", () => {
    const gloss = extractSkillGloss(
      '---\ndescription: "Explains \\"wym\\" things. Use when asked."\n---\n',
    );
    expect(gloss).toBe('Explains "wym" things.');
  });

  it("returns empty when there is no description line", () => {
    expect(extractSkillGloss("---\nname: x\n---\n")).toBe("");
  });
});

describe("buildToolboxIndex", () => {
  it("lists skills with glosses and connectors", () => {
    const toolbox = buildToolboxIndex(
      [
        { name: "grill-me", gloss: "Interviews you." },
        { name: "wym", gloss: "" },
      ],
      { Brain: "the brain" },
    );
    expect(toolbox).toContain("- **grill-me** — Interviews you.");
    expect(toolbox).toContain("- **wym**\n");
    expect(toolbox).toContain("- **Brain** — the brain");
  });
});

describe("selectPackSkills", () => {
  const available = [
    { name: "grill-me", files: ["SKILL.md"], sourceDir: "/a" },
    { name: "quiz-me", files: ["SKILL.md"], sourceDir: "/b" },
    { name: "wym", files: ["SKILL.md"], sourceDir: "/c" },
  ];

  it("selects wanted skills in manifest order", () => {
    const { selected, missing } = selectPackSkills(available, [
      "wym",
      "grill-me",
    ]);
    expect(selected.map((dir) => dir.name)).toEqual(["wym", "grill-me"]);
    expect(missing).toEqual([]);
  });

  it("collects missing names instead of dropping them", () => {
    const { selected, missing } = selectPackSkills(available, [
      "grill-me",
      "renamed-skill",
    ]);
    expect(selected.map((dir) => dir.name)).toEqual(["grill-me"]);
    expect(missing).toEqual(["renamed-skill"]);
  });
});

describe("buildUploadChecklist", () => {
  it("lists every packed skill as a ZIP checkbox", () => {
    const checklist = buildUploadChecklist(["grill-me", "quiz-me"], true);
    expect(checklist).toContain("- [ ] grill-me.zip");
    expect(checklist).toContain("- [ ] quiz-me.zip");
    expect(checklist).toContain("PROFILE.md, and TOOLBOX.md");
  });

  it("points at the local profile when no canonical copy packed", () => {
    const checklist = buildUploadChecklist(["grill-me"], false);
    expect(checklist).toContain("~/.claude/PROFILE.md");
  });
});

describe("manifests/claude-ai.yaml (repo integrity)", () => {
  it("names only skills that exist in canonical/skills", async () => {
    const manifest = parseClaudeAiManifest(
      await readFile(path.join(repoRoot, "manifests", "claude-ai.yaml"), "utf-8"),
    );
    const available = (await discoverSkillDirs(repoRoot)).filter(
      (dir) => !dir.name.startsWith("machines/"),
    );
    const { missing } = selectPackSkills(available, manifest.skills);
    expect(missing).toEqual([]);
  });

  it("keeps externalSkills out of canonical — a copy there would shadow them", async () => {
    const manifest = parseClaudeAiManifest(
      await readFile(path.join(repoRoot, "manifests", "claude-ai.yaml"), "utf-8"),
    );
    const canonicalNames = new Set(
      (await discoverSkillDirs(repoRoot)).map((dir) => dir.name),
    );
    const shadowed = manifest.externalSkills.filter((name) =>
      canonicalNames.has(name),
    );
    expect(shadowed).toEqual([]);
  });

  it("ships a canonical Lexicon for Project knowledge", async () => {
    const lexicon = await readFile(
      path.join(repoRoot, "canonical", "LEXICON.md"),
      "utf-8",
    );
    expect(lexicon.length).toBeGreaterThan(0);
  });

  it("keeps the Project instructions under claude.ai's ~8k-char box", async () => {
    const instructions = await readFile(
      path.join(repoRoot, "manifests", "claude-ai-project-instructions.md"),
      "utf-8",
    );
    const length = [...instructions.trim()].length;
    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThanOrEqual(8000);
  });

  it("keeps the preferences paste under claude.ai's character cap", async () => {
    const preferences = await readFile(
      path.join(repoRoot, "manifests", "claude-ai-preferences.md"),
      "utf-8",
    );
    const length = [...preferences.trim()].length;
    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThanOrEqual(CLAUDE_AI_PREFERENCES_CHAR_LIMIT);
  });
});
