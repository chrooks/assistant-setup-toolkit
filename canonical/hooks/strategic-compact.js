#!/usr/bin/env node

const DEFAULT_THRESHOLD = 50;
const REMINDER_INTERVAL = 25;

let crypto;
let fs;
let os;
let path;

function readHookInput() {
  const raw = fs.readFileSync(0, "utf-8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveSessionId(input) {
  return (
    stringValue(input.session_id) ||
    stringValue(process.env.CLAUDE_SESSION_ID) ||
    stringValue(process.env.CODEX_SESSION_ID) ||
    stringValue(process.env.CODEX_COMPANION_SESSION_ID) ||
    `ppid-${process.ppid}`
  );
}

function resolveThreshold() {
  const parsed = Number.parseInt(process.env.COMPACT_THRESHOLD ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD;
}

function resolveCounterFile(sessionId) {
  const digest = crypto.createHash("sha256").update(sessionId).digest("hex");
  return path.join(os.tmpdir(), `strategic-compact-${digest}.json`);
}

function readCount(counterFile) {
  try {
    const raw = fs.readFileSync(counterFile, "utf-8");
    const parsed = JSON.parse(raw);
    const count = Number(parsed.count);
    return Number.isInteger(count) && count >= 0 ? count : 0;
  } catch {
    return 0;
  }
}

function writeCount(counterFile, sessionId, count) {
  const payload = JSON.stringify({ sessionId, count }) + "\n";
  fs.writeFileSync(counterFile, payload, "utf-8");
}

function buildWarning(count, threshold) {
  if (count === threshold) {
    return `[StrategicCompact] ${threshold} tool calls reached - consider /compact if transitioning phases`;
  }

  if (count > threshold && (count - threshold) % REMINDER_INTERVAL === 0) {
    return `[StrategicCompact] ${count} tool calls - good checkpoint for /compact if context is stale`;
  }

  return null;
}

function emitWarning(message) {
  process.stderr.write(`${message}\n`);
  process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

async function main() {
  [{ default: crypto }, { default: fs }, { default: os }, { default: path }] =
    await Promise.all([
      import("node:crypto"),
      import("node:fs"),
      import("node:os"),
      import("node:path"),
    ]);

  const input = readHookInput();
  const sessionId = resolveSessionId(input);
  const threshold = resolveThreshold();
  const counterFile = resolveCounterFile(sessionId);
  const nextCount = readCount(counterFile) + 1;

  writeCount(counterFile, sessionId, nextCount);

  const warning = buildWarning(nextCount, threshold);
  if (warning) {
    emitWarning(warning);
  }
}

main().catch(() => {
  process.exitCode = 0;
});
