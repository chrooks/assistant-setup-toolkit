#!/usr/bin/env node
// UserPromptSubmit hook: ship-mode activation state + per-turn anti-drift nudge.
//
// Ship mode (canonical/skills/ship/SKILL.md) cuts decisions, round trips, and
// unnecessary context. Its failure mode is silent: after a long tool sequence or
// a compaction the model drifts back to thorough-and-confirming, and the human
// only notices by paying for it again.
//
// The hook — not the model — owns the on/off state. The model forgetting the
// mode is exactly the drift being guarded against, so trusting it to maintain a
// flag file would put the guard inside the thing it guards.
//
// State: ~/.claude/.ship-mode.on (presence = active). Toggled by phrases in the
// submitted prompt, so it survives compaction and works even when the Skill was
// never explicitly invoked.
//
// `node {hook}` resolves identically on Mac, bare Windows, and Windows+WSL.
//
// Wire it in ~/.claude/settings.json (Claude Code):
//
//   { "hooks": { "UserPromptSubmit": [
//     { "hooks": [ { "type": "command", "command": "node ~/.claude/hooks/ship-mode-reminder.js" } ] }
//   ] } }
//
// Codex CLI displays UserPromptSubmit additionalContext in the transcript, so
// canonical/hooks/wiring.yaml intentionally does not wire this hook for Codex.
//
// Disable for a session: CLAUDE_SHIP_MODE_REMINDER=0 in the environment.
// Disable globally: touch ~/.claude/.ship-mode-reminder.off

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE_FILE = ".ship-mode.on";
const OFF_FILE = ".ship-mode-reminder.off";

// Deactivation is checked first and matched broadly: a false negative leaves the
// human stuck in a mode they tried to exit, which is worse than a false positive
// that merely costs one verbose turn.
const DEACTIVATE =
  /\b(stop ship|ship off|exit ship|normal mode|stop ponytail|explain (it )?(to me )?(in )?(full|detail)|walk me through)\b/i;

// Activation requires an explicit signal. "ship it" alone is too common in
// ordinary sentences ("we should ship it Friday") to flip a persistent mode.
const ACTIVATE =
  /\b(ship mode|just ship it|i'?m shipping|shipping mode|eli5|i'?m fried|decision fatigue|minimi[sz]e decisions|less involvement|as little involvement)\b/i;

// Per-turn nudge, not a rulebook. The full Skill loads once when invoked; this
// only re-anchors the two rules that decay first — asking too much and saying
// too much.
const REMINDER =
  "SHIP MODE ACTIVE. Lead with what Chris must decide or do; cut context that is not load-bearing for it. Do NOT convert your uncertainty into his decisions — infer reversible things (which file, whether to update tests, whether to commit) instead of asking. Chain obvious next steps, batch related work, report once. Design calls only he can make still get asked, in dependency-ordered rounds. Safety floor UNCHANGED: irreversible, destructive, outward-facing, secrets, or money still gate on explicit confirmation, and the report never launders bad news. Surface anything only he can run under 'Needs you:'.";

function readPayload() {
  try {
    return fs.readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

// The prompt text lives at different keys across harness versions; fall back to
// the whole payload so a shape change degrades to over-matching, not silence.
function extractPrompt(payload) {
  try {
    const parsed = JSON.parse(payload);
    return String(parsed.prompt ?? parsed.user_prompt ?? parsed.message ?? payload);
  } catch {
    return payload;
  }
}

function main() {
  if (process.env.CLAUDE_SHIP_MODE_REMINDER === "0") return;

  const home = os.homedir();
  const claudeDir = path.join(home, ".claude");
  if (
    fs.existsSync(path.join(claudeDir, OFF_FILE)) ||
    fs.existsSync(path.join(home, ".codex", OFF_FILE))
  ) {
    return;
  }

  const payload = readPayload();

  // Codex displays UserPromptSubmit additionalContext as transcript noise, so
  // this hook stays quiet there. Claude Code keeps the flat additionalContext shape.
  if (/"turn_id"\s*:/.test(payload)) return;

  const prompt = extractPrompt(payload);
  const statePath = path.join(claudeDir, STATE_FILE);

  if (DEACTIVATE.test(prompt)) {
    try {
      fs.rmSync(statePath, { force: true });
    } catch {
      // A stuck state file is recoverable by hand; never break the turn over it.
    }
    return;
  }

  if (ACTIVATE.test(prompt)) {
    try {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(statePath, "");
    } catch {
      // Fall through — the reminder below still fires for this turn even if the
      // state could not be persisted.
    }
    process.stdout.write(
      `${JSON.stringify({ suppressOutput: true, additionalContext: REMINDER })}\n`,
    );
    return;
  }

  if (!fs.existsSync(statePath)) return;

  process.stdout.write(
    `${JSON.stringify({ suppressOutput: true, additionalContext: REMINDER })}\n`,
  );
}

try {
  main();
} finally {
  process.exit(0);
}
