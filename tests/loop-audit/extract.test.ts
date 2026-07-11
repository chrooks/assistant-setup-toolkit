import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, utimesSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTranscriptLines, extractArchive } from "../../src/loop-audit/extract.js";

const FIXTURES = join(__dirname, "fixtures");

const meta = { device: "macbook", project: "-Users-x-proj" };
const since = new Date("2026-01-01T00:00:00Z");

function userLine(text: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    type: "user",
    isSidechain: false,
    message: { role: "user", content: [{ type: "text", text }] },
    timestamp: "2026-06-12T14:32:50.914Z",
    cwd: "/Users/x/proj",
    sessionId: "sess-1",
    gitBranch: "main",
    ...overrides,
  });
}

describe("parseTranscriptLines", () => {
  it("keeps a genuine human turn with its metadata", () => {
    const { turns, dropped } = parseTranscriptLines([userLine("fix the bug please")], meta, since);

    expect(dropped).toBe(0);
    expect(turns).toEqual([
      {
        device: "macbook",
        project: "-Users-x-proj",
        sessionId: "sess-1",
        timestamp: "2026-06-12T14:32:50.914Z",
        cwd: "/Users/x/proj",
        gitBranch: "main",
        text: "fix the bug please",
      },
    ]);
  });

  it("drops tool_result user lines", () => {
    const line = userLine("", {
      message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] },
    });
    const { turns, dropped } = parseTranscriptLines([line], meta, since);
    expect(turns).toEqual([]);
    expect(dropped).toBe(1);
  });

  it("drops sidechain (subagent) turns", () => {
    const { turns, dropped } = parseTranscriptLines([userLine("agent prompt", { isSidechain: true })], meta, since);
    expect(turns).toEqual([]);
    expect(dropped).toBe(1);
  });

  it("drops meta lines", () => {
    const { turns } = parseTranscriptLines([userLine("caveat text", { isMeta: true })], meta, since);
    expect(turns).toEqual([]);
  });

  it("skips malformed JSON lines without throwing", () => {
    const { turns, dropped } = parseTranscriptLines(
      ["{not json", userLine("real message")],
      meta,
      since,
    );
    expect(turns).toHaveLength(1);
    expect(turns[0]!.text).toBe("real message");
    expect(dropped).toBe(1);
  });

  it("ignores non-user record types", () => {
    const queueOp = JSON.stringify({ type: "queue-operation", operation: "enqueue", timestamp: "2026-06-12T14:32:50.870Z" });
    const { turns, dropped } = parseTranscriptLines([queueOp], meta, since);
    expect(turns).toEqual([]);
    expect(dropped).toBe(0);
  });

  it("drops skill-invocation scaffolding turns", () => {
    const invocation = userLine("<command-message>plan</command-message>\n<command-name>/plan</command-name>");
    const stdout = userLine("<local-command-stdout>Compacted</local-command-stdout>");
    const { turns, dropped } = parseTranscriptLines([invocation, stdout], meta, since);
    expect(turns).toEqual([]);
    expect(dropped).toBe(2);
  });

  it("drops compact-continuation turns", () => {
    const line = userLine("This session is being continued from a previous conversation that ran out of context. The summary...");
    const { turns } = parseTranscriptLines([line], meta, since);
    expect(turns).toEqual([]);
  });

  it("drops turns that are only a system-reminder block", () => {
    const line = userLine("<system-reminder>\nBackground shell finished.\n</system-reminder>");
    const { turns, dropped } = parseTranscriptLines([line], meta, since);
    expect(turns).toEqual([]);
    expect(dropped).toBe(1);
  });

  it("strips appended system-reminder blocks but keeps the human text", () => {
    const line = userLine("use the shared helper instead\n<system-reminder>\nnag about todos\n</system-reminder>");
    const { turns } = parseTranscriptLines([line], meta, since);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.text).toBe("use the shared helper instead");
  });

  it("drops turns older than the window and keeps turns exactly at the boundary", () => {
    const old = userLine("ancient guidance", { timestamp: "2025-12-31T23:59:59.999Z" });
    const boundary = userLine("boundary guidance", { timestamp: "2026-01-01T00:00:00.000Z" });
    const { turns, dropped } = parseTranscriptLines([old, boundary], meta, since);
    expect(turns.map((t) => t.text)).toEqual(["boundary guidance"]);
    expect(dropped).toBe(1);
  });

  it("keeps user lines whose content is a plain string", () => {
    const line = userLine("", {
      message: { role: "user", content: "just a plain string prompt" },
    });
    const { turns } = parseTranscriptLines([line], meta, since);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.text).toBe("just a plain string prompt");
  });

  it("tolerates missing optional metadata fields", () => {
    const line = JSON.stringify({
      type: "user",
      message: { role: "user", content: [{ type: "text", text: "hello" }] },
      timestamp: "2026-06-12T14:32:50.914Z",
      sessionId: "sess-2",
    });
    const { turns } = parseTranscriptLines([line], meta, since);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.cwd).toBe("");
    expect(turns[0]!.gitBranch).toBe("");
  });

  it("keeps human text when an image precedes it in the content array", () => {
    const line = userLine("", {
      message: {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", data: "..." } },
          { type: "text", text: "here's the bug in the screenshot" },
        ],
      },
    });
    const { turns } = parseTranscriptLines([line], meta, since);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.text).toBe("here's the bug in the screenshot");
  });

  it("drops turns with unparseable timestamps", () => {
    const { turns, dropped } = parseTranscriptLines([userLine("hi", { timestamp: "garbage" })], meta, since);
    expect(turns).toEqual([]);
    expect(dropped).toBe(1);
  });

  it("strips an unterminated system-reminder block", () => {
    const line = userLine("real guidance\n<system-reminder>\ntruncated nag with no close tag");
    const { turns } = parseTranscriptLines([line], meta, since);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.text).toBe("real guidance");
  });

  it("keeps prose that merely quotes command scaffolding tags", () => {
    const line = userLine("the extractor should drop turns containing <command-name> tags at line start");
    const { turns } = parseTranscriptLines([line], meta, since);
    expect(turns).toHaveLength(1);
  });
});

describe("extractArchive", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "loop-audit-test-"));
    const projA = join(root, "macbook", "projects", "-Users-x-proj");
    const projB = join(root, "hestia", "projects", "-home-x-other");
    mkdirSync(projA, { recursive: true });
    mkdirSync(projB, { recursive: true });
    copyFileSync(join(FIXTURES, "session-basic.jsonl"), join(projA, "fix-basic.jsonl"));
    copyFileSync(join(FIXTURES, "session-noise.jsonl"), join(projB, "fix-noise.jsonl"));
    // one stale file: mtime far outside any reasonable window
    copyFileSync(join(FIXTURES, "session-basic.jsonl"), join(projB, "stale.jsonl"));
    utimesSync(join(projB, "stale.jsonl"), new Date("2020-01-01"), new Date("2020-01-01"));
    // one broken symlink: must be skipped, not crash the walk
    symlinkSync(join(root, "nonexistent-target.jsonl"), join(projB, "broken-link.jsonl"));
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("walks devices and projects, aggregates turns and honest stats", () => {
    const { turns, stats } = extractArchive(root, new Date("2026-01-01T00:00:00Z"));

    expect(stats.filesScanned).toBe(4); // incl. one broken symlink, skipped
    expect(stats.filesInWindow).toBe(2);
    expect(stats.turnsKept).toBe(3);
    expect(stats.turnsDropped).toBe(4);
    expect(stats.perDevice).toEqual({ macbook: 2, hestia: 1 });
    expect(stats.sessions).toBe(2);

    const texts = turns.map((t) => t.text).sort();
    expect(texts).toEqual([
      "always end files with a newline",
      "no, use the shared helper instead",
      "real guidance in a noisy session",
    ]);
    const noisy = turns.find((t) => t.sessionId === "fix-noise")!;
    expect(noisy.device).toBe("hestia");
    expect(noisy.project).toBe("-home-x-other");
  });
});
