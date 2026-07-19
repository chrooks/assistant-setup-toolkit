#!/usr/bin/env node
// Self-contained Node test for ship-mode-reminder.js — no framework, just
// `node` + assert.
//
// It builds a throwaway HOME, runs the hook in a child process with HOME
// overridden (os.homedir() honors $HOME on POSIX), feeds a UserPromptSubmit
// payload on stdin, and asserts on stdout plus the state file.
//
//   node canonical/hooks/ship-mode-reminder.test.js

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "ship-mode-reminder.js");

function setup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "shipmode-"));
  const home = path.join(tmp, "home");
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  return { tmp, home };
}

function run(home, prompt, env = {}) {
  const stdout = execFileSync("node", [HOOK], {
    input: JSON.stringify({ prompt }),
    env: { ...process.env, HOME: home, ...env },
    encoding: "utf-8",
  });
  return stdout.trim();
}

function statePath(home) {
  return path.join(home, ".claude", ".ship-mode.on");
}

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

test("stays silent and inert on an ordinary prompt", () => {
  const { home } = setup();

  const out = run(home, "what does this function do?");

  assert.equal(out, "");
  assert.equal(fs.existsSync(statePath(home)), false);
});

test("activates on an explicit signal and injects the reminder", () => {
  const { home } = setup();

  const out = run(home, "ship mode — get these two issues done");

  assert.match(out, /SHIP MODE ACTIVE/);
  assert.equal(JSON.parse(out).suppressOutput, true);
  assert.equal(fs.existsSync(statePath(home)), true);
});

test("persists across later turns that carry no signal", () => {
  const { home } = setup();

  run(home, "just ship it");
  const out = run(home, "ok now do the other one");

  // This is the whole point: the drift happens on turns that say nothing about
  // the mode, which is exactly when the model would have forgotten.
  assert.match(out, /SHIP MODE ACTIVE/);
});

test("deactivates on an exit phrase and stops injecting", () => {
  const { home } = setup();
  run(home, "ship mode");

  const off = run(home, "stop ship");

  assert.equal(off, "");
  assert.equal(fs.existsSync(statePath(home)), false);
  assert.equal(run(home, "another ordinary prompt"), "");
});

test("deactivation wins when a prompt carries both signals", () => {
  const { home } = setup();
  run(home, "ship mode");

  // Being stuck in a mode you tried to exit is worse than one verbose turn.
  const out = run(home, "stop ship, and walk me through the ship mode design");

  assert.equal(out, "");
  assert.equal(fs.existsSync(statePath(home)), false);
});

test("treats a request for a full explanation as an exit", () => {
  const { home } = setup();
  run(home, "i'm fried");

  const out = run(home, "walk me through how the payload pipeline works");

  assert.equal(out, "");
});

test("does not activate on incidental use of the word ship", () => {
  const { home } = setup();

  const out = run(home, "we should ship it Friday if the tests pass");

  assert.equal(out, "");
  assert.equal(fs.existsSync(statePath(home)), false);
});

test("honors the env-var and flag-file kill switches", () => {
  const { home } = setup();
  assert.equal(run(home, "ship mode", { CLAUDE_SHIP_MODE_REMINDER: "0" }), "");

  fs.writeFileSync(path.join(home, ".claude", ".ship-mode-reminder.off"), "");

  assert.equal(run(home, "ship mode"), "");
});

test("stays quiet for Codex, which renders additionalContext as noise", () => {
  const { home } = setup();

  const out = execFileSync("node", [HOOK], {
    input: JSON.stringify({ prompt: "ship mode", turn_id: "abc" }),
    env: { ...process.env, HOME: home },
    encoding: "utf-8",
  }).trim();

  assert.equal(out, "");
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}\n     ${error.message}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed === 0 ? 0 : 1);
