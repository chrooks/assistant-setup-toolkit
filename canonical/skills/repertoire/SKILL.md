---
name: repertoire
description: Rebuild and open the Skills Repertoire page — every Claude Code skill on this machine, searchable by the job it does. Returns a link that works from the user's own browser, with any words after the command prefilled as the search. Use when the user invokes /repertoire, optionally with a job to search for.
argument-hint: "[words to search for, e.g. watch a video]"
disable-model-invocation: true
---

# /repertoire — open the page of every skill on this machine

The page is built by the toolkit's `npm run skills`. It lists the skills on the machine that builds it, so always rebuild before you hand back a link. Words after the command become the search: `/repertoire watch a video` → `#q=watch%20a%20video`.

## 1. Find the toolkit clone

In this order, stop at the first that gives a path:

1. The machine context's **Resource access** section — the local clone of the toolkit.
2. No machine context: run `git rev-parse --show-toplevel`. Use it only when that folder holds `canonical/` and a `package.json` with a `skills` script.
3. Otherwise ask the user once for the clone path.

## 2. Rebuild the page

From the clone, run `npm run -s skills`. The `-s` keeps npm's banner off standard output.

- The first line of standard output is the page's path (`$HOME/.cache/repertoire/index.html`).
- Warnings on standard error (unreadable skills, Uncategorized skills) are for you — mention them in one line, never block on them.
- Local session (neither `SSH_CONNECTION` nor `SSH_CLIENT` is set): the command opened the page already. Reply with the path and, when there are search words, the path with `#q=<words, URL-encoded>`. Done.
- Output says "Remote session — use /repertoire for a link.": go to step 3.

## 3. Serve it over SSH

The user's browser is on another device, so a file path or a `localhost` address will not open. Never return either.

- Address: the one the machine context gives for an ad-hoc dev server. No such address → return the file path, say the page must be opened on this machine, and stop.
- **First pass — reuse.** Check every port from 4747 through 4757 with
  `curl -s --max-time 2 http://<address>:<port>/`. The first one whose output contains
  `id="repertoire-data"` already runs a repertoire server: reuse it — it serves the rebuilt
  file with no restart — and go to step 4. Check them all before starting anything, because
  a free 4747 does not mean no server is running on 4748.
- **Second pass — start.** No repertoire server found → take the ports again in order:
  1. Connection fails → the port is free. Start the server there, detached so it outlives this turn:
     `setsid nohup python3 -m http.server <port> --bind <address> --directory "$HOME/.cache/repertoire" >/dev/null 2>&1 &`
     Then repeat the `curl` until it shows `id="repertoire-data"` (a few tries, one second apart).
     It never shows `id="repertoire-data"` (the bind failed, or another process took the port) → try the next port.
  2. Anything else answers → another service owns the port. Never stop or kill it. Try the next port.
- No port gives a repertoire server → say so, give the reason, and return the file path.

## 4. Reply

- The link: `http://<address>:<port>/`, plus `#q=<words, URL-encoded with %20 for spaces>` when there are search words.
- When the port is not 4747, say in one line that 4747 was taken and which port you used.
- When you reused a running server, say so in one line.
