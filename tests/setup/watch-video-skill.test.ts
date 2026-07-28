import { readFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkillDirs } from "../../src/setup/index.js";

const repoRoot = process.cwd();
const skillDir = path.join(repoRoot, "canonical", "skills", "watch-video");
const skillPath = path.join(skillDir, "SKILL.md");

describe("watch-video Skill", () => {
  // AC9 — registration and naming.
  it("registers as a canonical Skill named watch-video", async () => {
    const skills = await discoverSkillDirs(repoRoot);
    expect(skills.map((skill) => skill.name)).toContain("watch-video");
  });

  it("declares frontmatter matching its directory", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/^---\n/);
    expect(skill).toContain("name: watch-video");
    expect(skill).toMatch(/description: .+/);
  });

  it("names the trigger phrases that should reach it", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/watch this video/i);
    expect(skill).toMatch(/load this video/i);
    expect(skill).toMatch(/youtube/i);
  });

  // The mechanical pipeline must be delegated, not reimplemented in prose.
  it("points at the script rather than describing the pipeline inline", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("scripts/video.mjs");
    expect(fs.existsSync(path.join(skillDir, "scripts", "video.mjs"))).toBe(true);
  });

  it("documents the manifest as the thing everything downstream reads", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("manifest.json");
    for (const key of ["transcript.status", "frames", "grids", "budget", "cellTimes"]) {
      expect(skill).toContain(key);
    }
  });

  // AC8 — the gate that must never degrade silently.
  it("documents the stop-and-confirm gate when no transcript exists", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/stop and ask the user to confirm/i);
    expect(skill).toMatch(/do not silently proceed/i);
    expect(skill).toContain('`none`');
  });

  it("tells the model to read grids rather than individual frames", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/Read.*grids/i);
    expect(skill).toMatch(/do \*\*not\*\* read the individual/i);
    expect(skill).toMatch(/row-major/i);
  });

  // AC9 — the brief's contract.
  it("specifies what the brief must contain", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/header line/i);
    expect(skill).toMatch(/sampling disclosure/i);
    expect(skill).toMatch(/cache path/i);
    expect(skill).toMatch(/loaded and ready/i);
    expect(skill).toContain("/ingest");
  });

  it("requires honest sampling disclosure rather than implying full coverage", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/never imply complete coverage/i);
    expect(skill).toContain("framesKept");
    expect(skill).toContain("framesFound");
  });

  // AC7 — documented, not just enforced in code.
  it("documents that playlists are rejected", async () => {
    const skill = await readFile(skillPath, "utf-8");
    expect(skill).toMatch(/playlist/i);
  });

  it("states it is a loader that does not write to the knowledge base", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toMatch(/does not (write|commit)/i);
    expect(skill).toMatch(/loader, not an essay/i);
  });

  it("warns that scene detection is luma-weighted and can miss cuts", async () => {
    const skill = await readFile(skillPath, "utf-8");
    expect(skill).toMatch(/luma/i);
  });

  it("names faster-whisper and warns against mlx-whisper", async () => {
    const skill = await readFile(skillPath, "utf-8");

    expect(skill).toContain("faster-whisper");
    expect(skill).toMatch(/never.*mlx-whisper|mlx-whisper.*Apple-Silicon-only/i);
  });
});
