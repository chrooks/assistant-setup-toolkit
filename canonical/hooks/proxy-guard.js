#!/usr/bin/env node
// PreToolUse guard (matcher: Bash): blocks commands that would print proxy
// credentials. On machines behind a credential-bearing corporate proxy
// (machine Variant `work`), the *_PROXY env vars embed username:password —
// anything that echoes them writes a secret into the transcript and tool
// logs, where no after-the-fact redaction can reach it. Prevention is the
// only control that works ex ante; the prose rule in machine.md is advisory,
// this hook is the guarantee.
//
// Wired only where wiring.yaml's variant gate matches (work preset). Also
// self-gates at runtime: when no *_PROXY variable carries a value it allows
// everything instantly, so the script is inert on non-proxy machines even
// if wired by hand.
//
// Exit contract (PreToolUse): exit 0 allows the call; exit 2 blocks it and
// feeds stderr back to the model. Parse failures fail OPEN — a guard that
// bricks every Bash call on a malformed payload is worse than one missed
// check. Node built-ins only, matching the sibling hooks.
//
// ponytail: narrow pattern set — covers the leak vectors machine.md names
// (env dumps, echoed proxy vars, curl -v, git config proxy reads). Extend
// per incident, not speculatively; `cat ~/.zshrc`-style file reads are out
// of scope here.

import fs from "node:fs";

const CHECKS = [
  {
    reason: "dumps the environment (bare env/printenv/set)",
    pattern: /(^|[|;&(]\s*)(env|printenv|set)\s*($|[|>;&)])/,
  },
  {
    reason: "prints a proxy variable via printenv",
    pattern: /\bprintenv\b[^|;&]*proxy/i,
  },
  {
    reason: "echoes a proxy variable",
    pattern: /\b(echo|printf)\b[^|;&]*\$\{?\w*proxy\w*/i,
  },
  {
    reason: "runs curl verbose, which prints proxy CONNECT headers",
    pattern: /\bcurl\b[^|;&]*(\s-[A-Za-z]*v[A-Za-z]*(\s|$)|\s--verbose\b)/,
  },
  {
    reason: "reads proxy configuration from git",
    pattern: /\bgit\s+config\b[^|;&]*(--list\b|\s-l\b|proxy)/i,
  },
];

// NO_PROXY is a host list, not a credential — it never gates the guard on.
function proxyVarsPresent(env) {
  return Object.keys(env).some(
    (key) => /proxy$/i.test(key) && !/^no_proxy$/i.test(key) && env[key],
  );
}

function main() {
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    process.exit(0); // fail open: nothing to judge
  }
  if (payload?.tool_name !== "Bash") process.exit(0);
  const command = payload?.tool_input?.command;
  if (typeof command !== "string" || command.length === 0) process.exit(0);
  if (!proxyVarsPresent(process.env)) process.exit(0);

  for (const check of CHECKS) {
    if (check.pattern.test(command)) {
      process.stderr.write(
        `proxy-guard: blocked — this command ${check.reason}, and proxy values ` +
          "are secrets on this machine. Check presence only " +
          '([ -n "$HTTPS_PROXY" ]) and keep proxy values out of all output.',
      );
      process.exit(2);
    }
  }
  process.exit(0);
}

main();
