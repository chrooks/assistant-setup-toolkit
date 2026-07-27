import { describe, expect, it } from "vitest";
import {
  buildDriftReports,
  parseProvenance,
  readAllProvenance,
  renderDriftReport,
  RELATIONSHIPS,
  type CommitFetcher,
  type DriftReport,
  type SkillProvenance,
} from "../../src/setup/provenance.js";

const repoRoot = process.cwd();

const wellFormed = `---
name: security-review
description: Review code for security vulnerabilities.
upstream:
  repo: affaan-m/everything-claude-code
  path: skills/security-review/SKILL.md
  ref: 7113b5bf63694b716f8b2413c5919824a82fc095
  relationship: near-copy
---

# Security Review
`;

const withoutUpstream = `---
name: commit
description: Write a commit message.
---

# Commit
`;

/**
 * Seam 1 — the exported functions of src/setup/provenance.ts. Parsing,
 * validation and report-shaping are all pure, and the network is injected, so
 * everything below runs without one.
 */
describe("parseProvenance — reading the record (AC1, AC2)", () => {
  it("returns null when a Skill declares no upstream", () => {
    expect(parseProvenance("commit", withoutUpstream)).toBeNull();
  });

  it("returns null when there is no frontmatter at all", () => {
    expect(parseProvenance("stray", "# Just a heading\n")).toBeNull();
  });

  it("parses a well-formed block into every field", () => {
    expect(parseProvenance("security-review", wellFormed)).toEqual({
      skill: "security-review",
      repo: "affaan-m/everything-claude-code",
      path: "skills/security-review/SKILL.md",
      ref: "7113b5bf63694b716f8b2413c5919824a82fc095",
      relationship: "near-copy",
    } satisfies SkillProvenance);
  });

  it("throws, naming the Skill, for a relationship outside the four values", () => {
    // `near_copy` with an underscore is the likeliest hand-edit typo.
    const typo = wellFormed.replace("relationship: near-copy", "relationship: near_copy");

    expect(() => parseProvenance("security-review", typo)).toThrowError(
      /Skill "security-review".*near_copy/s,
    );
  });

  it("throws, naming the Skill, when ref is missing", () => {
    const missing = wellFormed.replace(
      "  ref: 7113b5bf63694b716f8b2413c5919824a82fc095\n",
      "",
    );

    expect(() => parseProvenance("security-review", missing)).toThrowError(
      /Skill "security-review".*upstream\.ref/s,
    );
  });

  it("throws when upstream is a bare value rather than a block", () => {
    const bare = withoutUpstream.replace(
      "description: Write a commit message.",
      "description: Write a commit message.\nupstream: ECC",
    );

    expect(() => parseProvenance("commit", bare)).toThrowError(/key\/value pairs/);
  });
});

describe("readAllProvenance — the real canonical tree (AC1, AC3)", () => {
  it("finds every tracked Skill with all four fields populated", async () => {
    const records = await readAllProvenance(repoRoot);

    expect(records.length).toBeGreaterThanOrEqual(10);
    for (const record of records) {
      expect(record.repo, record.skill).toMatch(/^[\w.-]+\/[\w.-]+$/);
      expect(record.path, record.skill).toMatch(/SKILL\.md$/);
    }
  });

  it("records a full commit hash as every ref", async () => {
    const records = await readAllProvenance(repoRoot);

    for (const record of records) {
      expect(record.ref, record.skill).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it("declares only the four allowed relationships", async () => {
    const records = await readAllProvenance(repoRoot);

    for (const record of records) {
      expect(RELATIONSHIPS, record.skill).toContain(record.relationship);
    }
  });

  it("tracks the wrapper and the two verbatim copies", async () => {
    const records = await readAllProvenance(repoRoot);
    const byName = new Map(records.map((r) => [r.skill, r]));

    expect(byName.get("grill-me")?.relationship).toBe("wrapper");
    expect(byName.get("visual-plan")?.relationship).toBe("verbatim");
    expect(byName.get("visual-recap")?.relationship).toBe("verbatim");
    // grill-with-docs was a wrapper until upstream gutted its body down to a
    // one-line delegation; the local file is the real implementation now.
    expect(byName.get("grill-with-docs")?.relationship).toBe("rewrite");
  });
});

const record = (
  skill: string,
  relationship: SkillProvenance["relationship"],
): SkillProvenance => ({
  skill,
  repo: "owner/repo",
  path: `skills/${skill}/SKILL.md`,
  ref: "0".repeat(40),
  relationship,
});

describe("buildDriftReports — upstream-then vs upstream-now (AC5, AC6)", () => {
  it("reports current when the fetcher finds no commits", async () => {
    const fetcher: CommitFetcher = async () => [];

    const [report] = await buildDriftReports([record("deep-research", "near-copy")], fetcher);

    expect(report.status).toEqual({ kind: "current" });
  });

  it("reports moved, carrying every commit the fetcher returned", async () => {
    const commits = ["3a46c82 update Prisma patterns", "db7f2a6 move origin under metadata"];
    const fetcher: CommitFetcher = async () => commits;

    const [report] = await buildDriftReports([record("security-review", "near-copy")], fetcher);

    expect(report.status).toEqual({ kind: "moved", commits });
  });

  it("reports path-missing when the fetcher returns null", async () => {
    const fetcher: CommitFetcher = async () => null;

    const [report] = await buildDriftReports([record("review-fanout", "near-copy")], fetcher);

    expect(report.status).toEqual({ kind: "path-missing" });
  });

  it("asks upstream only about the recorded repo, path and ref", async () => {
    const asked: Array<[string, string, string]> = [];
    const fetcher: CommitFetcher = async (repo, filePath, sinceRef) => {
      asked.push([repo, filePath, sinceRef]);
      return [];
    };

    await buildDriftReports([record("grill-me", "wrapper")], fetcher);

    // No local file content is read anywhere in the comparison.
    expect(asked).toEqual([["owner/repo", "skills/grill-me/SKILL.md", "0".repeat(40)]]);
  });
});

const moved = (skill: string, relationship: DriftReport["relationship"]): DriftReport => ({
  skill,
  relationship,
  status: { kind: "moved", commits: ["abc1234 did a thing"] },
});

describe("renderDriftReport — what a human reads (AC6)", () => {
  it("puts path-missing above moved so it is not buried", () => {
    const out = renderDriftReport([
      moved("security-review", "near-copy"),
      { skill: "review-fanout", relationship: "rewrite", status: { kind: "path-missing" } },
    ]);

    expect(out.indexOf("review-fanout")).toBeLessThan(out.indexOf("security-review"));
    expect(out).toMatch(/PATH MISSING UPSTREAM/);
  });

  it("prints the guidance that matches each relationship", () => {
    const out = renderDriftReport([
      moved("visual-plan", "verbatim"),
      moved("security-review", "near-copy"),
      moved("verification-loop", "rewrite"),
      moved("grill-me", "wrapper"),
    ]);

    expect(out).toContain("byte-identical");
    expect(out).toContain("port the change by hand");
    expect(out).toContain("review for interest only");
    expect(out).toContain("wrapped Skill's contract moved");
  });

  it("lists the commits under the Skill that moved", () => {
    const out = renderDriftReport([moved("security-review", "near-copy")]);

    expect(out).toContain("abc1234 did a thing");
  });

  it("says so plainly when nothing has drifted", () => {
    const out = renderDriftReport([
      { skill: "deep-research", relationship: "near-copy", status: { kind: "current" } },
    ]);

    expect(out).toContain("All 1 tracked Skills are up to date.");
  });
});
