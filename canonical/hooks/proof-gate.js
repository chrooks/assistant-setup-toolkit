#!/usr/bin/env node
// Stop hook: proof gate for the Completion Status line.
//
// Refuses to let a turn end when the final message closes on a 🟢 status line
// but carries no `Proof:` line — the Surface driven and what was seen, or
// `Proof: none needed — <why>` when no runtime behavior changed. 🟡, 🔴, and
// turns with no status line pass. This is the enforcement half of Proof Before
// Done; the rule itself lives in INSTRUCTIONS.md (Completion Status) and
// rules/common/development-workflow.md.
//
// Stop `additionalContext` makes Claude continue with REASON as its
// instruction. It is the documented form for a hook working as designed:
// `decision: "block"` does the same but shows the user "Stop hook error".
// The condition always resolves (add the line, or end on 🟡), and Claude Code
// ends the turn anyway after 8 consecutive continuations, so continuations
// are re-checked rather than waved through on `stop_hook_active`.
//
// Claude-only: it reads `last_assistant_message`, a Claude Code Stop field.
//
// Disable for a session: CLAUDE_PROOF_GATE=0 in the environment.
// Disable globally: touch ~/.claude/.proof-gate.off

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Status line opens with 🟢; markdown bold or list markers allowed in front.
const GREEN_STATUS = /^[\s>*_-]*🟢/u;
// A line opening with "Proof:" — bold, list, and quote markers allowed.
const PROOF_LINE = /^[\s>*_-]*proof[*_]*\s*:/im;

const REASON =
  "Proof gate: this message ends on 🟢 but has no `Proof:` line. " +
  "Resend the report led by one: the Surface you drove (exact URL, screen, or command) and what you saw, " +
  "or `Proof: none needed — <why>` when no runtime behavior changed. " +
  "Not proven? Drive it now, or end on 🟡 and name what is unproven.";

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf-8"));
  } catch {
    return null;
  }
}

function isDisabled() {
  return (
    process.env.CLAUDE_PROOF_GATE === "0" ||
    fs.existsSync(path.join(os.homedir(), ".claude", ".proof-gate.off"))
  );
}

function needsProof(message) {
  const lastLine = message.trimEnd().split("\n").pop();
  return GREEN_STATUS.test(lastLine) && !PROOF_LINE.test(message);
}

function main() {
  if (isDisabled()) return;
  const message = readPayload()?.last_assistant_message;
  if (typeof message !== "string" || !needsProof(message)) return;
  const output = { hookSpecificOutput: { hookEventName: "Stop", additionalContext: REASON } };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

try {
  main();
} finally {
  process.exit(0);
}
