import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const hookPath = path.join(
  process.cwd(),
  "canonical",
  "hooks",
  "strategic-compact.js",
);

function runHook(
  sessionId: string,
  compactThreshold: string,
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({
      session_id: sessionId,
      hook_event_name: "PreToolUse",
      tool_name: "Edit",
    }),
    env: {
      ...process.env,
      COMPACT_THRESHOLD: compactThreshold,
    },
    encoding: "utf-8",
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function uniqueSessionId(label: string): string {
  return `vitest-${label}-${process.pid}-${Date.now()}-${Math.random()}`;
}

describe("strategic-compact hook", () => {
  it("runs when installed under a CommonJS hook directory", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "strategic-compact-cjs-"),
    );
    const hooksDir = path.join(tempDir, "hooks");
    const installedHook = path.join(hooksDir, "strategic-compact.js");

    try {
      fs.mkdirSync(hooksDir, { recursive: true });
      fs.writeFileSync(
        path.join(hooksDir, "package.json"),
        JSON.stringify({ type: "commonjs" }),
      );
      fs.copyFileSync(hookPath, installedHook);

      const result = spawnSync(process.execPath, [installedHook], {
        input: JSON.stringify({
          session_id: uniqueSessionId("commonjs"),
          hook_event_name: "PreToolUse",
          tool_name: "Edit",
        }),
        env: {
          ...process.env,
          COMPACT_THRESHOLD: "1",
        },
        encoding: "utf-8",
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toContain(
        "[StrategicCompact] 1 tool calls reached",
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does not warn before COMPACT_THRESHOLD is reached", () => {
    const sessionId = uniqueSessionId("below-threshold");

    const result = runHook(sessionId, "2");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("warns at COMPACT_THRESHOLD on stderr and stdout JSON", () => {
    const sessionId = uniqueSessionId("threshold");

    runHook(sessionId, "2");
    const result = runHook(sessionId, "2");

    expect(result.status).toBe(0);
    expect(result.stderr).toContain("[StrategicCompact] 2 tool calls reached");

    const payload = JSON.parse(result.stdout);
    expect(payload.systemMessage).toContain(
      "[StrategicCompact] 2 tool calls reached",
    );
  });

  it("counts each session independently", () => {
    const sessionA = uniqueSessionId("session-a");
    const sessionB = uniqueSessionId("session-b");

    runHook(sessionA, "2");
    runHook(sessionB, "2");
    const resultA = runHook(sessionA, "2");
    const resultB = runHook(sessionB, "2");

    expect(resultA.stderr).toContain("[StrategicCompact] 2 tool calls reached");
    expect(resultB.stderr).toContain("[StrategicCompact] 2 tool calls reached");
  });

  it("warns every 25 calls after the threshold", () => {
    const sessionId = uniqueSessionId("periodic");

    for (let i = 0; i < 26; i += 1) {
      runHook(sessionId, "2");
    }
    const result = runHook(sessionId, "2");

    expect(result.stderr).toContain(
      "[StrategicCompact] 27 tool calls - good checkpoint",
    );

    const payload = JSON.parse(result.stdout);
    expect(payload.systemMessage).toContain(
      "[StrategicCompact] 27 tool calls - good checkpoint",
    );
  });
});
