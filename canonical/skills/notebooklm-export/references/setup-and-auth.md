# NotebookLM — setup & auth

The `notebooklm-export` skill drives the unofficial [`notebooklm-py`](https://github.com/teng-lin/notebooklm-py)
CLI (binary: `notebooklm`). This page is the one-time setup the skill's preflight points at.

## 1. Install the CLI

Install it so `notebooklm` is on `PATH` (an isolated tool install is cleanest):

```bash
uv tool install "notebooklm-py"     # recommended
# or
pipx install notebooklm-py
```

> **Do NOT install the `[cookies]` extra on Python 3.13+.** It pulls `rookiepy` (Rust/pyo3),
> which has no cp313 wheels and fails to build (pyo3 0.20 caps at Python 3.12). The
> `--browser-cookies` auto-extraction path is therefore unavailable on 3.13 — use interactive
> `notebooklm login` instead (below). On Python ≤3.12 the `[cookies]` extra works if you want
> cookie extraction.

**Dev/staging shortcut (this repo):** the spike venv at
`feature_requests/notebooklm-export/.venv` already has the CLI plus the `[browser]` extra and
a Playwright Chromium. Use `feature_requests/notebooklm-export/.venv/bin/notebooklm` if you'd
rather not install globally.

## 2. Authenticate (once)

```bash
notebooklm login
```

This opens a **visible** browser window (headed Chromium — not the headless Chrome that
crashes this Mac). Sign into the Google account that holds your NotebookLM. The resulting
`~/.notebooklm/profiles/default/storage_state.json` cookie file is reused on every later run;
after login, all calls are plain HTTP — no browser at runtime.

- If the bundled Chromium window crashes: `notebooklm login --browser chrome` (drives system
  Google Chrome, still headed).

## 3. Verify

```bash
notebooklm auth check --test --json
```

Require BOTH `"status": "ok"` AND `"checks": { "token_fetch": true }`. The `--test` flag makes
a real network call; bare `status: ok` only proves the cookie file parses (false-positive trap).

## 4. Keep it warm / recover stale cookies

- `notebooklm auth refresh` — cheap server-side SIDTS refresh of the active profile. Safe to
  run on a schedule (cron/launchd, ~15–20 min cadence) to keep an unattended profile alive.
- If it's too stale for the server-side refresh, just `notebooklm login` again.

## 5. Multiple accounts / profiles

- Named profiles: `notebooklm profile create work`, then `notebooklm -p work login`.
- Or per-context env vars: `NOTEBOOKLM_PROFILE=<name>`, `NOTEBOOKLM_HOME=<dir>`,
  `NOTEBOOKLM_AUTH_JSON=<storage_state contents>` (for CI/secret-based auth, no file writes).

## Notes

- The library is unofficial and can break without notice — treat auth failures as expected
  operational noise, recover, and move on.
- Upstream ships its own maintained agent skill covering the full API: `notebooklm skill install`.
