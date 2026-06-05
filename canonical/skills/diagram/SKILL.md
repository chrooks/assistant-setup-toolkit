---
name: diagram
description: "Render a diagram — `/diagram md` for an in-chat ASCII sketch plus an auto-rendered Mermaid picture, `/diagram html` for a self-contained interactive graph (pan/zoom, drag, hover, click-to-explain). Use when explaining architecture, a pipeline, a user flow, a sequence, a state machine, or any nodes-and-edges structure, especially when bringing Chris along on something he is not yet deep in."
argument-hint: "[md|html] [kind] <what to diagram>"
---

# /diagram — ASCII + Mermaid + Interactive Diagram Renderer

Chris learns visually. When you explain a structure or a process, show it as a diagram
instead of (or alongside) prose. One skill, one model, two fidelities — same pattern as
`/table`.

## Invocation

```
/diagram            <what>   → pick the fidelity by judgment (see below)
/diagram md         <what>   → ASCII in chat + auto-rendered Mermaid picture
/diagram html       <what>   → self-contained interactive graph in the browser
```

You may name a `kind` after the mode: `flow` (default), `architecture`, `sequence`,
`state`, `er`, `mindmap`. The kind drives layout and node vocabulary, not a separate tool.

## The Diagram Model (one source, two renders)

Author the structure once as nodes + edges, then render it at either fidelity:

```json
{
  "title": "Setup Wizard pipeline",
  "kind": "architecture",
  "nodes": [
    { "id": "cli", "label": "cli.ts", "group": "entry", "description": "Parses flags + prompts into a SetupProfile.", "meta": { "stage": 1 } }
  ],
  "edges": [
    { "from": "cli", "to": "manifest", "label": "SetupProfile", "description": "Hands the parsed profile to manifest resolution." }
  ]
}
```

- `id` is referenced by edges. `label` is the visible name. `group` is an optional
  category (colors + the detail-panel tag). `description` is the hover tooltip + the
  click-to-explain text. `meta` is an optional flat key/value map shown in the panel.
- Edge `label` is the relationship; `description` explains it on hover/click.

## Mode Selection (bare `/diagram`)

Default to **`md`** — it lands in the conversation. Choose **`html`** when the structure
is big or exploratory (more than ~12 nodes), or when Chris will want to click around and
read the parts. When unsure, do `md` and offer the `html` upgrade in one line.

## `md` Mode — ASCII in chat + Mermaid picture

Do BOTH, every time:

1. **Print an ASCII/Unicode sketch inline** so Chris sees the shape immediately in the
   chat. Use box-drawing characters; keep it scannable. Conventions:
   - Boxes: `┌─┐ │ │ └─┘`  · Flows: `──▶`  `──┤`  · Trees: `├──` `└──`
   - Lead each box with the node label; keep it to the essential nodes if the graph is large.
2. **Write the Mermaid source** to `<cwd>/.diagram-exports/<slug>.mmd`, generated from the
   model by `kind`:
   - `flow` / `architecture` → `flowchart TD` (or `LR`): `cli["cli.ts"] --> manifest["manifest.ts"]`
   - `sequence` → `sequenceDiagram` with `A->>B: label`
   - `state` → `stateDiagram-v2`
   - `er` → `erDiagram`
   - `mindmap` → `mindmap`
   Put edge labels on the arrows (`A -->|SetupProfile| B`).
3. **Render and open the Mermaid picture** (Chris chose auto-open): if `mmdc` is on PATH,
   run `mmdc -i <slug>.mmd -o <slug>.svg` then `open "<slug>.svg"`. If `mmdc` is missing,
   skip rendering, keep the `.mmd`, and tell Chris it is ready to preview (VSCode Markdown
   Preview Enhanced / Mermaid Chart render it).

`.diagram-exports/` is generated output — mention it can be gitignored if the project
does not already ignore it.

## `html` Mode — Interactive Graph

The template at [`templates/diagram-template.html`](templates/diagram-template.html) wraps
the vendored, offline `vis-network` library ([`vendor/`](vendor/)). It gives pan/zoom,
drag-to-rearrange nodes, hover tooltips, and a **click → detail panel** that shows a
node's or edge's full `description` + `meta`.

Build it with the bundled fill script — it injects the model, inlines the vendored library,
escapes `</script>` (in both the data and the minified lib), and HTML-escapes the title.

### Steps

1. **Shape the model** into `nodes` and `edges` arrays (same shape as above). Node `group`
   controls the detail-panel tag; `description` powers hover + click.
2. **Write the model** to a JSON file: `{ "title", "kind", "nodes", "edges", "options"? }`.
   `kind` is one of flow/architecture/sequence/state/er/mindmap (drives layout — hierarchical
   for flow/architecture/sequence/state, physics for er/mindmap).
3. **Run the fill script** (it lives in `scripts/` next to this SKILL.md; `templates/` and
   `vendor/` are its siblings):
   ```bash
   python3 scripts/build-diagram.py model.json     # or: build-diagram.py model.json out.html
   ```
   It fills the template, inlines `vendor/vis-network.min.{js,css}`, escapes `</script>` in
   the data and the lib, HTML-escapes the title, writes to `<cwd>/.diagram-exports/<slug>.html`,
   and prints the absolute path.
4. **Open** the printed path: `open "<path>"` on macOS (`xdg-open` Linux, `start` Windows),
   and report it.

### Notes

- Use the script, not a hand-rolled fill: it is the tested path
  (`tests/setup/skill-html-fill.test.ts`) that guarantees the `</script>` escaping.
- Do not add other libraries — vis-network is vendored on purpose for offline use.
- The detail panel reads `description` and `meta`, so write those for the nodes/edges that
  carry the teaching value, not just labels.

## Behavior

- No confirmation prompts. `/diagram md X` → sketch + Mermaid immediately. `/diagram html X`
  → build, open, report path.
- This skill is for *communicating structure*. It does not analyze a codebase for you —
  it renders the model you give it. (For deep code-graph extraction, that is a different
  job; this is the lightweight "show me what we're building" view.)
- Reach for `/diagram md` proactively when explaining architecture, a pipeline, a user
  flow, or a sequence — especially when Chris is working on something he is not yet deep in.
