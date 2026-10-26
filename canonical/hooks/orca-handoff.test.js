#!/usr/bin/env node
// Self-contained Node test for orca-handoff.js: node canonical/hooks/orca-handoff.test.js
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "orca-handoff.js");

function run(payload) {
  const out = spawnSync("node", [HOOK], { input: JSON.stringify(payload), encoding: "utf-8" }).stdout.trim();
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : null;
}

const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "orca-handoff-"));
const transcript = path.join(cwd, "old.jsonl");
const longText = "Did the thing.\n\n" + "x".repeat(300) + "\n\n**TLDR:**\nShipped it.\n\n🟢 finished";
fs.writeFileSync(
  transcript,
  [
    JSON.stringify({ type: "user", message: { role: "user", content: "go" } }),
    JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: longText }] } }),
    JSON.stringify({ type: "user", message: { role: "user", content: "thanks" } }),
  ].join("\n") + "\n",
);
const orcaPrompt = `Continue work from the prior Orca session using the context below.\n\nThe complete original session transcript is available at this path:\n\`\`\`text\n${transcript}\n\`\`\`\n\nLatest Orca status hints:\nLast assistant update: Did the thing...`;

// Arrange: ordinary prompt → silent.
assert.equal(run({ hook_event_name: "UserPromptSubmit", prompt: "fix the bug", cwd }), null);

// Act/Assert: Orca template → full last assistant message, including the status line Orca cuts off.
const ctx = run({ hook_event_name: "UserPromptSubmit", prompt: orcaPrompt, cwd });
assert.match(ctx, /🟢 finished/);
assert.doesNotMatch(ctx, /Handoff file/);

// Handoff file and Throughline folder are included when present.
fs.mkdirSync(path.join(cwd, ".claude", "handoffs"), { recursive: true });
fs.writeFileSync(path.join(cwd, ".claude", "handoffs", "2026-10-26-thing.md"), "# Handoff\nNext: run the tests.");
fs.mkdirSync(path.join(cwd, ".tasks", "12-thing"), { recursive: true });
const rich = run({ hook_event_name: "UserPromptSubmit", prompt: orcaPrompt, cwd });
assert.match(rich, /2026-10-26-thing\.md[\s\S]*Next: run the tests/);
assert.match(rich, /\.tasks\/12-thing\//);

// Stale handoff file (8 days old) is ignored.
const stale = new Date(Date.now() - 8 * 86_400_000);
fs.utimesSync(path.join(cwd, ".claude", "handoffs", "2026-10-26-thing.md"), stale, stale);
assert.doesNotMatch(run({ hook_event_name: "UserPromptSubmit", prompt: orcaPrompt, cwd }), /Handoff file/);
fs.mkdirSync(path.join(cwd, ".tasks", "3-old"), { recursive: true });
fs.utimesSync(path.join(cwd, ".tasks", "3-old"), stale, stale);
assert.match(run({ hook_event_name: "UserPromptSubmit", prompt: orcaPrompt, cwd }), /\.tasks\/12-thing\//, "stale folder is not the newest");

// Missing transcript fails open to the parts that exist.
const noTranscript = orcaPrompt.replace(transcript, "/nope/gone.jsonl");
assert.match(run({ hook_event_name: "UserPromptSubmit", prompt: noTranscript, cwd }), /\.tasks\/12-thing\//);

console.log("orca-handoff.test.js: all assertions passed");
