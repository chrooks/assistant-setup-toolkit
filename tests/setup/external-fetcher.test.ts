import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  parseGitHubUrl,
  fetchExternalSource,
  fetchPlannedSources,
  type RunGit,
} from "../../src/setup/external-fetcher.js";
import type { ExternalSource } from "../../src/setup/manifest.js";

// -- Helpers --

/**
 * Build a fake `runGit` that, on `git clone <url> <dest>`, materializes a
 * pre-defined fixture tree under <dest>. Lets tests drive layout-sensitive
 * mapping logic without touching the network or git binary.
 */
function makeFakeGit(
  fixtures: Record<string, Record<string, string>>,
): RunGit {
  return async (args, _cwd) => {
    if (args[0] !== "clone") {
      throw new Error(`unexpected git args: ${args.join(" ")}`);
    }
    // Last positional arg is the destination dir.
    const dest = args[args.length - 1];
    const url = args[args.length - 2];
    const fixture = fixtures[url];
    if (!fixture) {
      throw new Error(`no fixture registered for ${url}`);
    }
    await fs.mkdir(dest, { recursive: true });
    for (const [relPath, content] of Object.entries(fixture)) {
      const full = path.join(dest, relPath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf-8");
    }
    return { stdout: "", stderr: "" };
  };
}

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), "ext-fetcher-test-"));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

// -- parseGitHubUrl --

describe("parseGitHubUrl", () => {
  it("parses bare repo URL", () => {
    const r = parseGitHubUrl("https://github.com/owner/repo");
    expect(r).toEqual({ owner: "owner", repo: "repo" });
  });

  it("strips .git suffix", () => {
    const r = parseGitHubUrl("https://github.com/owner/repo.git");
    expect(r.repo).toBe("repo");
  });

  it("parses /tree/<ref>", () => {
    const r = parseGitHubUrl("https://github.com/owner/repo/tree/main");
    expect(r).toEqual({ owner: "owner", repo: "repo", ref: "main" });
  });

  it("parses /tree/<ref>/<subpath>", () => {
    const r = parseGitHubUrl(
      "https://github.com/vercel-labs/skills/tree/main/skills/find-skills",
    );
    expect(r).toEqual({
      owner: "vercel-labs",
      repo: "skills",
      ref: "main",
      subpath: "skills/find-skills",
    });
  });

  it("rejects non-github hosts", () => {
    expect(() => parseGitHubUrl("https://gitlab.com/owner/repo")).toThrow();
  });
});

// -- fetchExternalSource — skill kind --

describe("pinned External Sources", () => {
  const PIN = "0123456789abcdef0123456789abcdef01234567";

  it("fetches exactly the pinned commit instead of cloning the branch tip", async () => {
    const calls: string[][] = [];
    const runGit: RunGit = async (args) => {
      calls.push([...args]);
      if (args[0] === "clone") throw new Error("a pinned source must not clone the tip");
      if (args[0] === "init") await fs.mkdir(args[args.length - 1], { recursive: true });
      if (args.includes("fetch")) {
        const dir = args[args.indexOf("-C") + 1];
        await fs.mkdir(path.join(dir, "skills", "pinned-skill"), { recursive: true });
        await fs.writeFile(path.join(dir, "skills", "pinned-skill", "SKILL.md"), "---\nname: pinned-skill\n---\n");
      }
      return { stdout: "", stderr: "" };
    };
    const source: ExternalSource = {
      id: "pinned",
      name: "Pinned pack",
      kind: "skill-pack",
      url: "https://github.com/owner/repo/tree/main/skills",
      commit: PIN,
      default: true,
      targets: ["claude-code"],
    };

    const result = await fetchExternalSource(source, workDir, runGit);

    expect(result.error).toBeUndefined();
    expect(result.files.map((f) => f.relativePath)).toEqual(["skills/pinned-skill/SKILL.md"]);
    const fetchCall = calls.find((c) => c.includes("fetch"))!;
    expect(fetchCall).toEqual(expect.arrayContaining(["--depth", "1", "https://github.com/owner/repo.git", PIN]));
    expect(calls.some((c) => c.includes("checkout") && c.includes("FETCH_HEAD"))).toBe(true);
  });
});

describe("fetchExternalSource (skill)", () => {
  it("maps a single-skill repo to skills/<id>/...", async () => {
    const source: ExternalSource = {
      id: "my-skill",
      name: "My Skill",
      kind: "skill",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": {
        "SKILL.md": "# skill",
        "REFERENCE.md": "ref",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);

    expect(result.error).toBeUndefined();
    const rels = result.files.map((f) => f.relativePath).sort();
    expect(rels).toEqual(["skills/my-skill/REFERENCE.md", "skills/my-skill/SKILL.md"]);
    for (const f of result.files) {
      expect(f.component).toBe("skills");
      expect(f.origin).toBe("external-source");
    }
  });

  it("honors subpath when URL is /tree/<ref>/<subpath>", async () => {
    const source: ExternalSource = {
      id: "find-skills",
      name: "find-skills",
      kind: "skill",
      url: "https://github.com/vercel-labs/skills/tree/main/skills/find-skills",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/vercel-labs/skills.git": {
        "skills/find-skills/SKILL.md": "# find",
        "skills/find-skills/PROMPT.md": "p",
        "skills/other-skill/SKILL.md": "should not be included",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);

    expect(result.error).toBeUndefined();
    const rels = result.files.map((f) => f.relativePath).sort();
    expect(rels).toEqual([
      "skills/find-skills/PROMPT.md",
      "skills/find-skills/SKILL.md",
    ]);
  });

  it("falls back to nested SKILL.md dir when root has none", async () => {
    const source: ExternalSource = {
      id: "wrapped",
      name: "wrapped",
      kind: "skill",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": {
        "README.md": "# root",
        "wrapped/SKILL.md": "# real skill",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    expect(result.error).toBeUndefined();
    expect(result.files.map((f) => f.relativePath)).toContain(
      "skills/wrapped/SKILL.md",
    );
  });

  it("reports error when repo has no SKILL.md", async () => {
    const source: ExternalSource = {
      id: "broken",
      name: "broken",
      kind: "skill",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": { "README.md": "no skill here" },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    expect(result.error).toMatch(/SKILL\.md/);
    expect(result.files).toEqual([]);
  });
});

// -- fetchExternalSource — skill-pack kind --

describe("fetchExternalSource (skill-pack)", () => {
  it("maps each top-level skill dir to skills/<dirname>/...", async () => {
    const source: ExternalSource = {
      id: "pack",
      name: "pack",
      kind: "skill-pack",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": {
        "alpha/SKILL.md": "a",
        "beta/SKILL.md": "b",
        "beta/REFERENCE.md": "br",
        "README.md": "ignored — no SKILL.md sibling",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    expect(result.error).toBeUndefined();
    const rels = result.files.map((f) => f.relativePath).sort();
    expect(rels).toEqual([
      "skills/alpha/SKILL.md",
      "skills/beta/REFERENCE.md",
      "skills/beta/SKILL.md",
    ]);
  });

  it("descends into a top-level skills/ directory if present", async () => {
    const source: ExternalSource = {
      id: "pack",
      name: "pack",
      kind: "skill-pack",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": {
        "skills/foo/SKILL.md": "f",
        "skills/bar/SKILL.md": "b",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    const rels = result.files.map((f) => f.relativePath).sort();
    expect(rels).toEqual(["skills/bar/SKILL.md", "skills/foo/SKILL.md"]);
  });

  it("drops excluded skills entirely, including their supporting files", async () => {
    // A pack is otherwise all-or-nothing per group, forcing a choice between
    // standing updates and inheriting every skill the group happens to hold.
    const source: ExternalSource = {
      id: "pack",
      name: "pack",
      kind: "skill-pack",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
      exclude: ["unwanted"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": {
        "wanted/SKILL.md": "w",
        "unwanted/SKILL.md": "u",
        "unwanted/REFERENCE.md": "ur",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    expect(result.error).toBeUndefined();
    expect(result.files.map((f) => f.relativePath).sort()).toEqual([
      "skills/wanted/SKILL.md",
    ]);
  });

  it("excluding every skill is an error, not a silent empty install", async () => {
    const source: ExternalSource = {
      id: "pack",
      name: "pack",
      kind: "skill-pack",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
      exclude: ["only"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": { "only/SKILL.md": "o" },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    expect(result.error).toMatch(/contained no skills/);
  });
});

// -- fetchExternalSource — plugin kind --

describe("fetchExternalSource (plugin)", () => {
  it("maps known component dirs and ignores everything else", async () => {
    const source: ExternalSource = {
      id: "plug",
      name: "plug",
      kind: "plugin",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": {
        "skills/a/SKILL.md": "s",
        "commands/foo.md": "c",
        "hooks/bar.sh": "h",
        "agents/baz.md": "a",
        "rules/style.md": "r",
        "README.md": "ignored",
        "src/index.ts": "ignored",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    expect(result.error).toBeUndefined();
    const rels = result.files.map((f) => f.relativePath).sort();
    expect(rels).toEqual([
      "agents/baz.md",
      "commands/foo.md",
      "hooks/bar.sh",
      "rules/style.md",
      "skills/a/SKILL.md",
    ]);
    const byPath = Object.fromEntries(result.files.map((f) => [f.relativePath, f]));
    expect(byPath["commands/foo.md"].component).toBe("commands");
    expect(byPath["hooks/bar.sh"].component).toBe("hooks");
    expect(byPath["rules/style.md"].component).toBe("instructions");
    expect(byPath["agents/baz.md"].component).toBe("skills");
  });

  it("drops excluded skills, commands, and agents by name", async () => {
    const source: ExternalSource = {
      id: "plug",
      name: "plug",
      kind: "plugin",
      url: "https://github.com/o/r",
      default: true,
      targets: ["claude-code"],
      exclude: ["a", "foo", "baz"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/r.git": {
        "skills/a/SKILL.md": "s",
        "skills/a/ref.md": "s",
        "skills/keep/SKILL.md": "k",
        "commands/foo.md": "c",
        "commands/foo.toml": "c",
        "commands/keep.md": "k",
        "agents/baz.md": "a",
      },
    });

    const result = await fetchExternalSource(source, workDir, fakeGit);
    expect(result.error).toBeUndefined();
    expect(result.files.map((f) => f.relativePath).sort()).toEqual([
      "commands/keep.md",
      "skills/keep/SKILL.md",
    ]);
  });
});

// -- fetchPlannedSources aggregation --

describe("fetchPlannedSources", () => {
  it("aggregates files across multiple sources and surfaces per-source errors", async () => {
    const ok: ExternalSource = {
      id: "ok",
      name: "ok",
      kind: "skill",
      url: "https://github.com/o/ok",
      default: true,
      targets: ["claude-code"],
    };
    const bad: ExternalSource = {
      id: "bad",
      name: "bad",
      kind: "skill",
      url: "https://github.com/o/bad",
      default: true,
      targets: ["claude-code"],
    };
    const fakeGit = makeFakeGit({
      "https://github.com/o/ok.git": { "SKILL.md": "ok" },
      "https://github.com/o/bad.git": { "README.md": "no skill" },
    });

    const agg = await fetchPlannedSources([ok, bad], workDir, fakeGit);
    expect(agg.files.map((f) => f.relativePath)).toEqual(["skills/ok/SKILL.md"]);
    const errResult = agg.results.find((r) => r.sourceId === "bad");
    expect(errResult?.error).toBeDefined();
  });
});
