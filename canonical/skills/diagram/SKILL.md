---
name: diagram
description: "Render a diagram — `/diagram md` for an in-chat ASCII sketch plus an auto-rendered Mermaid picture, `/diagram html` for a validated interactive diagram (delegates to the archify Skill). Use when explaining architecture, a pipeline, a user flow, a sequence, a state machine, or any nodes-and-edges structure, especially when bringing the user along on something they are not yet deep in."
argument-hint: "[md|html] [kind] <what to diagram>"
---

# /diagram — ASCII + Mermaid + Interactive Diagram Renderer

The user learns visually. When you explain a structure or a process, show it as a diagram
instead of (or alongside) prose. Two fidelities: a sketch that lands in the chat, and a
built artifact someone else can open.

## Invocation

```
/diagram            <what>   → pick the fidelity by judgment (see below)
/diagram md         <what>   → ASCII in chat + auto-rendered Mermaid picture
/diagram html       <what>   → call the archify Skill (see below)
```

You may name a `kind` after the mode: `flow` (default), `architecture`, `sequence`,
`state`, `er`, `mindmap`, `roadmap`. The kind drives layout and node vocabulary, not a
separate tool.

## The Diagram Model (`md` mode, and the vis-network fallback)

Author the structure once as nodes + edges. `md` mode renders from this; so does the
vis-network fallback described under `html` Mode. Archify does **not** — it authors its own
typed spec.

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

Default to **`md`** — it lands in the conversation, and most diagrams should stay there.
Choose **`html`** when the diagram will outlive the conversation: it goes in a README, a
review, a handoff, or a doc someone reads later. When unsure, do `md` and offer the `html`
upgrade in one line.

## `md` Mode — ASCII in chat + Mermaid picture

Do BOTH, every time:

1. **Print an ASCII/Unicode sketch inline** so the user sees the shape immediately in the
   chat. Use box-drawing characters; keep it scannable. Conventions:
   - Boxes: `┌─┐ │ │ └─┘`  · Flows: `──▶`  `──┤`  · Trees: `├──` `└──`
   - Lead each box with the node label; keep it to the essential nodes if the graph is large.
2. **Write the Mermaid source** to `<cwd>/.exports/diagram/<slug>.mmd`, generated from the
   model by `kind`:
   - `flow` / `architecture` → `flowchart TD` (or `LR`): `cli["cli.ts"] --> manifest["manifest.ts"]`
   - `sequence` → `sequenceDiagram` with `A->>B: label`
   - `state` → `stateDiagram-v2`
   - `er` → `erDiagram`
   - `mindmap` → `mindmap`
   Put edge labels on the arrows (`A -->|SetupProfile| B`).
3. **Render and open the Mermaid picture** (the user chose auto-open): if `mmdc` is on PATH,
   run `mmdc -i <slug>.mmd -o <slug>.svg` then `open "<slug>.svg"`. If `mmdc` is missing
   or the browser renderer fails, skip the picture, keep the `.mmd`, and tell the user it is
   ready to preview (VSCode Markdown Preview Enhanced / Mermaid Chart render it).

`.exports/` is the shared generated-output root for visual skills (`table/`,
`diagram/`, `figure/`). If the project does not ignore it, add `.exports/` to its
`.gitignore` — one entry covers every visual skill.

## `html` Mode — call the archify Skill

**Call the Skill tool with "archify" and hand it the subject.** Do not restate its contract
here; it owns the authoring path, the schema, and the validator.

Archify wins this job outright, measured head to head on the same 12-node architecture
(2026-08-27). It refuses to ship what it cannot vouch for — including one layout that would
have rendered node text at 3.3px on a laptop — and it carries light/dark themes, presentation
mode, PNG/SVG/WebM export, and a Semantic Passport that opens on any node **or edge** with
its type, boundary, tag, every relationship in and out, reach counts, and a deep link. The
vis-network path shipped a clipped label and a struck-through edge label on the same content
and said nothing.

Archify is a **fetched External Source**, not a local Skill. If it is missing, the `archify`
entry in `manifests/install.yaml` was disabled — re-enable it and re-run the wizard rather
than hand-rolling a replacement.

### `kind` mapping

Archify's five typed kinds cover almost everything this skill used to render:

| `/diagram` kind | archify type |
|---|---|
| `architecture` | `architecture` |
| `flow`, process, pipeline | `workflow` |
| `sequence` | `sequence` |
| data pipeline, ETL, lineage | `dataflow` |
| `state` | `lifecycle` |
| `roadmap`, `er`, `mindmap` | none — use the fallback below |

### The vis-network fallback

Kept for the three cases archify genuinely cannot serve. Reach for it **only** when one
applies, and say which one:

1. **`roadmap`, `er`, or `mindmap` kind** — not among archify's five types.
2. **The reader must drag the nodes.** Archify positions are authored in the spec; the
   renderer has no drag handlers at all.
3. **The value is a paragraph you wrote about each node.** An archify component takes eleven
   fields under `additionalProperties: false` and none is a description — its passport only
   reports structure it derived. Authored prose caps at five `meta.views` notes plus the
   summary cards.

The template at [`templates/diagram-template.html`](templates/diagram-template.html) wraps
the vendored, offline `vis-network` library ([`vendor/`](vendor/)). It gives pan/zoom,
drag-to-rearrange nodes, hover tooltips, and a **click → detail panel** that shows a
node's or edge's full `description` + `meta`.

Build it with the bundled fill script — it injects the model, inlines the vendored library,
escapes `</script>` (in both the data and the minified lib), and HTML-escapes the title.

#### Steps

1. **Shape the model** into `nodes` and `edges` arrays (same shape as above). Node `group`
   controls the detail-panel tag; `description` powers hover + click.
2. **Write the model** to a JSON file: `{ "title", "kind", "nodes", "edges", "options", "zones" }`.
   `zones` (optional) draws labeled background bands behind the graph — the user conceives
   software in layers, so **default to zones for `architecture` kind**: horizontal bands
   stacked top→bottom (Client → Frontend → API → Services → Data), externals in a side
   band. Shape: `[{ "label": "Frontend", "x0": -760, "y0": -480, "x1": 560, "y1": -330,
   "color": "rgba(79,70,229,0.05)" }]` (canvas coords; place nodes inside their band;
   keep runtime data flow and deploy-time concerns in separate bands, not mixed edges).
   **Default to free 2D dragging**: set
   `"options": { "layout": { "hierarchical": { "enabled": false } }, "physics": false }`
   and give every node pinned `x`/`y` coordinates (a rough grid is fine — the user drags
   nodes where they want them, and free layout keeps them where they put them). Only fall
   back to the kind-driven auto layout (omit `options` and coordinates) when hand-placing
   is genuinely impractical, e.g. a big auto-generated graph nobody will rearrange.
3. **Run the fill script** (it lives in `scripts/` next to this SKILL.md; `templates/` and
   `vendor/` are its siblings):
   ```bash
   python3 scripts/build-diagram.py model.json     # or: build-diagram.py model.json out.html
   ```
   It fills the template, inlines `vendor/vis-network.min.{js,css}`, escapes `</script>` in
   the data and the lib, HTML-escapes the title, writes to `<cwd>/.exports/diagram/<slug>.html`,
   and prints the absolute path.
4. **Open** the printed path: `open "<path>"` on macOS (`xdg-open` Linux, `start` Windows),
   and report it.

#### Notes

- Use the script, not a hand-rolled fill: it is the tested path
  (`tests/setup/skill-html-fill.test.ts`) that guarantees the `</script>` escaping.
- Do not add other libraries — vis-network is vendored on purpose for offline use.
- The detail panel reads `description` and `meta`, so write those for the nodes/edges that
  carry the teaching value, not just labels.

## Living Diagrams (committed source, update-on-change)

Some diagrams are not one-off explanations but durable project surfaces — a roadmap, an
architecture map that tracks reality. For those:

- **Commit the source** in the project (e.g. `docs/architecture/<name>.architecture.json`),
  not in `.exports/diagram/`. The JSON is the source of truth; the HTML is a build product
  regenerated beside it.
- A living diagram is the strongest case for archify: `deliver` freezes the spec, renders it,
  and reports SHA-256 for both files, so a rebuild that drifts is visible rather than quiet.
  Authored positions survive every rebuild by construction.
- **Update loop**: whenever the underlying facts change (an issue closes, a component
  lands), edit the source and rebuild in the same pass — a stale living diagram is worse
  than none. Note the update trigger in the project's CLAUDE.md or memory so future
  sessions keep it current.
- A living **roadmap** stays on the vis-network fallback (case 1 above) and keeps the
  free-layout default — pinned coordinates are what make hand-arranged positions survive
  rebuilds there.

### `roadmap` kind

For issue/milestone maps (the twn.com pattern). Conventions:

- **Nodes** = issues; `label` leads with a state emoji: `✅` closed, `🧍` waiting on a
  human, `🧊` icebox, none = open. Include the issue number and milestone in the label
  (`"✅ #8 Music page\n(M2)"`); put `milestone` and `state` in `meta`.
- **Groups** by workstream (pages, infra, tooling, blocked-on-human, icebox) so colors
  carry meaning.
- **Edges** = dependencies, pointing blocker → blocked, with `description` saying what
  the dependency actually is.
- **Layout**: cluster columns by milestone along x, workstreams along y.

## Behavior

- No confirmation prompts. `/diagram md X` → sketch + Mermaid immediately. `/diagram html X`
  → build, open, report path.
- This skill is for *communicating structure*. It does not analyze a codebase for you —
  it renders the model you give it. (For deep code-graph extraction, that is a different
  job; this is the lightweight "show me what we're building" view.)
- Reach for `/diagram md` proactively when explaining architecture, a pipeline, a user
  flow, or a sequence — especially when the user is working on something they are not yet deep in.
