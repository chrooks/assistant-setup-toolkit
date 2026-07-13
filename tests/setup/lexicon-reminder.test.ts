import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const hookPath = path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.js");

function runReminderHook(input: unknown): {
  stdout: string;
  stderr: string;
  status: number | null;
} {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "lexicon-reminder-"));
  try {
    const result = spawnSync(process.execPath, [hookPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: tempHome,
        USERPROFILE: tempHome,
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
      path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.js"),
      "utf-8",
    );

    expect(instructions).not.toMatch(/define each term on first use/i);
    expect(hook).not.toMatch(/define each term on first use/i);
    expect(instructions).toMatch(/correct .*misuse/i);
    expect(instructions).toMatch(/fails? to use/i);
    expect(hook).toMatch(/correct .*misuse/i);
    expect(hook).toMatch(/fail to use/i);
    expect(hook).toContain("_Avoid_");
  });

  it("nudges list-first communication and routes visuals through /visualize", async () => {
    const instructions = await readFile(
      path.join(repoRoot, "canonical", "CLAUDE.md"),
      "utf-8",
    );
    const hook = await readFile(
      path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.js"),
      "utf-8",
    );

    // The per-turn hook reminds about lists and routes visuals by concept-shape
    // through the /visualize umbrella (which renders via /table and /diagram).
    expect(hook).toMatch(/list/i);
    expect(hook).toContain("/visualize");
    expect(hook).toContain("/table");
    expect(hook).toContain("/diagram");

    // The session-start instructions carry the durable visualize-by-shape preference,
    // with /table and /diagram named as the concrete forms /visualize routes to.
    expect(instructions).toMatch(/Visualize by Concept-Shape/i);
    expect(instructions).toContain("/visualize");
    expect(instructions).toContain("/table md");
    expect(instructions).toContain("/table html");
    expect(instructions).toContain("/diagram md");
    expect(instructions).toContain("/diagram html");
    expect(instructions).toMatch(/two trailing spaces/i);
  });

  it("enforces the issue-reference link Contract in both surfaces", async () => {
    const instructions = await readFile(
      path.join(repoRoot, "canonical", "CLAUDE.md"),
      "utf-8",
    );
    const hook = await readFile(
      path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.js"),
      "utf-8",
    );

    expect(instructions).toMatch(/never a bare `?#5`?/i);
    expect(hook).toMatch(/never a bare #5/i);
  });

  it("places the operative plain-English style rule last in the hook injection", async () => {
    const hook = await readFile(
      path.join(repoRoot, "canonical", "hooks", "lexicon-reminder.js"),
      "utf-8",
    );

    const styleIdx = hook.indexOf("OPERATIVE STYLE RULE");
    const visualizeIdx = hook.indexOf("/visualize");
    const issueIdx = hook.indexOf("Issue references");
    const lexiconIdx = hook.indexOf("Lexicon reminder:");

    expect(styleIdx).toBeGreaterThan(-1);
    // The operative style rule must sit after the Lexicon, issue-link, and
    // visualize content so it lands at maximum recency before generation.
    expect(styleIdx).toBeGreaterThan(visualizeIdx);
    expect(styleIdx).toBeGreaterThan(issueIdx);
    // ...and after the Lexicon segment too, so it follows ALL other named
    // segments — not merely the issue + visualize ones.
    expect(lexiconIdx).toBeGreaterThan(-1);
    expect(styleIdx).toBeGreaterThan(lexiconIdx);

    // End-anchored: the operative style rule must be LITERALLY the final
    // segment of the REMINDER string. Extract the single-quoted REMINDER
    // assignment from the hook and assert its trimmed tail is the style
    // rule's closing phrase. Appending any new segment after it breaks this.
    const reminderMatch = hook.match(/const REMINDER =\s*"([\s\S]*?)";/);
    expect(reminderMatch).not.toBeNull();
    const reminder = reminderMatch![1].trim();

    // The operative style rule is the LAST thing in the REMINDER...
    expect(reminder.lastIndexOf("OPERATIVE STYLE RULE")).toBeGreaterThan(
      reminder.indexOf("/visualize"),
    );
    // ...and the REMINDER ends with that rule's closing phrase verbatim.
    expect(reminder.endsWith("code, commits, and PRs stay normal.")).toBe(true);
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
