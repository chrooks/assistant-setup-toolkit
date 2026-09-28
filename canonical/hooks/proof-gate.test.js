#!/usr/bin/env node
// Self-contained Node test for proof-gate.js — no framework, just `node` +
// assert. Runs the hook in a child process with a throwaway HOME, feeds a Stop
// payload on stdin, and asserts on stdout.
//
//   node canonical/hooks/proof-gate.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "proof-gate.js");

function run(input, env = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "proofgate-"));
  const result = spawnSync("node", [HOOK], {
    input,
    env: { PATH: process.env.PATH, HOME: home, ...env },
    encoding: "utf-8",
  });
  return { status: result.status, out: result.stdout.trim(), home };
}

function stop(message) {
  return JSON.stringify({ hook_event_name: "Stop", last_assistant_message: message });
}

function blocks(out) {
  return out !== "" && JSON.parse(out).hookSpecificOutput?.hookEventName === "Stop";
}

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

test("blocks a 🟢 status line with no Proof line", () => {
  const { status, out } = run(stop("Wired the hook.\n\n🟢 Proof gate is live\n"));
  assert.equal(status, 0);
  assert.ok(blocks(out));
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /Proof:/);
});

test("blocks a bold 🟢 status line with no Proof line", () => {
  assert.ok(blocks(run(stop("Done.\n**🟢** finished")).out));
});

test("passes a 🟢 with a plain Proof line", () => {
  assert.equal(run(stop("Proof: drove https://app.example.com, saw the list\n\n🟢 done")).out, "");
});

test("passes a 🟢 with a bold Proof line", () => {
  assert.equal(run(stop("**Proof:** node test passed, 8/8\n\n🟢 done")).out, "");
  assert.equal(run(stop("- **Proof**: none needed — docs only\n🟢 done")).out, "");
});

test("does not treat 'Proofread:' as a Proof line", () => {
  assert.ok(blocks(run(stop("Proofread: the README\n🟢 done")).out));
});

test("passes 🟡 and 🔴 status lines without Proof", () => {
  assert.equal(run(stop("Built it.\n🟡 unproven — drive the login page")).out, "");
  assert.equal(run(stop("Stuck.\n🔴 need the API key")).out, "");
});

test("passes when 🟢 appears mid-message but not on the last line", () => {
  assert.equal(run(stop("Legend: 🟢 finished · 🟡 follow-up\nWhich do you want?")).out, "");
});

test("fails open on empty, malformed, or fieldless input", () => {
  for (const input of ["", "not json", "{}", "42"]) {
    const { status, out } = run(input);
    assert.equal(status, 0);
    assert.equal(out, "");
  }
});

test("stays silent when disabled by env var", () => {
  assert.equal(run(stop("🟢 done"), { CLAUDE_PROOF_GATE: "0" }).out, "");
});

test("stays silent when disabled by flag file", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "proofgate-"));
  fs.mkdirSync(path.join(home, ".claude"));
  fs.writeFileSync(path.join(home, ".claude", ".proof-gate.off"), "");
  assert.equal(run(stop("🟢 done"), { HOME: home }).out, "");
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed++;
    console.log(`not ok - ${name}\n  ${err.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
