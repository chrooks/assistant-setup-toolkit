#!/usr/bin/env node
// Self-contained Node test for proxy-guard.js — no framework, just `node`,
// mirroring environment-context.test.js's shape.
//
//   node canonical/hooks/proxy-guard.test.js

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(__dirname, "proxy-guard.js");

// Built from scratch (not process.env) so the host's own proxy vars can't leak in.
const CLEAN_ENV = { PATH: process.env.PATH };
const PROXY_ENV = {
  PATH: process.env.PATH,
  HTTPS_PROXY: "http://user:s3cret@proxy.corp.example:8080",
};

function run(command, env, toolName = "Bash") {
  const input = JSON.stringify({ tool_name: toolName, tool_input: { command } });
  return spawnSync("node", [HOOK], { input, env, encoding: "utf8" });
}

let failures = 0;
function check(name, ok) {
  console.log((ok ? "PASS" : "FAIL") + ": " + name);
  if (!ok) failures++;
}

// (a) self-gate: without proxy vars everything is allowed, even dumps
check("no proxy vars: printenv allowed", run("printenv", CLEAN_ENV).status === 0);
check("no proxy vars: env dump allowed", run("env | sort", CLEAN_ENV).status === 0);
check(
  "NO_PROXY alone does not arm the guard",
  run("printenv", { ...CLEAN_ENV, NO_PROXY: "localhost,.corp" }).status === 0,
);

// (b) armed: environment dumps are blocked
check("printenv blocked", run("printenv", PROXY_ENV).status === 2);
check("env piped to grep blocked", run("env | grep npm", PROXY_ENV).status === 2);
check("bare set blocked", run("set", PROXY_ENV).status === 2);
check("printenv HTTPS_PROXY blocked", run("printenv HTTPS_PROXY", PROXY_ENV).status === 2);

// (c) armed: echoing proxy values is blocked
check("echo $HTTPS_PROXY blocked", run("echo $HTTPS_PROXY", PROXY_ENV).status === 2);
check("printf ${https_proxy} blocked", run('printf "%s" ${https_proxy}', PROXY_ENV).status === 2);

// (d) armed: curl verbose and git proxy reads are blocked
check("curl -sv blocked", run("curl -sv https://example.com", PROXY_ENV).status === 2);
check("curl --verbose blocked", run("curl --verbose https://example.com", PROXY_ENV).status === 2);
check("git config --get http.proxy blocked", run("git config --get http.proxy", PROXY_ENV).status === 2);
check("git config --list blocked", run("git config --list", PROXY_ENV).status === 2);

// (e) armed: legitimate commands still pass
check("ls allowed", run("ls -la", PROXY_ENV).status === 0);
check("presence check allowed", run('[ -n "$HTTPS_PROXY" ] && echo proxy-set', PROXY_ENV).status === 0);
check("env-prefix command allowed", run("env FOO=1 node -v", PROXY_ENV).status === 0);
check("set -e allowed", run("set -e; make build", PROXY_ENV).status === 0);
check("curl without -v allowed", run("curl -sSL https://example.com", PROXY_ENV).status === 0);
check(
  "curl --resolve not a false positive",
  run("curl --resolve example.com:443:1.2.3.4 https://example.com", PROXY_ENV).status === 0,
);
check("git config user.name allowed", run("git config user.name", PROXY_ENV).status === 0);

// (f) blocking feedback names the fix
{
  const res = run("echo $HTTPS_PROXY", PROXY_ENV);
  check("stderr names proxy-guard", res.stderr.includes("proxy-guard"));
  check("stderr offers the presence-check alternative", res.stderr.includes('[ -n "$HTTPS_PROXY" ]'));
}

// (g) Codex-shaped payloads: shell tool names and argv arrays
check("codex local_shell blocked", run("printenv", PROXY_ENV, "local_shell").status === 2);
check("codex shell blocked", run("echo $HTTPS_PROXY", PROXY_ENV, "shell").status === 2);
{
  const input = JSON.stringify({
    tool_name: "local_shell",
    tool_input: { command: ["bash", "-lc", "printenv HTTPS_PROXY"] },
  });
  const res = spawnSync("node", [HOOK], { input, env: PROXY_ENV, encoding: "utf8" });
  check("argv-array command blocked", res.status === 2);
}

// (h) fail open on non-shell tools and malformed payloads
check("non-shell tool allowed", run("printenv", PROXY_ENV, "Edit").status === 0);
{
  const res = spawnSync("node", [HOOK], { input: "not json", env: PROXY_ENV, encoding: "utf8" });
  check("malformed stdin fails open", res.status === 0);
}

process.exit(failures === 0 ? 0 : 1);
