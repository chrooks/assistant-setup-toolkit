import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const hookPath = path.join(repoRoot, "canonical", "hooks", "devos-steering.js");

const ACTIVE_THROUGHLINE = `---
devos_version: 1
project: chrooked-pokedex
issue: 2
slug: dex-table-controls
stage: scope
grillable: null
tier: null
effort: null
next_action: /grill-me 2
acceptance_criteria: []
status: in_progress
---

## Decision Ledger
`;

interface HookResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

let projectDir: string;
let homeDir: string;

beforeEach(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "devos-project-"));
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "devos-home-"));
});

afterEach(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });
});

function writeThroughline(contents: string): void {
  const dir = path.join(projectDir, "feature_requests");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "dex-table-controls-throughline.md"), contents);
}

function runHook(input: unknown, extraEnv: Record<string, string> = {}): HookResult {
  const result = spawnSync(process.execPath, [hookPath], {
    cwd: projectDir,
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir, ...extraEnv },
    input: JSON.stringify(input),
    encoding: "utf-8",
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function readDebugLog(): string {
  const logPath = path.join(homeDir, ".claude", "devos-steering.log");
  return fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf-8") : "";
}

describe("DevOS steering hook", () => {
  it("emits a steering line when an active Throughline exists", () => {
    writeThroughline(ACTIVE_THROUGHLINE);

    const result = runHook({
      session_id: "session-test",
      hook_event_name: "UserPromptSubmit",
      user_prompt: "hello",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as {
      suppressOutput: boolean;
      additionalContext: string;
    };
    expect(payload.suppressOutput).toBe(true);
    expect(payload.additionalContext).toContain("dex-table-controls");
    expect(payload.additionalContext).toContain("stage=scope");
    expect(payload.additionalContext).toContain("next=/grill-me 2");
  });

  it("stays silent when no Throughline exists", () => {
    const result = runHook({
      session_id: "session-test",
      hook_event_name: "UserPromptSubmit",
      user_prompt: "hello",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });

  it("stays silent when the only Throughline is done", () => {
    writeThroughline(ACTIVE_THROUGHLINE.replace("status: in_progress", "status: done"));

    const result = runHook({
      session_id: "session-test",
      hook_event_name: "UserPromptSubmit",
      user_prompt: "hello",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("writes a 'fired' breadcrumb when debug is on and a run is active", () => {
    writeThroughline(ACTIVE_THROUGHLINE);

    const result = runHook(
      { session_id: "session-test", user_prompt: "hello" },
      { CLAUDE_DEVOS_STEERING_DEBUG: "1" },
    );

    expect(result.status).toBe(0);
    const log = readDebugLog();
    expect(log).toContain("fired:");
    expect(log).toContain("dex-table-controls");
    expect(log).toContain("stage=scope");
  });

  it("writes a 'silent' breadcrumb when debug is on and no run is active", () => {
    const result = runHook(
      { session_id: "session-test", user_prompt: "hello" },
      { CLAUDE_DEVOS_STEERING_DEBUG: "1" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(readDebugLog()).toContain("silent: no active throughline");
  });

  it("writes no breadcrumb when debug is off", () => {
    writeThroughline(ACTIVE_THROUGHLINE);

    runHook({ session_id: "session-test", user_prompt: "hello" });

    expect(readDebugLog()).toBe("");
  });

  it("stays quiet for Codex UserPromptSubmit input even with an active run", () => {
    writeThroughline(ACTIVE_THROUGHLINE);

    const result = runHook({ turn_id: "turn-test", prompt: "hello" });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe("");
  });
});
