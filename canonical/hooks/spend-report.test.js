#!/usr/bin/env node
// Self-contained Node test for spend-report.js — no framework, just `node` +
// assert. Builds a throwaway CLAUDE_CONFIG_DIR with transcripts, runs the hook
// as a SessionStart event, and asserts on the billing-mode split.
//
//   node canonical/hooks/spend-report.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "spend-report.js");

// 1M output tokens on opus-5-5 = $20 at list rates: easy arithmetic.
const OUTPUT_TOKENS = 1_000_000;
const SESSION_USD = 20;

function transcript(home, project, sessionId) {
  const dir = path.join(home, "projects", project);
  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({
    type: "assistant",
    timestamp: new Date().toISOString(),
    message: {
      id: `msg_${sessionId}`,
      model: "claude-opus-5-5",
      role: "assistant",
      usage: { input_tokens: 0, output_tokens: OUTPUT_TOKENS, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  });
  fs.writeFileSync(path.join(dir, `${sessionId}.jsonl`), line + "\n");
}

function run(home, { env = {}, sessionId = "current" } = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "SessionStart", session_id: sessionId }),
    encoding: "utf-8",
    env: {
      PATH: process.env.PATH,
      CLAUDE_CONFIG_DIR: home,
      PUSHOVER_SECRETS_FILE: path.join(home, "no-secrets"),
      ...env,
    },
  });
  assert.equal(r.status, 0, r.stderr);
  const text = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
  const summary = JSON.parse(fs.readFileSync(path.join(home, ".cost-guard", "spend-summary.json"), "utf-8"));
  const modes = JSON.parse(fs.readFileSync(path.join(home, ".cost-guard", "billing-modes.json"), "utf-8"));
  return { text, summary, modes };
}

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spend-report-"));
}

// --- No key: subscription mode, nothing API-billed, session recorded.
{
  const home = freshHome();
  transcript(home, "-Users-me-proj", "current");
  const { text, summary, modes } = run(home);
  assert.match(text, /^This session bills the claude\.ai subscription/);
  assert.match(text, /API-billed sessions in the last 7 days: none recorded/);
  assert.match(text, /Subscription-covered estimate .* today \$20\.00/);
  assert.equal(modes.current.mode, "subscription");
  assert.equal(summary.apiToday, 0);
  assert.equal(summary.today, SESSION_USD);
  assert.equal(summary.thisSessionMode, "subscription");
  assert.equal(summary.unrecordedSessions, 0);
}

// --- Key in the environment: API mode, this session's spend lands in the API bucket.
{
  const home = freshHome();
  transcript(home, "-Users-me-proj", "current");
  const { text, summary, modes } = run(home, { env: { ANTHROPIC_API_KEY: "sk-ant-test" } });
  assert.match(text, /^BILLING WARNING/);
  assert.match(text, /API-billed sessions \(real Console charges\): today \$20\.00/);
  assert.equal(modes.current.mode, "api");
  assert.equal(summary.apiToday, SESSION_USD);
  assert.equal(summary.thisSessionMode, "api");
}

// --- apiKeyHelper in settings.json counts as API billing.
{
  const home = freshHome();
  fs.writeFileSync(path.join(home, "settings.json"), JSON.stringify({ apiKeyHelper: "/usr/local/bin/key" }));
  transcript(home, "-Users-me-proj", "current");
  const { modes } = run(home);
  assert.equal(modes.current.mode, "api");
}

// --- Mixed history: a recorded API session, a recorded subscription session,
//     and one that predates the record. Only the API one is real money.
{
  const home = freshHome();
  transcript(home, "-Users-me-proj", "old-api");
  transcript(home, "-Users-me-proj", "old-sub");
  transcript(home, "-Users-me-other", "unrecorded");
  transcript(home, "-Users-me-proj", "current");
  fs.mkdirSync(path.join(home, ".cost-guard"), { recursive: true });
  fs.writeFileSync(
    path.join(home, ".cost-guard", "billing-modes.json"),
    JSON.stringify({
      "old-api": { mode: "api", recordedAt: "2026-10-16T00:00:00.000Z" },
      "old-sub": { mode: "subscription", recordedAt: "2026-10-16T00:00:00.000Z" },
    }),
  );
  const { text, summary } = run(home);
  assert.equal(summary.today, 4 * SESSION_USD);
  assert.equal(summary.apiToday, SESSION_USD);
  assert.equal(summary.unrecordedSessions, 1);
  assert.match(text, /API-billed sessions \(real Console charges\): today \$20\.00/);
  assert.match(text, /Subscription-covered estimate .* today \$60\.00/);
  assert.match(text, /1 session predates the billing record/);
  // $20 API-billed this week is under the $50 cap: no cap warning.
  assert.doesNotMatch(text, /monthly Console cap/);
}

// --- The cap warning keys off the API bucket, not the covered estimate.
{
  const home = freshHome();
  for (const id of ["a", "b", "c"]) transcript(home, "-Users-me-proj", id);
  transcript(home, "-Users-me-proj", "current");
  const { text } = run(home);
  // $80 covered, $0 API: no warning.
  assert.doesNotMatch(text, /monthly Console cap/);
  const api = run(home, { env: { ANTHROPIC_API_KEY: "k" }, sessionId: "a" });
  const api2 = run(home, { env: { ANTHROPIC_API_KEY: "k" }, sessionId: "b" });
  const api3 = run(home, { env: { ANTHROPIC_API_KEY: "k" }, sessionId: "c" });
  assert.equal(api3.summary.apiWeek, 3 * SESSION_USD);
  assert.match(api3.text, /monthly Console cap/);
  assert.ok(api && api2);
}

console.log("spend-report.test.js: all assertions passed");
