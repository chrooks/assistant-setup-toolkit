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
// front of the user every day. List-rate estimates run high: Max covers part
// of it, and only the overflow is billed as extra usage. Treat the figure as
// "what this would cost at API prices".
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

export function buildSummary(root = path.join(claudeHome(), "projects"), now = Date.now()) {
  const since = now - DAYS * 86_400_000;
  const cache = loadCache();
  const nextCache = {};
  const perDay = {};
  const perSession = {};

  for (const f of listTranscripts(root, since)) {
    const hit = cache[f.path];
    const days = hit && hit.size === f.size && hit.mtimeMs === f.mtimeMs ? hit.days : parseTranscript(f.path);
    nextCache[f.path] = { size: f.size, mtimeMs: f.mtimeMs, days };
    const label = sessionLabel(f.path);
    for (const [day, models] of Object.entries(days)) {
      if (Date.parse(day) < since) continue;
      for (const [model, u] of Object.entries(models)) {
        const usd = costOf(model, u);
        perDay[day] = (perDay[day] || 0) + usd;
        perSession[label] = (perSession[label] || 0) + usd;
      }
    }
  }

  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  const week = Object.entries(perDay)
    .filter(([d]) => Date.parse(d) >= since)
    .reduce((s, [, v]) => s + v, 0);
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
  if (summary.today < ALERT_USD) return;
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
        message: `Today ≈ ${usd(summary.today)} at list rates (alert at ${usd(ALERT_USD)}). 7 days ≈ ${usd(summary.week)}. Check claude.ai → Settings → Billing.`,
        priority: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    fs.writeFileSync(ALERT_STAMP, String(Date.now()));
  } catch {
    // network is best-effort
  }
}

async function main() {
  let summary;
  try {
    summary = buildSummary();
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary));
  } catch {
    return;
  }
  const top = summary.topSessions.map((t) => `${t.label} ${usd(t.usd)}`).join(", ");
  const text =
    `Claude spend estimate at API list rates (Max covers part; the rest bills as extra usage): ` +
    `today ${usd(summary.today)}, yesterday ${usd(summary.yesterday)}, last 7 days ${usd(summary.week)}.` +
    (top ? ` Biggest sessions: ${top}.` : "") +
    (summary.week >= 50 ? " This week is already above the user's $50 extra-usage cap. Tell the user in one line at the start of your first reply." : "");
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }) + "\n",
  );
  await maybeAlert(summary);
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
