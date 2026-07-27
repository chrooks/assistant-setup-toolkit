# Branch: hook

The request is a behavior that must fire every time, enforced by the runtime rather than remembered by the model.

**A hook is two artifacts.** A `.js` script under `canonical/hooks/`, and an entry in `canonical/hooks/wiring.yaml`. Writing only the script produces a file that installs and never runs — nothing wires it, and nothing warns you. Writing only the entry produces a wizard error. Both, always.

A hook almost never arrives alone. The routing table pairs it with an instruction: the instruction tells the model what to do, the hook catches the case where the model forgot. Read [authoring-instruction.md](authoring-instruction.md) in the same pass.

## Artifact 1 — the script

Node, ESM, `.js`. `canonical/hooks/package.json` sets `"type": "module"` for the whole directory, so use `import`, not `require`.

`node` is the only command prefix that resolves identically on Mac, bare Windows, and Windows + WSL — bare `bash` on Windows is the WSL launcher and fails when no distro is installed. That is why every hook is a `.js` file and not a shell script. Do not introduce one.

The contract:

- **Input** — the event payload arrives as JSON on stdin. Read it with `fs.readFileSync(0, "utf-8")` and tolerate an empty read.
- **Output** — write JSON to stdout when the hook has something to say. A `UserPromptSubmit` hook injecting context writes `{ "suppressOutput": true, "additionalContext": "…" }`.
- **Exit code** — `0` means proceed. From a `PreToolUse` hook, `2` blocks the tool call.
- **Fail open.** Every early return in an existing hook exits `0`. A hook that throws on unexpected input turns a helpful guard into a broken session. Guard every field access and exit `0` when the payload is not what you expected.
- **Self-gate.** Exit `0` immediately when the hook has nothing to do — no matching file, no active mode, no relevant env var. A hook fires on every occurrence of its event, so cheap silence is the common path.

Give the hook an off-switch and document it in the header comment. The established shape is both an env var and a flag file:

    // Disable for a session: CLAUDE_<NAME>=0 in the environment.
    // Disable globally: touch ~/.claude/.<name>.off

Open the file with a comment block saying what the hook does, which event it is wired to, which targets it serves, and why it skips any target it skips.

## Artifact 2 — the wiring entry

Append to the `hooks:` list in `canonical/hooks/wiring.yaml`. The wizard merges entries idempotently into each target's settings, keyed on the rendered command string, so re-running never duplicates.

| Field | Required | Meaning |
|---|---|---|
| `file` | yes | the script's filename, relative to `canonical/hooks/` |
| `event` | yes | `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `Notification`, `SessionStart` |
| `targets` | yes | `[claude-code]`, `[codex-cli]`, or both |
| `matcher` | no | tool-name pattern; only honored where the event supports it |
| `scope` | no | `project` to write repo-local settings instead of the Assistant Home |
| `command` | no | defaults to `node {hook}`; add one only to pass arguments |
| `timeoutSec` | no | override the default timeout |
| `variants` | no | Variant gate — the entry wires only where every pair matches the run |

The most complete example in the file, using nearly every optional field:

    - file: proxy-guard.js
      event: PreToolUse
      matcher: "Bash|shell|local_shell"
      targets: [claude-code, codex-cli]
      variants:
        machine: work

Two things that entry teaches. **Matchers must cover both harnesses' names for the same tool** — Claude calls the shell tool `Bash`, Codex calls it `shell` or `local_shell`. A matcher naming only one silently does nothing on the other. And a **`variants` gate ships the script everywhere but wires it only where it belongs**, which is how a machine-specific enforcement lands without a machine-scoped Skill.

### Targets: which to wire

Default to both. The one systematic exception: **Codex renders `UserPromptSubmit` `additionalContext` as visible transcript noise**, so per-turn reminder hooks wire `[claude-code]` only. Five hooks in the file do this. If your hook injects context every turn, follow them and say why in a comment above the entry.

## When to write a `.test.js` sibling

**Branching logic gets a test. A pass-through reminder does not.**

Four of the current hooks have test siblings — `environment-context`, `proxy-guard`, `quiz-me`, `ship-mode-reminder` — and they are exactly the ones with conditional behavior worth pinning: does it block the dangerous command and allow the safe one, does it stay quiet when it should. A hook whose whole body is "emit this constant string" has nothing to assert beyond the string.

Tests are self-contained Node, no framework:

    node canonical/hooks/proxy-guard.test.js

They `spawnSync` the hook with a constructed stdin payload and assert on exit code and stdout. Build the environment from scratch rather than from `process.env`, so the host's own variables cannot leak into the case.

## Create

1. Write the script under `canonical/hooks/<name>.js`.
2. Append the entry to `canonical/hooks/wiring.yaml`, with a comment above it saying why it exists and why it targets what it targets.
3. Write `<name>.test.js` if the hook branches. Run it: `node canonical/hooks/<name>.test.js`.
4. Install with `npm run sync`. Read the `Hooks` line in the summary — it reports how many were added versus already present. A new hook that reports `0 added` did not wire; check the entry.
5. Write the paired instruction if this came through the belt-and-suspenders route.

## Update

Editing the script alone needs no wiring change. Changing the event, the matcher, the targets, or the command **does** — the merge is keyed on the rendered command string, so a changed command registers as a new entry and leaves the old one behind. Run the wizard with `--write prune` after a command change, not `sync`.

## Remove

Both artifacts go: delete the script and its entry, plus the test sibling. Confirm the blast radius once, then prune — `sync` leaves the orphaned script installed:

    npm run setup -- --claude --codex --default --write prune --yes

Pruning removes the file but does **not** unregister a stale settings entry that no longer matches any wiring row. Check `~/.claude/settings.json` for a leftover command pointing at the deleted script and remove it by hand.
