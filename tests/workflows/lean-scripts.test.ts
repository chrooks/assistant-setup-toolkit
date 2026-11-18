/**
 * Stub harness for the saved Workflow scripts in canonical/workflows/.
 *
 * A Workflow script is not a plain ES module: the harness runs its body in an
 * async context with agent/parallel/pipeline/phase/log/args as globals, and a
 * top-level `return` is the result. We mimic that: rewrite
 * `export const meta =` into a capture, then run the source as an
 * AsyncFunction body whose parameters are the stubbed globals.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Opts = {
  model?: string;
  effort?: string;
  schema?: Record<string, unknown>;
  phase?: string;
  agentType?: string;
};
type Call = { prompt: string; opts: Opts };

const WORKFLOWS_DIR = path.resolve(__dirname, "../../canonical/workflows");

/** Build the smallest value a JSON Schema accepts: arrays get one item. */
function fromSchema(schema: Record<string, unknown>): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0];
  switch (schema.type) {
    case "object": {
      const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      return Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, fromSchema(v)]),
      );
    }
    case "array":
      return [fromSchema((schema.items ?? {}) as Record<string, unknown>)];
    case "string":
      return "x";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

async function runScript(name: string, args: unknown) {
  const source = await readFile(path.join(WORKFLOWS_DIR, `${name}.js`), "utf-8");
  const body = source.replace(/export const meta\s*=/, "const meta = __m.meta =");
  const calls: Call[] = [];
  const agent = async (prompt: string, opts: Opts = {}) => {
    calls.push({ prompt, opts });
    return opts.schema ? fromSchema(opts.schema) : "x";
  };
  const parallel = (thunks: Array<() => Promise<unknown>>) =>
    Promise.all(thunks.map((t) => t().catch(() => null)));
  const pipeline = (items: unknown[], ...stages: Array<(...a: unknown[]) => unknown>) =>
    Promise.all(
      items.map(async (item, i) => {
        let prev: unknown = item;
        for (const stage of stages) prev = await stage(prev, item, i);
        return prev;
      }),
    );
  const noop = () => {};
  const m: { meta?: { name?: string } } = {};
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const fn = new AsyncFunction(
    "__m", "agent", "parallel", "pipeline", "phase", "log", "args", "budget", "workflow",
    body,
  );
  const run = fn(m, agent, parallel, pipeline, noop, noop, args, { total: null }, noop);
  return { run, calls, meta: m };
}

const opusCount = (calls: Call[]) =>
  calls.filter((c) => c.opts.model === "opus").length;

const VALID_ARGS: Record<string, unknown> = {
  "lean-review": { target: "HEAD~1..HEAD" },
};
const EXPECTED_OPUS: Record<string, number> = {
  "lean-review": 0,
};

describe.each(Object.keys(VALID_ARGS))("workflow script %s", (name) => {
  it.each([undefined, {}])("throws on args %j before any agent starts", async (args) => {
    const { run, calls } = await runScript(name, args);
    await expect(run).rejects.toThrow(/args/);
    expect(calls).toHaveLength(0);
  });

  it("sets model, effort, and schema on every agent, with the expected Opus count", async () => {
    const { run, calls, meta } = await runScript(name, VALID_ARGS[name]);
    await run;
    expect(meta.meta?.name).toBe(name);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.opts.model, c.prompt.slice(0, 60)).toBeTruthy();
      expect(c.opts.effort, c.prompt.slice(0, 60)).toBeTruthy();
      expect(c.opts.schema, c.prompt.slice(0, 60)).toBeTruthy();
    }
    expect(opusCount(calls)).toBe(EXPECTED_OPUS[name]);
  });
});

describe("lean-review verifier fan-out", () => {
  it.each([
    [false, 1],
    [true, 3],
  ])("audit=%s runs %i verifier(s) per finding", async (audit, per) => {
    const { run, calls } = await runScript("lean-review", { target: "src/a.ts", audit });
    const result = await run;
    const verifies = calls.filter((c) => c.opts.phase === "Verify");
    expect(result.stats.deduped).toBeGreaterThan(0);
    expect(verifies).toHaveLength(per * result.stats.deduped);
  });

  it("adds an accessibility lens only when UI files are in scope, and treats unknown lenses as personas", async () => {
    const { run, calls } = await runScript("lean-review", {
      target: "src/a.ts",
      lenses: ["code", "Employer's counsel attacks this document"],
    });
    const result = await run;
    const finds = calls.filter((c) => c.opts.phase === "Find");
    expect(finds).toHaveLength(2);
    expect(finds.some((c) => c.prompt.includes("Employer's counsel"))).toBe(true);
    expect(result.lenses).not.toContain("accessibility");
  });
});
