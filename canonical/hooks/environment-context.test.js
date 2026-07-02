#!/usr/bin/env node
// Self-contained Node test for environment-context.js — no framework, just
// `node` + assert, mirroring quiz-me.test.js's shape.
//
//   node canonical/hooks/environment-context.test.js

import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "environment-context.js");

function run(env) {
  return execFileSync("node", [HOOK], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

let failures = 0;
function check(name, ok) {
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) failures++;
}

// (a) SSH_CONNECTION set -> mentions remote/SSH
{
  const out = run({ SSH_CONNECTION: "192.168.1.1 1 192.168.1.2 22", SSH_CLIENT: "" });
  const parsed = JSON.parse(out);
  check("SSH session mentions SSH", /SSH/i.test(parsed.additionalContext));
  check("SSH session names the hostname", parsed.additionalContext.includes(os.hostname()));
}

// (b) no SSH env vars -> local, no SSH language, still names hostname
{
  const out = run({ SSH_CONNECTION: "", SSH_CLIENT: "" });
  const parsed = JSON.parse(out);
  check("local session does not mention SSH", !/SSH/i.test(parsed.additionalContext));
  check("local session names the hostname", parsed.additionalContext.includes(os.hostname()));
}

// (c) names the current host's OS label (this suite only runs on one real
// platform at a time, so it exercises whichever branch is actually live)
{
  // Keep in sync with OS_LABELS in environment-context.js.
  const labels = { darwin: "macOS", linux: "Linux", win32: "Windows" };
  const expected = labels[os.platform()] || os.platform();
  const out = run({ SSH_CONNECTION: "", SSH_CLIENT: "" });
  const parsed = JSON.parse(out);
  check("message names the OS label (" + expected + ")", parsed.additionalContext.includes(expected));
}

// (d) always fires — suppressOutput true, valid JSON, every run
{
  const out = run({ SSH_CONNECTION: "", SSH_CLIENT: "" });
  const parsed = JSON.parse(out);
  check("suppressOutput is true", parsed.suppressOutput === true);
  check("additionalContext is non-empty", typeof parsed.additionalContext === "string" && parsed.additionalContext.length > 0);
}

if (failures === 0) {
  console.log("All environment-context hook tests passed.");
  process.exit(0);
} else {
  console.error(failures + " environment-context hook test(s) failed.");
  process.exit(1);
}
