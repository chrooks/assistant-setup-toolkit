#!/usr/bin/env node
// SessionStart hook: estimated Claude spend from local transcripts.
//
// Sums token usage across every transcript under ~/.claude/projects touched
// in the last 7 days (this machine's sessions plus the mirrored remote ones),
// prices it at Anthropic list rates, and tells the assistant the figures so
// they reach the user at the top of each session. Writes the same summary to
// ~/.claude/.cost-guard/spend-summary.json for the status line, and sends a
// Pushover alert (via the claude-notify secrets file) when today's estimate
// crosses COST_ALERT_USD (default 10), at most once every 6 hours.
//
// Why: the 2026-10 overrun ran for 11 days without a single visible number.
// The subscription hides spend until the invoice. This puts a number in
// front of the user every day.
//
// Billing mode. Transcripts do not record who paid for a session, so the hook
// checks at SessionStart: an ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN in the
// environment, or an apiKeyHelper in settings.json, means the Console org
// pays ("api"); otherwise the claude.ai login pays ("subscription"). The mode
// is recorded per session id in ~/.claude/.cost-guard/billing-modes.json and
// the summary is split into an API-billed bucket (real money) and a
// subscription-covered estimate (what it would cost at API prices). Alerts
// and the $50-cap warning fire on the API bucket only. Sessions that predate
// the record are counted as covered and reported as unrecorded.
//
// Per-file parse results are cached by (size, mtime) so steady-state runs
// read only the transcripts that changed since last time.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DAYS = 7;
const ALERT_USD = Number(process.env.COST_ALERT_USD) || 10;
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// USD per million tokens: [input, output, cacheRead, cacheWrite].
// Source: claude-api skill model table (cached 2026-10-06). Cache write is
// 1.25x input where not published.
const PRICES = {
  "claude-fable-5-1": [10, 50, 0.25, 12.5],
  "claude-fable-5": [10, 50, 1.0, 12.5],
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-opus-5": [5, 25, 0.5, 6.25],
  "claude-opus-4-8": [5, 25, 0.5, 6.25],
  "claude-opus-4-7": [5, 25, 0.5, 6.25],
  "claude-sonnet-5-5": [2, 10, 0.2, 2.5],
  "claude-sonnet-5": [2, 10, 0.2, 2.5],
  "claude-haiku-5-5": [0.1, 0.5, 0.01, 0.125],
};
const DEFAULT_PRICE = PRICES["claude-opus-5-5"];

function claudeHome() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

const STATE_DIR = path.join(claudeHome(), ".cost-guard");
const CACHE_FILE = path.join(STATE_DIR, "spend-cache.json");
const SUMMARY_FILE = path.join(STATE_DIR, "spend-summary.json");
const ALERT_STAMP = path.join(STATE_DIR, "last-alert");
const MODES_FILE = path.join(STATE_DIR, "billing-modes.json");
const API_CAP_USD = 50;

/** "api" when the session will bill the Console org, else "subscription". */
export function detectBillingMode(env = process.env, settingsFile = path.join(claudeHome(), "settings.json")) {
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) return "api";
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFile, "utf-8"));
    if (settings && settings.apiKeyHelper) return "api";
  } catch {
    // no settings file or unparsable: no key helper
  }
  return "subscription";
}

export function loadBillingModes(file = MODES_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

export function recordBillingMode(sessionId, mode, file = MODES_FILE, now = Date.now()) {
  if (!sessionId) return loadBillingModes(file);
  const modes = { ...loadBillingModes(file), [sessionId]: { mode, recordedAt: new Date(now).toISOString() } };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(modes));
  } catch {
    // the record is best-effort
  }
  return modes;
}

function priceFor(model) {
  const key = Object.keys(PRICES).find((k) => String(model).startsWith(k));
  return key ? PRICES[key] : DEFAULT_PRICE;
}

function costOf(model, u) {
  const [inp, out, read, write] = priceFor(model);
  return (
    ((u.input || 0) * inp +
      (u.output || 0) * out +
      (u.cacheRead || 0) * read +
      (u.cacheWrite || 0) * write) /
    1e6
  );
}

function listTranscripts(root, since) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) {
        const st = fs.statSync(p);
        if (st.mtimeMs >= since) out.push({ path: p, size: st.size, mtimeMs: st.mtimeMs });
      }
    }
  };
  walk(root);
  return out;
}

/** Per-day, per-model usage for one transcript, deduped by API message id. */
function parseTranscript(file) {
  const days = {};
  const seen = new Set();
  let text;
  try {
    text = fs.readFileSync(file, "utf-8");
  } catch {
    return days;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"usage"')) continue;
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const m = d?.message;
    const u = m?.usage;
    if (!u || !m.model || m.model === "<synthetic>") continue;
    const id = m.id || d.requestId || d.uuid;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    const day = String(d.timestamp || "").slice(0, 10);
    if (!day) continue;
    const bucket = ((days[day] ??= {})[m.model] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });
    bucket.input += u.input_tokens || 0;
    bucket.output += u.output_tokens || 0;
    bucket.cacheRead += u.cache_read_input_tokens || 0;
    bucket.cacheWrite += u.cache_creation_input_tokens || 0;
    bucket.calls += 1;
  }
  return days;
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function sessionLabel(file) {
  const rel = path.relative(path.join(claudeHome(), "projects"), file);
  return rel.split(path.sep)[0].replace(/^ssh-/, "remote:");
}

export function buildSummary(
  root = path.join(claudeHome(), "projects"),
  now = Date.now(),
  modes = loadBillingModes(),
) {
  const since = now - DAYS * 86_400_000;
  const cache = loadCache();
  const nextCache = {};
  const perDay = {};
  const apiPerDay = {};
  const perSession = {};
  let unrecordedSessions = 0;

  for (const f of listTranscripts(root, since)) {
    const hit = cache[f.path];
    const days = hit && hit.size === f.size && hit.mtimeMs === f.mtimeMs ? hit.days : parseTranscript(f.path);
    nextCache[f.path] = { size: f.size, mtimeMs: f.mtimeMs, days };
    const label = sessionLabel(f.path);
    const sessionId = path.basename(f.path, ".jsonl");
    const mode = modes[sessionId]?.mode;
    if (!mode && Object.keys(days).length > 0) unrecordedSessions += 1;
    for (const [day, models] of Object.entries(days)) {
      if (Date.parse(day) < since) continue;
      for (const [model, u] of Object.entries(models)) {
        const usd = costOf(model, u);
        perDay[day] = (perDay[day] || 0) + usd;
        perSession[label] = (perSession[label] || 0) + usd;
        if (mode === "api") apiPerDay[day] = (apiPerDay[day] || 0) + usd;
      }
    }
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const sumWeek = (days) =>
    Object.entries(days)
      .filter(([d]) => Date.parse(d) >= since)
      .reduce((s, [, v]) => s + v, 0);
  const week = sumWeek(perDay);
  const apiWeek = sumWeek(apiPerDay);
  const top = Object.entries(perSession)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, usd]) => ({ label, usd: round(usd) }));

  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(nextCache));
  } catch {
    // cache is an optimisation only
  }
  return {
    generatedAt: new Date(now).toISOString(),
    today: round(perDay[today] || 0),
    yesterday: round(perDay[yesterday] || 0),
    week: round(week),
    apiToday: round(apiPerDay[today] || 0),
    apiYesterday: round(apiPerDay[yesterday] || 0),
    apiWeek: round(apiWeek),
    unrecordedSessions,
    topSessions: top,
  };
}

const round = (n) => Math.round(n * 100) / 100;
const usd = (n) => `$${n.toFixed(2)}`;

function parseSecrets(file) {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(file, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

async function maybeAlert(summary) {
  if (summary.apiToday < ALERT_USD) return;
  try {
    const last = Number(fs.readFileSync(ALERT_STAMP, "utf-8"));
    if (Date.now() - last < ALERT_COOLDOWN_MS) return;
  } catch {
    // no stamp yet
  }
  const secrets = parseSecrets(
    process.env.PUSHOVER_SECRETS_FILE || path.join(claudeHome(), "secrets-pushover.env"),
  );
  if (!secrets.PUSHOVER_TOKEN || !secrets.PUSHOVER_USER) return;
  try {
    await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: secrets.PUSHOVER_TOKEN,
        user: secrets.PUSHOVER_USER,
        title: "Claude spend alert",
        message: `API-billed today ≈ ${usd(summary.apiToday)} (alert at ${usd(ALERT_USD)}). 7 days ≈ ${usd(summary.apiWeek)}. Check console.anthropic.com → Billing.`,
        priority: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    fs.writeFileSync(ALERT_STAMP, String(Date.now()));
  } catch {
    // network is best-effort
  }
}

/** Reads the hook payload from stdin without blocking a TTY. */
function readPayload() {
  try {
    if (process.stdin.isTTY) return {};
    return JSON.parse(fs.readFileSync(0, "utf-8") || "{}");
  } catch {
    return {};
  }
}

export function reportText(summary, mode) {
  const top = summary.topSessions.map((t) => `${t.label} ${usd(t.usd)}`).join(", ");
  const lead =
    mode === "api"
      ? "BILLING WARNING: this session found an API key (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or apiKeyHelper), so it bills the Console org at full rates with no Max coverage. Tell the user in the first line and stop until they confirm. "
      : "This session bills the claude.ai subscription (no API key found). ";
  const apiPart =
    summary.apiWeek > 0
      ? `API-billed sessions (real Console charges): today ${usd(summary.apiToday)}, yesterday ${usd(summary.apiYesterday)}, last 7 days ${usd(summary.apiWeek)}. `
      : "API-billed sessions in the last 7 days: none recorded. ";
  const coveredPart =
    `Subscription-covered estimate (what the Max-plan sessions would cost at API list rates): ` +
    `today ${usd(summary.today - summary.apiToday)}, yesterday ${usd(summary.yesterday - summary.apiYesterday)}, last 7 days ${usd(summary.week - summary.apiWeek)}.` +
    (summary.unrecordedSessions > 0
      ? ` ${summary.unrecordedSessions === 1 ? "1 session predates" : `${summary.unrecordedSessions} sessions predate`} the billing record and count as covered.`
      : "");
  return (
    lead +
    apiPart +
    coveredPart +
    (top ? ` Biggest sessions: ${top}.` : "") +
    (summary.apiWeek >= API_CAP_USD
      ? ` API-billed spend this week is at or above the $${API_CAP_USD} monthly Console cap. Tell the user in one line at the start of your first reply.`
      : "")
  );
}

async function main() {
  const payload = readPayload();
  const mode = detectBillingMode();
  const modes = recordBillingMode(payload.session_id, mode);
  let summary;
  try {
    summary = buildSummary(undefined, undefined, modes);
    summary = { ...summary, thisSessionMode: mode };
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary));
  } catch {
    return;
  }
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: reportText(summary, mode) } }) + "\n",
  );
  await maybeAlert(summary);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
