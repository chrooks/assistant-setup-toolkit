#!/usr/bin/env node
// Self-contained Node test for cost-guard.js — no framework, just `node` +
// assert. Builds throwaway transcripts, feeds hook payloads on stdin, and
// asserts on the decision.
//
//   node canonical/hooks/cost-guard.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "cost-guard.js");

function transcript(dir, { tokens, model = "claude-opus-5-5", hoursOld = 1, text = "ok", uuid = "u1" }) {
  const file = path.join(dir, "session.jsonl");
  const started = new Date(Date.now() - hoursOld * 3_600_000).toISOString();
  const lines = [
    JSON.stringify({ type: "user", timestamp: started, message: { role: "user", content: "hi" } }),
    JSON.stringify({
      type: "assistant",
      uuid,
      timestamp: new Date().toISOString(),
      message: {
        id: "msg_1",
        model,
        role: "assistant",
        content: [{ type: "text", text }],
        usage: { input_tokens: 2, cache_read_input_tokens: tokens - 2, cache_creation_input_tokens: 0, output_tokens: 5 },
      },
    }),
  ];
  fs.writeFileSync(file, lines.join("\n") + "\n");
  return file;
}

function run(payload, home) {
  const result = spawnSync("node", [HOOK], {
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH, HOME: home, CLAUDE_CONFIG_DIR: path.join(home, ".claude") },
    encoding: "utf-8",
  });
  const out = result.stdout.trim();
  return { status: result.status, json: out ? JSON.parse(out) : null };
}

function fresh() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "costguard-"));
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  return home;
}

// Small context: silent on prompt, Agent allowed, Workflow denied without opt-in.
{
  const home = fresh();
  const t = transcript(home, { tokens: 30_000 });
  const base = { session_id: "s1", transcript_path: t };
  assert.equal(run({ ...base, hook_event_name: "UserPromptSubmit", prompt: "fix the bug" }, home).json, null);
  assert.equal(run({ ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: {} }, home).json, null);
  const wf = run({ ...base, hook_event_name: "PreToolUse", tool_name: "Workflow", tool_input: {} }, home).json;
  assert.equal(wf.hookSpecificOutput.permissionDecision, "deny");
  assert.match(wf.hookSpecificOutput.permissionDecisionReason, /did not ask/);
}

// Opt-in via "ultracode" unlocks Workflow while context is small.
{
  const home = fresh();
  const t = transcript(home, { tokens: 30_000 });
  const base = { session_id: "s2", transcript_path: t };
  run({ ...base, hook_event_name: "UserPromptSubmit", prompt: "ultracode: build the thing" }, home);
  assert.equal(run({ ...base, hook_event_name: "PreToolUse", tool_name: "Workflow", tool_input: {} }, home).json, null);
}

// Opt-in does not help once the context is past the Workflow ceiling.
{
  const home = fresh();
  const t = transcript(home, { tokens: 150_000 });
  const base = { session_id: "s3", transcript_path: t };
  assert.equal(run({ ...base, hook_event_name: "UserPromptSubmit", prompt: "ultracode go" }, home).json, null);
  const wf = run({ ...base, hook_event_name: "PreToolUse", tool_name: "Workflow", tool_input: {} }, home).json;
  assert.match(wf.hookSpecificOutput.permissionDecisionReason, /allowed only below 80K/);
}

// Hard stop: prompt blocked above BLOCK, escape hatches still pass.
{
  const home = fresh();
  const t = transcript(home, { tokens: 300_000 });
  const base = { session_id: "s4", transcript_path: t, hook_event_name: "UserPromptSubmit" };
  const blocked = run({ ...base, prompt: "keep going" }, home).json;
  assert.equal(blocked.decision, "block");
  assert.match(blocked.reason, /300K tokens/);
  assert.equal(run({ ...base, prompt: "/handoff next session" }, home).json, null);
  assert.equal(run({ ...base, prompt: "keep going, cost guard override" }, home).json, null);
  const agent = run({ ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: {} }, home).json;
  assert.match(agent.hookSpecificOutput.permissionDecisionReason, /no new subagents/);
}

// Soft line: above 100K the nudge fires once per 🟢 turn and never mid-work (🟡).
{
  const home = fresh();
  const base = { session_id: "s9", hook_event_name: "UserPromptSubmit", prompt: "next task" };
  const green = transcript(home, { tokens: 150_000, text: "Done.\n\n**🟢** shipped", uuid: "g1" });
  const first = run({ ...base, transcript_path: green }, home).json;
  assert.match(first.hookSpecificOutput.additionalContext, /finished a unit of work .* 150K tokens/);
  assert.equal(run({ ...base, transcript_path: green }, home).json, null, "same 🟢 nudges once");
  const yellow = transcript(home, { tokens: 150_000, text: "Done.\n\n🟡 tests remain", uuid: "y1" });
  assert.equal(run({ ...base, transcript_path: yellow }, home).json, null, "🟡 is mid-work");
  const lowGreen = transcript(home, { tokens: 50_000, text: "🟢 done", uuid: "g2" });
  assert.equal(run({ ...base, transcript_path: lowGreen }, home).json, null, "below soft line");
}

// Old session and 1M model both produce a warning.
{
  const home = fresh();
  const t = transcript(home, { tokens: 10_000, model: "claude-fable-5-1[1m]", hoursOld: 30 });
  const r = run({ session_id: "s5", transcript_path: t, hook_event_name: "UserPromptSubmit", prompt: "hi" }, home).json;
  assert.match(r.hookSpecificOutput.additionalContext, /30 hours old/);
  assert.match(r.hookSpecificOutput.additionalContext, /1M context window/);
}

// Kill switch and missing transcript fail open.
{
  const home = fresh();
  fs.writeFileSync(path.join(home, ".claude", ".cost-guard.off"), "");
  const t = transcript(home, { tokens: 900_000 });
  assert.equal(run({ session_id: "s6", transcript_path: t, hook_event_name: "UserPromptSubmit", prompt: "x" }, home).json, null);
  const home2 = fresh();
  assert.equal(run({ session_id: "s7", transcript_path: "/nope.jsonl", hook_event_name: "UserPromptSubmit", prompt: "x" }, home2).json, null);
}

// An API key in the environment blocks prompts unless the user says "api key ok".
{
  const home = fresh();
  const t = transcript(home, { tokens: 5_000 });
  const base = { session_id: "s8", transcript_path: t, hook_event_name: "UserPromptSubmit" };
  const withKey = (payload) =>
    JSON.parse(
      spawnSync("node", [HOOK], {
        input: JSON.stringify(payload),
        env: { PATH: process.env.PATH, HOME: home, CLAUDE_CONFIG_DIR: path.join(home, ".claude"), ANTHROPIC_API_KEY: "sk-ant-test" },
        encoding: "utf-8",
      }).stdout.trim() || "null",
    );
  const blocked = withKey({ ...base, prompt: "hello" });
  assert.equal(blocked.decision, "block");
  assert.match(blocked.reason, /bills the API key/);
  assert.equal(withKey({ ...base, prompt: "hello, api key ok" }), null);
}

console.log("cost-guard.test.js: all assertions passed");
