import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readSkill(name: string): string {
  return readFileSync(path.join(repoRoot, "canonical", "skills", name, "SKILL.md"), "utf-8");
}

describe("DevOS-conformed stage skills", () => {
  describe("scope", () => {
    const skill = readSkill("scope");

    it("keeps its slug and stays user-invocable", () => {
      expect(skill).toMatch(/^name:\s*scope\s*$/m);
      expect(skill).toMatch(/^user-invocable:\s*true\s*$/m);
    });

    it("teaches the sizing verdict: Meaningful Decisions, Grillable, Effort Tier", () => {
      expect(skill).toMatch(/Meaningful Decision/);
      expect(skill).toMatch(/Grillable/);
      expect(skill).toMatch(/Effort Tier/);
    });

    it("teaches writing the verdict into the Throughline frontmatter", () => {
      expect(skill).toMatch(/Throughline/);
      expect(skill).toMatch(/grillable/);
      expect(skill).toMatch(/\btier\b/);
      expect(skill).toMatch(/\beffort\b/);
      expect(skill).toMatch(/next_action/);
    });

    it("enforces the proof-method-per-criterion invariant on the skip-path", () => {
      expect(skill).toMatch(/proof_method/);
      expect(skill).toMatch(/[Nn]ever record an acceptance criterion without its proof method/);
    });
  });

  describe("grill-me", () => {
    const skill = readSkill("grill-me");

    it("keeps its slug and relentless-interview behavior", () => {
      expect(skill).toMatch(/^name:\s*grill-me\s*$/m);
      expect(skill).toMatch(/[Ii]nterview me relentlessly/);
      expect(skill).toMatch(/one at a time/i);
    });

    it("teaches appending resolved decisions to the Decision Ledger", () => {
      expect(skill).toMatch(/Decision Ledger/);
      expect(skill).toMatch(/Meaningful Decision/);
      expect(skill).toMatch(/rationale/);
      expect(skill).toMatch(/[Aa]ppend as you go/);
    });

    it("hands off via next_action to plan or the implement stage", () => {
      expect(skill).toMatch(/next_action/);
      expect(skill).toMatch(/\/plan/);
    });
  });
});
