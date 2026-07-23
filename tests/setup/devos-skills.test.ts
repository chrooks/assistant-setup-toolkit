import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readSkill(name: string): string {
  return readFileSync(path.join(repoRoot, "canonical", "skills", name, "SKILL.md"), "utf-8");
}

function readTemplate(): string {
  return readFileSync(
    path.join(repoRoot, "canonical", "skills", "dev", "throughline-template.md"),
    "utf-8",
  );
}

function readModelResolution(): string {
  return readFileSync(
    path.join(repoRoot, "canonical", "skills", "dev", "model-resolution.md"),
    "utf-8",
  );
}

describe("DevOS-conformed stage skills", () => {
  describe("dev (Conductor) — Context Encapsulation dispatch", () => {
    const skill = readSkill("dev");

    it("dispatches work stages as tier-tagged Agent sub-agents (ac-m5-1)", () => {
      expect(skill).toMatch(/Context Encapsulation/);
      expect(skill).toMatch(/build-heavy/);
      expect(skill).toMatch(/build-light/);
      expect(skill).toMatch(/model-resolution\.md/);
      expect(skill).toMatch(/[Ss]pawn .*Agent/);
    });

    it("sets the Agent model param from the tier, not just prompt text (ac-m5-1)", () => {
      expect(skill).toMatch(/`model` parameter/);
      expect(skill).toMatch(/unset is a[\s\S]*?defect/);
      expect(skill).toMatch(/inherits the[\s\S]*?main model/);
    });

    it("requires a fenced JSON result and names itself sole writer (ac-m5-2)", () => {
      expect(skill).toMatch(/fenced JSON/);
      expect(skill).toMatch(/files_changed/);
      expect(skill).toMatch(/ac_status/);
      expect(skill).toMatch(/suggested_next_action/);
      expect(skill).toMatch(/sole writer/);
    });

    it("documents the write-back map (ac-m5-3)", () => {
      expect(skill).toMatch(/write-back map/);
      expect(skill).toMatch(/acceptance_criteria\[\]\.status/);
      expect(skill).toMatch(/## Proof Ledger/);
      expect(skill).toMatch(/## Work Log/);
    });

    it("guards the assess gate against auto-advance (ac-m5-4)", () => {
      expect(skill).toMatch(/assess gate/);
      expect(skill).toMatch(/stop for the human/i);
      expect(skill).toMatch(/[Nn]ever\s+auto-run assess or close/);
    });
  });

  describe("dev (Conductor) — assess back-edge", () => {
    const skill = readSkill("dev");

    it("partial-reopens only the failed ACs on a bounce (ac-m6-1)", () => {
      expect(skill).toMatch(/[Pp]artial reopen/);
      expect(skill).toMatch(/only.*those ACs back to `status: pending`|only the `pending`/i);
      expect(skill).toMatch(/[Nn]ever reopen the whole run/);
    });

    it("routes the back-edge to implement only, deferring diagnose (ac-m6-2)", () => {
      expect(skill).toMatch(/back-edge always points at `implement`/);
      expect(skill).toMatch(/[Dd]o not branch to `diagnose`/);
    });

    it("documents the soft loop guard at threshold 3 (ac-m6-3)", () => {
      expect(skill).toMatch(/bounces.*reaches 3|threshold 3/i);
      expect(skill).toMatch(/re-grill[\s\S]*re-scope[\s\S]*accept-with-caveat/);
      expect(skill).toMatch(/soft stop, not a hard wall/);
    });

    it("keeps assess the single gate: pass→close, fail→reopen+stop (ac-m6-5)", () => {
      expect(skill).toMatch(/[Aa]ll pass.*close/);
      expect(skill).toMatch(/human disposes/);
      expect(skill).toMatch(/[Dd]o not auto-dispatch/);
      expect(skill).toMatch(/Increment the `bounces` counter/);
    });

    it("defines the afk autonomy mode and its three halt conditions", () => {
      expect(skill).toMatch(/Autonomy: gated vs\. afk/);
      expect(skill).toMatch(/mechanical gate/i);
      expect(skill).toMatch(/scope . grill . plan . implement . prove/);
      // the three human "bother me" conditions
      expect(skill).toMatch(/genuine design decision/i);
      expect(skill).toMatch(/assess.*always a human stop|always human stops/i);
      expect(skill).toMatch(/[Uu]nexpected failure/);
      // afk never crosses the assess/close gate
      expect(skill).toMatch(/never crosses the assess gate|never auto-runs `close`/);
    });

    it("threads design through the lifecycle for user-facing Surfaces", () => {
      expect(skill).toMatch(/design is a first-class thread/i);
      expect(skill).toMatch(/user-facing \*\*Surface\*\*|user-facing Surface/);
      expect(skill).toMatch(/\/impeccable/);
      expect(skill).toMatch(/\/design-audit/);
      expect(skill).toMatch(/[Bb]ackend-only work skips/);
    });

    it("resolves the model via the shared table, inlines no vendor name, and states the choice", () => {
      expect(skill).toMatch(/model-resolution\.md/);
      expect(skill).not.toMatch(/haiku/i);
      expect(skill).toMatch(/unset is a[\s\S]*?defect/);
      expect(skill).toMatch(/State the choice/);
    });

    it("proposes parallel-vs-serial batches on multi-issue runs", () => {
      expect(skill).toMatch(/Multi-issue runs/);
      expect(skill).toMatch(/disjoint paths|disjoint files/);
      expect(skill).toMatch(/own Throughline/);
    });
  });

  describe("model-resolution — runtime-agnostic tier table", () => {
    const table = readModelResolution();

    it("is runtime-agnostic: capability roles, both runtime columns", () => {
      expect(table).toMatch(/plan\/think/);
      expect(table).toMatch(/build-heavy/);
      expect(table).toMatch(/build-light/);
      expect(table).toMatch(/Claude Code/);
      expect(table).toMatch(/Codex/);
    });

    it("puts the frontier reasoning model on plan/think for both runtimes", () => {
      expect(table).toMatch(/fable/i);
      expect(table).toMatch(/Sol/);
      expect(table).toMatch(/plan.*context-gathering|planning and information/i);
    });

    it("floors work stages at the workhorse tier and bans the cheap tier", () => {
      expect(table).toMatch(/build-light.*floor|floor.*build-light/i);
      expect(table).toMatch(/sonnet/i);
      expect(table).toMatch(/Terra/);
      expect(table).toMatch(/never.*Haiku|Haiku.*Luna|~~/i);
    });

    it("keeps effort a real knob on Codex and prompt-folded on Claude Code", () => {
      expect(table).toMatch(/Codex.*effort.*real|effort.*real dispatch knob/i);
      expect(table).toMatch(/Claude Code.*fold|fold.*prompt/i);
    });
  });

  describe("throughline template — autonomy field", () => {
    const template = readTemplate();

    it("carries an autonomy field defaulting to gated", () => {
      expect(template).toMatch(/autonomy: gated/);
      expect(template).toMatch(/gated\|afk/);
    });
  });

  describe("throughline template — Work Log + Assessment Log", () => {
    const template = readTemplate();

    it("adds a Work Log section without dropping the others (ac-m5-7)", () => {
      expect(template).toMatch(/## Work Log/);
      expect(template).toMatch(/## Decision Ledger/);
      expect(template).toMatch(/## Plan Walkthrough/);
      expect(template).toMatch(/## Proof Ledger/);
    });

    it("bumps the contract to v2 with bounces and an Assessment Log (ac-m6-4)", () => {
      expect(template).toMatch(/devos_version:\s*2/);
      expect(template).toMatch(/^bounces:\s*0/m);
      expect(template).toMatch(/## Assessment Log/);
    });
  });

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
      // Rounds, not one-at-a-time: batch independent questions, take one reply,
      // build the next round from it. Dependency ordering is what keeps it safe.
      expect(skill).toMatch(/dependency-ordered rounds/i);
      expect(skill).toMatch(/not one question at a time/i);
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

    it("resolves the model via the shared table with no inline vendor name", () => {
      expect(skill).toMatch(/model-resolution\.md/);
      expect(skill).toMatch(/build-heavy/);
      expect(skill).toMatch(/build-light/);
      expect(skill).not.toMatch(/haiku/i);
    });

    it("teaches the Context-Encapsulated implement stage with a structured result", () => {
      expect(skill).toMatch(/Context Encapsulation/);
      expect(skill).toMatch(/files_changed/);
      expect(skill).toMatch(/ac_status/);
      expect(skill).toMatch(/suggested_next_action/);
    });

    it("returns a fenced JSON result and is honest about effort per runtime (ac-m5-2, ac-m5-5)", () => {
      expect(skill).toMatch(/fenced JSON/);
      expect(skill).toMatch(/model-resolution\.md/);
      expect(skill).toMatch(/Codex/);
      expect(skill).toMatch(/Claude\s+Code/);
      expect(skill).toMatch(/[Ee]ffort\s+honesty/);
    });

    it("scopes re-entry work to the reopened ACs after a bounce (ac-m6-6)", () => {
      expect(skill).toMatch(/re-entry after an assess bounce/);
      expect(skill).toMatch(/work\s+only the `pending` ACs/);
      expect(skill).toMatch(/flag any passed AC/);
    });
  });

  describe("prove-it", () => {
    const skill = readSkill("prove-it");

    it("is a user-invocable skill named prove-it", () => {
      expect(skill).toMatch(/^name:\s*prove-it\s*$/m);
      expect(skill).toMatch(/^user-invocable:\s*true\s*$/m);
    });

    it("resolves the model via the shared table with no inline vendor name", () => {
      expect(skill).toMatch(/model-resolution\.md/);
      expect(skill).toMatch(/build-heavy/);
      expect(skill).toMatch(/build-light/);
      expect(skill).not.toMatch(/haiku/i);
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

    it("returns a fenced JSON result and is honest about effort per runtime (ac-m5-2, ac-m5-5)", () => {
      expect(skill).toMatch(/fenced JSON/);
      expect(skill).toMatch(/model-resolution\.md/);
      expect(skill).toMatch(/Codex/);
      expect(skill).toMatch(/Claude\s+Code/);
      expect(skill).toMatch(/[Ee]ffort\s+honesty/);
    });

    it("re-proves only reopened plus flagged ACs after a bounce (ac-m6-6)", () => {
      expect(skill).toMatch(/re-prove after an assess bounce/);
      expect(skill).toMatch(/reopened \(`status: pending`\) criteria plus any/);
    });
  });
});
