#!/usr/bin/env node
// Cost guard: hard limits on the three things that turned one Claude Code
// session into a four-figure bill (2026-09-27..10-08, Cornerstone on hestia):
//
//   1. Context that never shrank. One session, 11 days, ~470K tokens re-read
//      on every call. Cache reads at that size cost more than the output.
//   2. Multi-agent Workflows launched from the end of that huge context.
//   3. Subagents spawned at the same altitude.
//
// Wired on two events:
//
//   UserPromptSubmit  — measures the live context from the transcript. Above
//                       SOFT, and only when the previous turn ended on a 🟢
//                       status line (a finished unit of work, see CLAUDE.md
//                       "Completion Status"), it asks the assistant once to
//                       recommend a handoff if the new prompt starts new work.
//                       Mid-work turns (🟡/🔴/no status) stay silent, so the
//                       nudge lands between tasks instead of every prompt.
//                       Above BLOCK it refuses the prompt (the user sees why)
//                       until the session is handed off and cleared. Escape
//                       hatches: /handoff, /compact, /clear, /exit, /cost,
//                       or the phrase "cost guard override" in the prompt.
//                       Also records an opt-in marker when the prompt says
//                       "ultracode" / "use a workflow" so PreToolUse can tell
//                       a user-requested Workflow from a model-initiated one.
//   PreToolUse        — matcher "Workflow|Agent". Denies a Workflow unless the
//                       user opted in this session within the last 2 hours
//                       AND the context is small enough to fork cheaply.
//                       Denies an Agent spawn above AGENT_MAX context.
//
// Thresholds are tokens of live context (input + cache read + cache write on
// the last API call). Override with env vars for a session:
//   COST_GUARD_SOFT, COST_GUARD_BLOCK, COST_GUARD_WORKFLOW_MAX,
//   COST_GUARD_AGENT_MAX, COST_GUARD_MAX_HOURS
// Disable for a session: COST_GUARD=0. Disable globally: touch
// ~/.claude/.cost-guard.off. Fails open on any read error.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TOKENS_SOFT = num(process.env.COST_GUARD_SOFT, 100_000);
const TOKENS_BLOCK = num(process.env.COST_GUARD_BLOCK, 250_000);
const WORKFLOW_MAX_TOKENS = num(process.env.COST_GUARD_WORKFLOW_MAX, 80_000);
const AGENT_MAX_TOKENS = num(process.env.COST_GUARD_AGENT_MAX, 200_000);
const MAX_SESSION_HOURS = num(process.env.COST_GUARD_MAX_HOURS, 24);
const OPT_IN_TTL_MS = 2 * 60 * 60 * 1000;
const TAIL_BYTES = 4 * 1024 * 1024;
const HEAD_BYTES = 256 * 1024;

const STATE_DIR = path.join(claudeHome(), ".cost-guard");
const ESCAPE_HATCH = /(^|\s)\/(handoff|compact|clear|exit|cost|resume)\b|cost guard override/i;
const WORKFLOW_OPT_IN = /\bultracode\b|\b(use|run|start) (a |the )?workflow\b|fan out agents|orchestrate (this )?with subagents/i;
const LONG_CONTEXT_MODEL = /\[1m\]|-1m\b/i;
const API_KEY_OK = /api key ok/i;
// Same shape as proof-gate.js: 🟢 opens the last line, markers allowed in front.
const GREEN_STATUS = /^[\s>*_-]*🟢/u;

/** True when this process would bill an API key instead of the subscription. */
export function hasApiKeyBilling(env = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
}

function num(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function claudeHome() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

function isDisabled() {
  return (
    process.env.COST_GUARD === "0" ||
    fs.existsSync(path.join(claudeHome(), ".cost-guard.off"))
  );
}

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf-8"));
  } catch {
    return null;
  }
}

function readSlice(file, start, length) {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(length);
    const n = fs.readSync(fd, buf, 0, length, start);
    return buf.subarray(0, n).toString("utf-8");
  } finally {
    fs.closeSync(fd);
  }
}

/** Live context and model from the newest assistant message with usage. */
export function measureTranscript(transcriptPath) {
  const empty = { tokens: 0, model: "", ageHours: 0, uuid: "", endsGreen: false };
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return empty;
  const size = fs.statSync(transcriptPath).size;
  if (size === 0) return empty;

  const tail = readSlice(transcriptPath, Math.max(0, size - TAIL_BYTES), Math.min(size, TAIL_BYTES));
  const lines = tail.split("\n");
  let tokens = 0;
  let model = "";
  let uuid = "";
  let endsGreen = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.includes('"usage"')) continue;
    try {
      const entry = JSON.parse(line);
      const usage = entry?.message?.usage;
      if (!usage) continue;
      tokens =
        (usage.input_tokens || 0) +
        (usage.cache_read_input_tokens || 0) +
        (usage.cache_creation_input_tokens || 0);
      model = entry.message.model || "";
      uuid = entry.uuid || "";
      endsGreen = endsOnGreen(entry.message.content);
      break;
    } catch {
      // partial first line of the slice, or a non-JSON line
    }
  }

  let ageHours = 0;
  const head = readSlice(transcriptPath, 0, Math.min(size, HEAD_BYTES));
  const first = head.match(/"timestamp":"([^"]+)"/);
  if (first) {
    const started = Date.parse(first[1]);
    if (Number.isFinite(started)) ageHours = (Date.now() - started) / 3_600_000;
  }
  return { tokens, model, ageHours, uuid, endsGreen };
}

/** True when the last text block of an assistant message closes on a 🟢 status line. */
function endsOnGreen(content) {
  const blocks = Array.isArray(content) ? content : [{ type: "text", text: content }];
  const text = blocks.filter((b) => b?.type === "text").map((b) => b.text).pop();
  if (typeof text !== "string") return false;
  return GREEN_STATUS.test(text.trimEnd().split("\n").pop());
}

function nudgeFile(sessionId) {
  return path.join(STATE_DIR, `${sessionId || "unknown"}.nudged`);
}

/** Once per 🟢: true the first time this message uuid is seen. */
function claimNudge(sessionId, uuid) {
  try {
    if (fs.readFileSync(nudgeFile(sessionId), "utf-8") === uuid) return false;
  } catch {
    // no prior nudge
  }
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(nudgeFile(sessionId), uuid);
  } catch {
    // unwritable: nudging again is the cheap failure
  }
  return true;
}

function optInFile(sessionId) {
  return path.join(STATE_DIR, `${sessionId || "unknown"}.workflow-opt-in`);
}

function recordOptIn(sessionId) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(optInFile(sessionId), String(Date.now()));
  } catch {
    // state dir unwritable: the Workflow will be denied, which is the safe side
  }
}

function hasFreshOptIn(sessionId) {
  try {
    const stamped = Number(fs.readFileSync(optInFile(sessionId), "utf-8"));
    return Number.isFinite(stamped) && Date.now() - stamped < OPT_IN_TTL_MS;
  } catch {
    return false;
  }
}

const fmt = (n) => `${Math.round(n / 1000)}K`;

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function onPrompt(payload) {
  const prompt = String(payload.prompt || "");
  if (WORKFLOW_OPT_IN.test(prompt)) recordOptIn(payload.session_id);

  // The 2026-10 bill was not Max overage: hestia's ~/.bashrc exported
  // ANTHROPIC_API_KEY, so every session there paid API rates with no
  // subscription coverage. Refuse to run on a key unless the user says so.
  if (hasApiKeyBilling() && !API_KEY_OK.test(prompt)) {
    emit({
      decision: "block",
      reason:
        "Cost guard: ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is set, so this session bills the API key at full rates, not your Max plan. " +
        "Unset it (check ~/.bashrc, ~/.zshrc, the service unit) and restart Claude Code. " +
        'To continue on the key on purpose, add the words "api key ok" to your prompt.',
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: false },
    });
    return;
  }
  if (ESCAPE_HATCH.test(prompt)) return;

  const { tokens, model, ageHours, uuid, endsGreen } = measureTranscript(payload.transcript_path);

  if (tokens >= TOKENS_BLOCK) {
    emit({
      decision: "block",
      reason:
        `Cost guard: this session's context is ${fmt(tokens)} tokens. ` +
        `Every reply re-reads all of it, so each turn now costs more than a whole small session. ` +
        `Hand off now (Orca: "Hand Off to Another Agent", or /handoff then /clear) and continue in a fresh session. ` +
        `Nothing is lost: background commands keep running and write to their output files, and the new session can watch the same file or table. ` +
        `To send this one prompt anyway, add the words "cost guard override" to it.`,
      hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: false },
    });
    return;
  }

  const notes = [];
  if (tokens >= TOKENS_SOFT && endsGreen && claimNudge(payload.session_id, uuid)) {
    notes.push(
      `The last turn finished a unit of work (🟢) and context is ${fmt(tokens)} tokens (hard stop at ${fmt(TOKENS_BLOCK)}). ` +
        `If this prompt starts new work, tell the user in one line that this is a good point to /handoff to a fresh session, then proceed. ` +
        `If it continues the same work, say nothing about context.`,
    );
  }
  if (ageHours >= MAX_SESSION_HOURS) {
    notes.push(
      `This session is ${Math.round(ageHours)} hours old. Long-lived sessions are how the Cornerstone overrun happened. Recommend /handoff and a fresh session.`,
    );
  }
  if (LONG_CONTEXT_MODEL.test(model)) {
    notes.push(
      `Model "${model}" has the 1M context window. Say so to the user in one line and recommend switching with /model to the standard window unless they need 1M for this task.`,
    );
  }
  if (notes.length === 0) return;
  emit({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: `Cost guard: ${notes.join(" ")}`,
    },
  });
}

function deny(reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
}

function onToolUse(payload) {
  const tool = payload.tool_name;
  if (tool !== "Workflow" && tool !== "Agent") return;
  const { tokens } = measureTranscript(payload.transcript_path);

  if (tool === "Workflow") {
    if (!hasFreshOptIn(payload.session_id)) {
      deny(
        "Cost guard: Workflow runs spawn many agents and have cost hundreds of dollars per session. " +
          'Blocked because the user did not ask for one in the last 2 hours. If they want it, they type "ultracode" or "use a workflow" in their own message; ' +
          "otherwise do the work directly or with a single Agent.",
      );
      return;
    }
    if (tokens > WORKFLOW_MAX_TOKENS) {
      deny(
        `Cost guard: this session's context is ${fmt(tokens)} tokens; Workflows are allowed only below ${fmt(WORKFLOW_MAX_TOKENS)}. ` +
          "Tell the user to /handoff and launch the workflow from a fresh session.",
      );
      return;
    }
    return;
  }

  if (tokens > AGENT_MAX_TOKENS) {
    deny(
      `Cost guard: context is ${fmt(tokens)} tokens; no new subagents above ${fmt(AGENT_MAX_TOKENS)}. ` +
        "Do the step inline or tell the user to /handoff to a fresh session.",
    );
  }
}

function main() {
  if (isDisabled()) return;
  const payload = readPayload();
  if (!payload) return;
  try {
    if (payload.hook_event_name === "UserPromptSubmit") onPrompt(payload);
    else if (payload.hook_event_name === "PreToolUse") onToolUse(payload);
  } catch {
    // fail open: a broken guard must never wedge the harness
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
