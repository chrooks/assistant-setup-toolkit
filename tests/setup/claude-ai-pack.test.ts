import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAUDE_AI_PREFERENCES_CHAR_LIMIT,
  buildUploadChecklist,
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
    const checklist = buildUploadChecklist(["grill-me", "quiz-me"]);
    expect(checklist).toContain("- [ ] grill-me.zip");
    expect(checklist).toContain("- [ ] quiz-me.zip");
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
