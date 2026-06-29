#!/usr/bin/env node
// SessionStart hook: offer a recall quiz on this repo's previous conversation.
//
// When you re-open a repository cold — there was a real prior session and it
// ended more than QUIZ_GAP_HOURS ago — this prints one additionalContext line
// telling the assistant to offer `/quiz-me last chat`. On a quick re-open, a
// first-ever session, or when disabled, it stays silent and adds no noise. A
// hook can't run a skill; it can only nudge the assistant to invoke one.
//
// "Previous conversation in this repo" = the newest prior transcript in this
// repo's per-project dir: ~/.claude/projects/<encoded-cwd>/*.jsonl, where
// <encoded-cwd> is the absolute cwd with every "/" and "." replaced by "-".
// (The ECC "Previous session summary" injected at SessionStart is global, not
// per-repo, so it is deliberately NOT used here.)
//
// Node, not bash, to match strategic-compact.js and dodge GNU-vs-BSD `find`
// and `date` portability traps. Built-in modules only — no dependencies.
//
// Disable for a session: CLAUDE_QUIZ_ME=0 in the environment.
// Disable globally:      touch ~/.claude/.quiz-me.off

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const QUIZ_GAP_HOURS = 6; // ponytail: cold-reopen threshold; tune here
const EXCLUDE_RECENT_MS = 2 * 60 * 1000; // skip the in-progress session's own transcript

function main() {
  // Off switches, matching the sibling hooks' conventions.
  if (process.env.CLAUDE_QUIZ_ME === "0") return;
  const home = os.homedir();
  if (fs.existsSync(path.join(home, ".claude", ".quiz-me.off"))) return;

  // Drain stdin if the harness piped a payload; the decision keys off cwd, so
  // its contents are irrelevant. Best-effort and non-blocking.
  try {
    fs.readFileSync(0);
  } catch {
    /* no stdin — fine */
  }

  // /home/chrooks/projects/Toolkit -> -home-chrooks-projects-Toolkit
  const encoded = process.cwd().replace(/[/.]/g, "-");
  const projDir = path.join(home, ".claude", "projects", encoded);
  if (!fs.existsSync(projDir)) return; // no prior sessions in this repo

  const now = Date.now();
  const cutoff = now - QUIZ_GAP_HOURS * 3600 * 1000;

  let newestMtime = null;
  for (const name of fs.readdirSync(projDir)) {
    if (!name.endsWith(".jsonl")) continue;
    let st;
    try {
      st = fs.statSync(path.join(projDir, name));
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    if (now - st.mtimeMs < EXCLUDE_RECENT_MS) continue; // the current session
    if (newestMtime === null || st.mtimeMs > newestMtime) newestMtime = st.mtimeMs;
  }

  if (newestMtime === null) return; // no prior transcript
  if (newestMtime >= cutoff) return; // quick re-open, not a cold one

  const offer =
    "This repo was last worked in over " +
    QUIZ_GAP_HOURS +
    " hours ago. Before diving in, offer the user a quick recall quiz on the " +
    'previous conversation by invoking the /quiz-me skill with target "last chat". ' +
    'It is optional — the user can decline by just starting work or saying "skip".';

  process.stdout.write(JSON.stringify({ suppressOutput: true, additionalContext: offer }));
}

try {
  main();
} catch {
  /* a hook must never block or fail a session */
}
process.exit(0);
