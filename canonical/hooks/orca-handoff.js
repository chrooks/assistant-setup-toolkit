#!/usr/bin/env node
// Orca handoff enrichment: Orca's "Hand Off to Another Agent" button starts a
// fresh session with a fixed, uneditable prompt ("Continue work from the prior
// Orca session..."). Its only session-specific content is the last user prompt
// and ~200 characters of the last assistant message, which cuts off the TLDR
// and status line that the toolkit's Completion Status rule puts at the end.
//
// UserPromptSubmit: when the prompt is that Orca template, read the old
// transcript path out of it and inject what Orca truncates:
//   1. the full text of the old session's last assistant message
//   2. the newest handoff file under .claude/handoffs/ (if /handoff wrote one
//      in the last HANDOFF_MAX_AGE_DAYS)
//   3. the newest .tasks/<issue>-<slug>/ folder touched in that window (the
//      DevOS Throughline)
// Silent on every other prompt. Fails open on any read error.

import fs from "node:fs";
import path from "node:path";

const ORCA_TEMPLATE = /^Continue work from the prior Orca session/;
const TRANSCRIPT_LINE = /^\s*(\/\S+\.jsonl)\s*$/m;
const HANDOFF_MAX_AGE_DAYS = 7;
const TAIL_BYTES = 4 * 1024 * 1024;
const MAX_CHARS = 6000;

/** Full text of the newest assistant message in a transcript. */
export function lastAssistantText(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return "";
  const size = fs.statSync(transcriptPath).size;
  const fd = fs.openSync(transcriptPath, "r");
  let tail;
  try {
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    const n = fs.readSync(fd, buf, 0, buf.length, start);
    tail = buf.subarray(0, n).toString("utf-8");
  } finally {
    fs.closeSync(fd);
  }
  const lines = tail.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"assistant"')) continue;
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type !== "assistant") continue;
      const blocks = entry.message?.content;
      const text = (Array.isArray(blocks) ? blocks : [])
        .filter((b) => b?.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) return text;
    } catch {
      // partial first line of the slice
    }
  }
  return "";
}

function newest(dir, filter) {
  try {
    return fs
      .readdirSync(dir)
      .filter(filter)
      .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0] || null;
  } catch {
    return null;
  }
}

/** Newest .claude/handoffs/*.md written recently, as { name, text }. */
export function recentHandoff(cwd, now = Date.now()) {
  const dir = path.join(cwd, ".claude", "handoffs");
  const file = newest(dir, (n) => n.endsWith(".md"));
  if (!file || now - file.mtime > HANDOFF_MAX_AGE_DAYS * 86_400_000) return null;
  return { name: file.name, text: fs.readFileSync(path.join(dir, file.name), "utf-8").trim() };
}

export function activeTask(cwd, now = Date.now()) {
  const dir = path.join(cwd, ".tasks");
  const task = newest(dir, (n) => fs.statSync(path.join(dir, n)).isDirectory());
  if (!task || now - task.mtime > HANDOFF_MAX_AGE_DAYS * 86_400_000) return "";
  return `.tasks/${task.name}/`;
}

export function buildContext({ prompt, cwd }) {
  if (!ORCA_TEMPLATE.test(prompt)) return "";
  const transcriptPath = prompt.match(TRANSCRIPT_LINE)?.[1];
  const parts = [];
  const last = lastAssistantText(transcriptPath);
  if (last) parts.push(`Full last assistant message of the prior session (Orca's hint above truncates it):\n${last.slice(0, MAX_CHARS)}`);
  const handoff = recentHandoff(cwd);
  if (handoff) parts.push(`Handoff file .claude/handoffs/${handoff.name} (authoritative for next step):\n${handoff.text.slice(0, MAX_CHARS)}`);
  const task = activeTask(cwd);
  if (task) parts.push(`Newest DevOS Throughline folder: ${task} (read it before continuing).`);
  if (parts.length === 0) return "";
  return `Orca handoff enrichment. ${parts.join("\n\n")}`;
}

function main() {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf-8"));
  } catch {
    return;
  }
  try {
    const additionalContext = buildContext({ prompt: String(payload.prompt || ""), cwd: payload.cwd || process.cwd() });
    if (!additionalContext) return;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } }) + "\n");
  } catch {
    // fail open
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
