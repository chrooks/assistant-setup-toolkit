---
name: collect
description: Collect new Apple Notes and Voice Memos from this Mac into the brain's raw-sources inbox, so they sync to every device and can be ingested later. Use when the user says "collect", "pull my notes", "grab my voice memos", "sync my captures", or is about to run an ingest drain and wants the inbox current. macOS only.
argument-hint: "[--since YYYY-MM-DD] [--dry-run] [--notes-only|--memos-only]"
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Collect

Pull this Mac's Apple-local captures — **Notes** and **Voice Memos** — into
`<vault>/raw-sources/inbox/`. LiveSync carries them to every other device, so a
later `/ingest` drain on any machine sees them.

**This is collection only. It never writes to the wiki.** Files land in the inbox;
`/ingest` decides what becomes knowledge.

## Why this is macOS-only, and machine-scoped

Apple Notes needs `osascript`; Voice Memos lives in a local container. Neither is
reachable from the home server or any Linux box, so this Skill installs **only** on the
`mac` machine class (ADR-0003) — the `mac` Preset in `manifests/presets.yaml`
already declares `machine: mac`. Karakeep is deliberately *not* handled here —
it has a REST API and is drained server-side by `/ingest`.

## Quick start

    bash "$SKILL_DIR/scripts/collect.sh"              # everything new since last run
    bash "$SKILL_DIR/scripts/collect.sh" --dry-run    # show what would be pulled
    bash "$SKILL_DIR/scripts/collect.sh" --since 2026-07-01
    bash "$SKILL_DIR/scripts/collect.sh" --notes-only

First run has no watermark, so **pass `--since`** — otherwise it would export every
note you have ever written. The script refuses to run watermark-less without it.

## How it decides what's new

A watermark file at `~/.config/collect/last-run` holds the last successful run's
timestamp. Each run collects items modified after it, then advances it — but only
if nothing failed, so a partial run doesn't silently skip items next time.

`--since` overrides the watermark without consuming it. `--dry-run` never advances it.

## What lands where

| Source | Lands as | Notes |
|---|---|---|
| Apple Note | `inbox/<slug>.md` with frontmatter | Reuses `notes-to-raw.sh` from the `ingest` Skill — one converter, not two |
| Voice Memo | `inbox/<date>-<name>.m4a` | Audio copied as-is; **transcribed at drain time** by `/ingest` using the home server's `faster-whisper`, not here |

Voice memos stay audio on purpose: transcription machinery already exists on the home server
for reels, and duplicating it on the laptop would mean two models to keep current.

## After it runs

The script prints a count and the destination. Hand off:

> Collected N items into the inbox. Run `/ingest` (inbox walk) to file them.

Do not offer to ingest in the same breath — collection is deliberately a separate,
reversible step. The user reviews the inbox before anything reaches the wiki.

## Failure modes worth naming

- **Automation permission** — the first Notes read triggers a macOS prompt (System
  Settings → Privacy & Security → Automation). Denied, `osascript` returns empty and
  the script says so rather than writing zero notes silently.
- **Voice Memos container path moves between macOS releases.** The script probes
  several known locations and reports which one it used; if none match, it skips
  memos with a clear message instead of failing the whole run.
- **Vault not synced yet** — if `knowledge-config.json` points at a path that does not
  exist on this Mac, the script stops before writing anything.

## Related

- `/ingest` — what turns an inbox item into wiki pages or a `backlog/` queue row
- Karakeep drain lives in `ingest/references/karakeep-drain.md`
