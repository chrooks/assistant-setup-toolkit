import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const hookPath = path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.sh");

function runReminderHook(input: unknown): {
  stdout: string;
  stderr: string;
  status: number | null;
} {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "lexicon-reminder-"));
  try {
    const result = spawnSync("bash", [hookPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: tempHome,
        CLAUDE_LEXICON_REMINDER: "1",
      },
      input: JSON.stringify(input),
      encoding: "utf-8",
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      status: result.status,
    };
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
}

describe("Lexicon reminder", () => {
  it("coaches corrections instead of requiring repeated term definitions", async () => {
    const instructions = await readFile(
      path.join(repoRoot, "canonical", "CLAUDE.md"),
      "utf-8",
    );
    const hook = await readFile(
      path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.sh"),
      "utf-8",
    );

    expect(instructions).not.toMatch(/define each term on first use/i);
    expect(hook).not.toMatch(/define each term on first use/i);
    expect(instructions).toMatch(/correct .*misuse/i);
    expect(instructions).toMatch(/fail to use/i);
    expect(hook).toMatch(/correct .*misuse/i);
    expect(hook).toMatch(/fail to use/i);
    expect(hook).toContain("_Avoid_");
  });

  it("nudges list- and table-first communication", async () => {
    const instructions = await readFile(
      path.join(repoRoot, "canonical", "CLAUDE.md"),
      "utf-8",
    );
    const hook = await readFile(
      path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.sh"),
      "utf-8",
    );

    // The per-turn hook reminds about lists and routes quick tables/diagrams.
    expect(hook).toMatch(/list/i);
    expect(hook).toContain("/table md");
    expect(hook).toContain("/diagram md");

    // The session-start instructions carry the durable list/table/diagram preference.
    expect(instructions).toMatch(/List-, Table-, and Diagram-First Communication/i);
    expect(instructions).toContain("/table md");
    expect(instructions).toContain("/table html");
    expect(instructions).toContain("/diagram md");
    expect(instructions).toContain("/diagram html");
    expect(instructions).toMatch(/two trailing spaces/i);
  });

  it("stays quiet for Codex UserPromptSubmit input", () => {
    const result = runReminderHook({
      turn_id: "turn-test",
      prompt: "hello",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("emits Claude Code UserPromptSubmit context in the flat shape", () => {
    const result = runReminderHook({
      session_id: "session-test",
      hook_event_name: "UserPromptSubmit",
      user_prompt: "hello",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout);
    expect(payload.suppressOutput).toBe(true);
    expect(payload.additionalContext).toContain("Lexicon reminder");
    expect(payload.hookSpecificOutput).toBeUndefined();
  });
});
