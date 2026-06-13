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

  describe("plan", () => {
    const skill = readSkill("plan");

    it("is a user-invocable skill named plan", () => {
      expect(skill).toMatch(/^name:\s*plan\s*$/m);
      expect(skill).toMatch(/^user-invocable:\s*true\s*$/m);
    });

    it("references the ExecPlan format guide (PLAN.md) and its living sections", () => {
      expect(skill).toMatch(/PLAN\.md/);
      expect(skill).toMatch(/Progress/);
      expect(skill).toMatch(/Decision Log/);
      expect(skill).toMatch(/Outcomes & Retrospective/);
    });

    it("defines acceptance criteria with proof methods and writes them to the Throughline", () => {
      expect(skill).toMatch(/acceptance_criteria/);
      expect(skill).toMatch(/proof_method/);
      expect(skill).toMatch(/[Nn]ever record an acceptance criterion without its proof method/);
    });

    it("does the walkthrough and gates on human approval", () => {
      expect(skill).toMatch(/Plan Walkthrough/);
      expect(skill).toMatch(/\/diagram/);
      expect(skill).toMatch(/[Aa]pproval gate/);
      expect(skill).toMatch(/[Nn]ever start implementing before the human approves/);
    });
  });

  describe("implement", () => {
    const skill = readSkill("implement");

    it("is renamed from execute and keeps the verify/review/commit chain", () => {
      expect(skill).toMatch(/^name:\s*implement\s*$/m);
      expect(skill).not.toMatch(/^name:\s*execute\s*$/m);
      expect(skill).toMatch(/\/verification-loop/);
      expect(skill).toMatch(/\/review-fanout/);
      expect(skill).toMatch(/\/commit/);
    });

    it("teaches the Context-Encapsulated implement stage with a structured result", () => {
      expect(skill).toMatch(/Context Encapsulation/);
      expect(skill).toMatch(/files_changed/);
      expect(skill).toMatch(/ac_status/);
      expect(skill).toMatch(/suggested_next_action/);
    });
  });

  describe("prove-it", () => {
    const skill = readSkill("prove-it");

    it("is a user-invocable skill named prove-it", () => {
      expect(skill).toMatch(/^name:\s*prove-it\s*$/m);
      expect(skill).toMatch(/^user-invocable:\s*true\s*$/m);
    });

    it("reads proof methods and writes a Proof Ledger with proposed statuses", () => {
      expect(skill).toMatch(/proof_method/);
      expect(skill).toMatch(/Proof Ledger/);
      expect(skill).toMatch(/needs-human/);
      expect(skill).toMatch(/[Pp]ropose;? .*never (render the final verdict|decide)/);
    });

    it("keeps the human as the final judge and avoids headless Chrome", () => {
      expect(skill).toMatch(/human disposes/);
      expect(skill).toMatch(/[Dd]o not commit/);
      expect(skill).toMatch(/headless Google Chrome/);
    });
  });
});
